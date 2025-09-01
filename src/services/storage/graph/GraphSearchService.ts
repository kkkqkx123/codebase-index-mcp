import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../core/LoggerService';
import { NebulaService } from '../../../database/NebulaService';
import { GraphCacheService } from './GraphCacheService';
import { GraphPerformanceMonitor } from './GraphPerformanceMonitor';
import { GraphQueryBuilder } from './GraphQueryBuilder';

export interface SearchOptions {
  limit?: number;
  type?: 'semantic' | 'relationship' | 'path' | 'fuzzy';
  projectId?: string;
  nodeTypes?: string[];
  relationshipTypes?: string[];
  filePath?: string;
  minScore?: number;
  offset?: number;
  sortBy?: 'relevance' | 'name' | 'type' | 'created';
  targetNode?: string; // 用于路径搜索
  maxDepth?: number;   // 用于路径搜索
}

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  score: number;
  queryType: string;
  path?: any; // 路径搜索结果
}

export interface SearchMetrics {
  queryTime: number;
  resultCount: number;
  cacheHit: boolean;
  queryType: string;
}

@injectable()
export class GraphSearchService {
  private nebulaService: NebulaService;
  private logger: LoggerService;
  private cacheService: GraphCacheService;
  private performanceMonitor: GraphPerformanceMonitor;
  private queryBuilder: GraphQueryBuilder;
  private isInitialized: boolean = false;

  constructor(
    @inject(NebulaService) nebulaService: NebulaService,
    @inject(LoggerService) logger: LoggerService,
    @inject(GraphCacheService) cacheService: GraphCacheService,
    @inject(GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
    @inject(GraphQueryBuilder) queryBuilder: GraphQueryBuilder
  ) {
    this.nebulaService = nebulaService;
    this.logger = logger;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.queryBuilder = queryBuilder;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.nebulaService.isConnected()) {
        const connected = await this.nebulaService.initialize();
        if (!connected) {
          throw new Error('Failed to connect to NebulaGraph');
        }
      }
      this.isInitialized = true;
      this.logger.info('Graph search service initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize graph search service', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<{
    results: SearchResult[];
    metrics: SearchMetrics;
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const searchParams = this.buildSearchParams(query, options);
      
      // 检查缓存
      const cacheKey = this.generateCacheKey(searchParams);
      const cachedResults = this.cacheService.getFromCache<SearchResult[]>(cacheKey);
      
      if (cachedResults) {
        this.performanceMonitor.updateCacheHitRate(true);
        const metrics: SearchMetrics = {
          queryTime: Date.now() - startTime,
          resultCount: cachedResults.length,
          cacheHit: true,
          queryType: searchParams.queryType
        };
        
        this.logger.info('Search results retrieved from cache', {
          query,
          ...metrics
        });
        
        return { results: cachedResults, metrics };
      }

      // 执行搜索
      const results = await this.executeSearch(searchParams);
      
      // 缓存结果
      this.cacheService.setCache(cacheKey, results, 300000); // 5分钟缓存
      this.performanceMonitor.updateCacheHitRate(false);
      
      const queryTime = Date.now() - startTime;
      this.performanceMonitor.recordQueryExecution(queryTime);
      
      const metrics: SearchMetrics = {
        queryTime,
        resultCount: results.length,
        cacheHit: false,
        queryType: searchParams.queryType
      };

      this.logger.info('Search executed successfully', {
        query,
        ...metrics,
        projectId: options.projectId
      });

      return { results, metrics };
    } catch (error) {
      const queryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Search failed', {
        query,
        options,
        queryTime,
        error: errorMessage
      });
      
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  async semanticSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'semantic' });
    return results;
  }

  async relationshipSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'relationship' });
    return results;
  }

  async pathSearch(sourceId: string, targetId: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(sourceId, { 
      ...options, 
      type: 'path', 
      targetNode: targetId 
    });
    return results;
  }

  async fuzzySearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { results } = await this.search(query, { ...options, type: 'fuzzy' });
    return results;
  }

  private buildSearchParams(query: string, options: SearchOptions) {
    return {
      query,
      queryType: options.type || 'semantic',
      filters: {
        nodeTypes: options.nodeTypes,
        relationshipTypes: options.relationshipTypes,
        projectId: options.projectId,
        filePath: options.filePath,
        minScore: options.minScore || 0.1,
        targetNode: options.targetNode,
        maxDepth: options.maxDepth || 5
      },
      pagination: {
        limit: options.limit || 10,
        offset: options.offset || 0
      },
      sortBy: options.sortBy || 'relevance'
    };
  }

  private generateCacheKey(params: any): string {
    return `search_${params.query}_${params.queryType}_${JSON.stringify(params.filters)}_${params.pagination.limit}`;
  }

  private async executeSearch(searchParams: any): Promise<SearchResult[]> {
    switch (searchParams.queryType) {
      case 'semantic':
        return await this.executeSemanticSearch(searchParams);
      case 'relationship':
        return await this.executeRelationshipSearch(searchParams);
      case 'path':
        return await this.executePathSearch(searchParams);
      case 'fuzzy':
        return await this.executeFuzzySearch(searchParams);
      default:
        return await this.executeSemanticSearch(searchParams);
    }
  }

  private async executeSemanticSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'semantic',
      filters: params.filters,
      pagination: params.pagination
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'semantic'));
    } catch (error) {
      this.logger.error('Semantic search failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private async executeRelationshipSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'relationship',
      filters: params.filters,
      pagination: params.pagination
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'relationship'));
    } catch (error) {
      this.logger.error('Relationship search failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private async executePathSearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'path',
      filters: params.filters,
      pagination: params.pagination
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'path'));
    } catch (error) {
      this.logger.error('Path search failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private async executeFuzzySearch(params: any): Promise<SearchResult[]> {
    const querySpec = this.queryBuilder.buildSearchQuery({
      query: params.query,
      queryType: 'fuzzy',
      filters: params.filters,
      pagination: params.pagination
    });

    try {
      const result = await this.nebulaService.executeReadQuery(
        querySpec.nGQL,
        querySpec.parameters
      );

      if (!result || !Array.isArray(result)) {
        return [];
      }

      return result.map(record => this.transformSearchResult(record, 'fuzzy'));
    } catch (error) {
      this.logger.error('Fuzzy search failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private transformSearchResult(record: any, queryType: string): SearchResult {
    const result: SearchResult = {
      id: '',
      type: 'unknown',
      name: '',
      properties: {},
      score: 0,
      queryType
    };

    if (record && typeof record === 'object') {
      if (record.vertex) {
        const vertex = record.vertex;
        result.id = vertex.vid || '';
        result.type = vertex.tags?.[0]?.name || 'unknown';
        result.name = vertex.tags?.[0]?.props?.name || '';
        result.properties = vertex.tags?.[0]?.props || {};
      } else if (record.v) {
        result.id = record.v.vid || '';
        result.type = record.v.tags?.[0]?.name || 'unknown';
        result.name = record.v.tags?.[0]?.props?.name || '';
        result.properties = record.v.tags?.[0]?.props || {};
      } else if (record.path) {
        result.path = record.path;
        result.type = 'path';
      } else {
        Object.assign(result, record);
      }
    }

    return result;
  }

  async getSearchMetrics(): Promise<any> {
    return this.performanceMonitor.getMetrics();
  }

  async clearSearchCache(): Promise<void> {
    this.cacheService.clearAllCache();
  }
}