import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { IndexCoordinator } from './IndexCoordinator';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';
import { HashUtils } from '../../utils/HashUtils';

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
  };
}

export interface SearchResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
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
  
  private currentIndexing: Map<string, boolean> = new Map();
  private activeBatchOperations: Map<string, BatchOperationMetrics> = new Map();

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(IndexCoordinator) indexCoordinator: IndexCoordinator,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.indexCoordinator = indexCoordinator;
    this.batchMetrics = batchMetrics;
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
      // Simulate search process - in real implementation, this would delegate to search services
      await this.simulateSearch(query, options);

      // Mock search results
      const mockResults: SearchResult[] = [
        {
          id: 'result_1',
          score: 0.95,
          filePath: '/src/components/Button.tsx',
          content: 'export function Button({ onClick, children }: ButtonProps) {',
          startLine: 15,
          endLine: 25,
          language: 'typescript',
          chunkType: 'function',
          metadata: { functionName: 'Button', component: true }
        },
        {
          id: 'result_2',
          score: 0.87,
          filePath: '/src/hooks/useAuth.ts',
          content: 'export function useAuth() {',
          startLine: 8,
          endLine: 20,
          language: 'typescript',
          chunkType: 'function',
          metadata: { functionName: 'useAuth', hook: true }
        }
      ];

      return mockResults.slice(0, options.limit || 10);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'search' }
      );
      throw error;
    }
  }

  async getStatus(projectPath: string): Promise<IndexStatus> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    return {
      projectId: projectId.hash,
      isIndexing: this.currentIndexing.get(projectId.hash) || false,
      lastIndexed: new Date(), // Mock data
      fileCount: 150,
      chunkCount: 450,
      status: 'completed'
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

  private async simulateSearch(query: string, options: SearchOptions): Promise<void> {
    // Simulate search time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }
}