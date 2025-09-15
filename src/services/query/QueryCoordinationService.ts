import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { VectorStorageService } from '../storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../storage/graph/GraphPersistenceService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { ResultFusionEngine } from './ResultFusionEngine';
import { QueryOptimizer } from './QueryOptimizer';
import { QueryCache } from './QueryCache';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ResultFormatter } from './ResultFormatter';

export interface QueryRequest {
  query: string;
  projectId: string;
  options?: {
    limit?: number;
    threshold?: number;
    includeGraph?: boolean;
    filters?: {
      language?: string[];
      fileType?: string[];
      path?: string[];
    };
    searchType?: 'semantic' | 'hybrid' | 'graph';
  };
}

export interface QueryResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  graphContext?: {
    dependencies: string[];
    relationships: Array<{
      type: string;
      target: string;
      strength: number;
    }>;
  };
}

export interface QueryMetrics {
  queryId: string;
  executionTime: number;
  vectorSearchTime: number;
  graphSearchTime: number;
  fusionTime: number;
  totalResults: number;
  cacheHit: boolean;
  performance: {
    throughput: number;
    latency: number;
    successRate: number;
  };
}

@injectable()
export class QueryCoordinationService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private vectorStorage: VectorStorageService;
  private graphStorage: GraphPersistenceService;
  private embedderFactory: EmbedderFactory;
  private resultFusion: ResultFusionEngine;
  private queryOptimizer: QueryOptimizer;
  private queryCache: QueryCache;
  private performanceMonitor: PerformanceMonitor;
  private resultFormatter: ResultFormatter;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.VectorStorageService) vectorStorage: VectorStorageService,
    @inject(TYPES.GraphPersistenceService) graphStorage: GraphPersistenceService,
    @inject(TYPES.EmbedderFactory) embedderFactory: EmbedderFactory,
    @inject(ResultFusionEngine) resultFusion: ResultFusionEngine,
    @inject(QueryOptimizer) queryOptimizer: QueryOptimizer,
    @inject(TYPES.QueryCache) queryCache: QueryCache,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.ResultFormatter) resultFormatter: ResultFormatter
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.vectorStorage = vectorStorage;
    this.graphStorage = graphStorage;
    this.embedderFactory = embedderFactory;
    this.resultFusion = resultFusion;
    this.queryOptimizer = queryOptimizer;
    this.queryCache = queryCache;
    this.performanceMonitor = performanceMonitor;
    this.resultFormatter = resultFormatter;
  }

  async executeQuery(request: QueryRequest): Promise<{
    results: QueryResult[];
    metrics: QueryMetrics;
    formattedResults?: any;
  }> {
    const queryId = this.generateQueryId(request);
    const startTime = Date.now();

    this.logger.info('Executing query', {
      queryId,
      query: request.query,
      projectId: request.projectId,
    });

    try {
      // Check cache first
      const cachedResult = await this.queryCache.get(request);
      if (cachedResult) {
        this.logger.info('Query cache hit', { queryId });
        return {
          results: cachedResult,
          metrics: {
            queryId,
            executionTime: Date.now() - startTime,
            vectorSearchTime: 0,
            graphSearchTime: 0,
            fusionTime: 0,
            totalResults: cachedResult.length,
            cacheHit: true,
            performance: {
              throughput: cachedResult.length / ((Date.now() - startTime) / 1000),
              latency: Date.now() - startTime,
              successRate: 1,
            },
          },
        };
      }

      // Optimize query
      const optimizedQuery = await this.queryOptimizer.optimize(request);

      // Execute parallel searches
      // Convert OptimizedQuery to QueryRequest for execution
      const queryRequest: QueryRequest = {
        query: optimizedQuery.originalQuery,
        projectId: '', // Will be set by the caller
        options: {
          limit: 10,
          searchType: optimizedQuery.searchStrategy.type as 'graph' | 'semantic' | 'hybrid',
        },
      };

      const [vectorResults, graphResults] = await Promise.all([
        this.executeVectorSearch(queryRequest),
        this.executeGraphSearch(queryRequest),
      ]);

      // Fuse results
      const fusionStartTime = Date.now();
      const fusedResults = await this.resultFusion.fuse({
        vectorResults: vectorResults.results,
        graphResults: graphResults.results,
        query: optimizedQuery.originalQuery,
        options: {
          limit: 10,
          searchType: optimizedQuery.searchStrategy.type as 'graph' | 'semantic' | 'hybrid',
        },
      });
      const fusionTime = Date.now() - fusionStartTime;

      // Cache results
      await this.queryCache.set(request, fusedResults);

      const totalExecutionTime = Date.now() - startTime;
      const metrics: QueryMetrics = {
        queryId,
        executionTime: totalExecutionTime,
        vectorSearchTime: vectorResults.executionTime,
        graphSearchTime: graphResults.executionTime,
        fusionTime,
        totalResults: fusedResults.length,
        cacheHit: false,
        performance: {
          throughput: fusedResults.length / (totalExecutionTime / 1000),
          latency: totalExecutionTime,
          successRate: 1,
        },
      };

      // Record performance metrics
      await this.performanceMonitor.recordQuery(metrics);

      this.logger.info('Query execution completed', {
        queryId,
        resultCount: fusedResults.length,
        executionTime: totalExecutionTime,
      });

      return {
        results: fusedResults,
        metrics,
        formattedResults: await this.resultFormatter.formatForLLM(fusedResults),
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Query execution failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCoordinationService', operation: 'executeQuery', metadata: { queryId } }
      );
      throw error;
    }
  }

  async executeBatchQueries(requests: QueryRequest[]): Promise<{
    results: Array<{
      query: string;
      results: QueryResult[];
      metrics: QueryMetrics;
      formattedResults?: any;
    }>;
    totalMetrics: {
      totalQueries: number;
      totalExecutionTime: number;
      averageExecutionTime: number;
      throughput: number;
      successRate: number;
    };
  }> {
    const startTime = Date.now();

    this.logger.info('Executing batch queries', {
      queryCount: requests.length,
    });

    try {
      const results = await Promise.all(requests.map(request => this.executeQuery(request)));

      const totalExecutionTime = Date.now() - startTime;
      const totalMetrics = {
        totalQueries: requests.length,
        totalExecutionTime,
        averageExecutionTime: totalExecutionTime / requests.length,
        throughput:
          results.reduce((sum, r) => sum + r.results.length, 0) / (totalExecutionTime / 1000),
        successRate: results.filter(r => r.results.length > 0).length / requests.length,
      };

      this.logger.info('Batch query execution completed', {
        queryCount: requests.length,
        totalExecutionTime,
        throughput: totalMetrics.throughput,
      });

      return {
        results: await Promise.all(
          results.map(async (result, index) => ({
            query: requests[index].query,
            results: result.results,
            metrics: result.metrics,
            formattedResults: await this.resultFormatter.formatForLLM(result.results),
          }))
        ),
        totalMetrics,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Batch query execution failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryCoordinationService', operation: 'executeBatchQueries' }
      );
      throw error;
    }
  }

  async getQueryPerformanceStats(timeRange: { start: Date; end: Date }): Promise<{
    totalQueries: number;
    averageLatency: number;
    cacheHitRate: number;
    throughput: number;
    errorRate: number;
    topQueries: Array<{
      query: string;
      count: number;
      avgLatency: number;
    }>;
  }> {
    return await this.performanceMonitor.getStats(timeRange);
  }

  private async executeVectorSearch(request: QueryRequest): Promise<{
    results: any[];
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      const embedder = await this.embedderFactory.getEmbedder();
      const queryEmbedding = await embedder.embed({ text: request.query });
      const embeddingVector = Array.isArray(queryEmbedding)
        ? queryEmbedding[0].vector
        : queryEmbedding.vector;

      const results = await this.vectorStorage.searchVectors(embeddingVector, {
        limit: request.options?.limit || 10,
        filter: request.options?.filters,
      });

      return {
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Vector search failed', { error });
      return {
        results: [],
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async executeGraphSearch(request: QueryRequest): Promise<{
    results: any[];
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      if (!request.options?.includeGraph) {
        return {
          results: [],
          executionTime: Date.now() - startTime,
        };
      }

      // For now, return empty results as graph search is not implemented
      const results: any[] = [];

      return {
        results,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error('Graph search failed', { error });
      return {
        results: [],
        executionTime: Date.now() - startTime,
      };
    }
  }

  private generateQueryId(request: QueryRequest): string {
    const timestamp = Date.now();
    const queryHash = this.hashString(request.query);
    return `query_${timestamp}_${queryHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
