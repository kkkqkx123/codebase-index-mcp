import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { IndexCoordinator } from './IndexCoordinator';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';
import { HashUtils } from '../../utils/HashUtils';
import { SearchCoordinator, SearchQuery } from '../search/SearchCoordinator';

export interface IndexOptions {
  recursive?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  chunkSize?: number;
  overlapSize?: number;
}

export interface IndexResult {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  chunksCreated: number;
  processingTime: number;
  errors: string[];
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
 includeGraph?: boolean;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
    snippetType?: string[];
  };
  searchType?: 'semantic' | 'keyword' | 'hybrid' | 'snippet';
}

export interface SearchResult {
  id: string;
  score: number;
  finalScore: number;
 filePath: string;
 content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  rankingFeatures?: {
    semanticScore?: number;
    keywordScore?: number;
    graphScore?: number;
  };
}

export interface IndexStatus {
  projectId: string;
  isIndexing: boolean;
  lastIndexed?: Date;
  fileCount: number;
  chunkCount: number;
  status: 'idle' | 'indexing' | 'error' | 'completed';
}

@injectable()
export class IndexService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private indexCoordinator: IndexCoordinator;
  private batchMetrics: BatchProcessingMetrics;
  private searchCoordinator: SearchCoordinator;
  
  private currentIndexing: Map<string, boolean> = new Map();
  private activeBatchOperations: Map<string, BatchOperationMetrics> = new Map();

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(IndexCoordinator) indexCoordinator: IndexCoordinator,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics,
    @inject(SearchCoordinator) searchCoordinator: SearchCoordinator
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.indexCoordinator = indexCoordinator;
    this.batchMetrics = batchMetrics;
    this.searchCoordinator = searchCoordinator;
  }

  async createIndex(projectPath: string, options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    this.logger.info('Starting index creation', { projectPath, projectId: projectId.hash });

    if (this.currentIndexing.get(projectId.hash)) {
      throw new Error(`Indexing already in progress for project: ${projectPath}`);
    }

    this.currentIndexing.set(projectId.hash, true);

    // Start batch operation metrics
    const operationId = `createIndex_${projectId.hash}_${Date.now()}`;
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'index',
      50 // Default batch size
    );
    this.activeBatchOperations.set(operationId, batchMetrics);

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.createIndex(projectPath, options);

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: result.filesProcessed,
        successCount: result.filesProcessed,
        errorCount: result.filesSkipped
      });

      this.logger.info('Index creation completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        processingTime: result.processingTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: IndexResult = {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [errorMessage]
      };

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: 1
      });

      this.logger.error('Index creation failed', {
        projectId: projectId.hash,
        error: errorMessage
      });

      return result;
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, true);
      this.activeBatchOperations.delete(operationId);
      this.currentIndexing.delete(projectId.hash);
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.logger.info('Performing search', { query, options });

    try {
      // Check if this is a snippet search
      if (options.searchType === 'snippet') {
        return await this.searchSnippets(query, options);
      }

      // Delegate to SearchCoordinator for semantic search
      const searchQuery: SearchQuery = {
        text: query,
        options: {
          limit: options.limit,
          threshold: options.threshold,
          includeGraph: options.includeGraph,
          useHybrid: false,
          useReranking: true
        }
      };

      const searchResponse = await this.searchCoordinator.search(searchQuery);
      return searchResponse.results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'search' }
      );
      throw error;
    }
  }

  private async searchSnippets(query: string, options: SearchOptions): Promise<SearchResult[]> {
    this.logger.info('Performing snippet search', { query, options });

    try {
      // Delegate to SearchCoordinator for snippet search
      const searchQuery: SearchQuery = {
        text: query,
        filters: options.filters,
        options: {
          limit: options.limit,
          threshold: options.threshold,
          useHybrid: false,
          useReranking: true
        }
      };

      const searchResponse = await this.searchCoordinator.search(searchQuery);
      return searchResponse.results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Snippet search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'searchSnippets' }
      );
      throw error;
    }
  }

  async getStatus(projectPath: string): Promise<IndexStatus> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    // Get actual status from IndexCoordinator
    const indexStatus = await this.indexCoordinator.getIndexStatus(projectId.hash);
    
    return {
      projectId: projectId.hash,
      isIndexing: this.currentIndexing.get(projectId.hash) || false,
      lastIndexed: indexStatus.lastIndexed,
      fileCount: indexStatus.fileCount,
      chunkCount: indexStatus.chunkCount,
      status: indexStatus.status
    };
 }

  async updateIndex(projectPath: string, changedFiles: string[]): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Starting index update', {
      projectPath,
      projectId: projectId.hash,
      changedFiles: changedFiles.length
    });

    if (this.currentIndexing.get(projectId.hash)) {
      const result: IndexResult = {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [`Indexing already in progress for project: ${projectPath}`]
      };

      this.logger.warn('Index update skipped - already in progress', { projectId: projectId.hash });
      return result;
    }

    this.currentIndexing.set(projectId.hash, true);

    // Start batch operation metrics
    const operationId = `updateIndex_${projectId.hash}_${Date.now()}`;
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'index',
      changedFiles.length
    );
    this.activeBatchOperations.set(operationId, batchMetrics);

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.updateIndex(projectPath, changedFiles);

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: result.filesProcessed,
        successCount: result.filesProcessed,
        errorCount: result.filesSkipped
      });

      this.logger.info('Index update completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        processingTime: result.processingTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: IndexResult = {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [errorMessage]
      };

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: 1
      });

      this.logger.error('Index update failed', {
        projectId: projectId.hash,
        error: errorMessage
      });

      return result;
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, true);
      this.activeBatchOperations.delete(operationId);
      this.currentIndexing.delete(projectId.hash);
    }
  }

  async deleteIndex(projectPath: string): Promise<boolean> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Deleting index', { projectPath, projectId: projectId.hash });

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.deleteIndex(projectPath);
      
      if (result) {
        this.logger.info('Index deleted successfully', { projectId: projectId.hash });
        return true;
      } else {
        this.logger.error('Failed to delete index', { projectId: projectId.hash });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to delete index', { 
        projectId: projectId.hash,
        error: errorMessage
      });
      return false;
    }
  }

  getActiveIndexing(): string[] {
    return Array.from(this.currentIndexing.entries())
      .filter(([_, isActive]) => isActive)
      .map(([projectId, _]) => projectId);
  }
}