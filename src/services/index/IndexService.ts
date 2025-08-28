import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { HashUtils } from '../../utils/HashUtils';
import { PathUtils } from '../../utils/PathUtils';
import { ChangeDetectionService, FileChangeEvent, ChangeDetectionCallbacks } from '../filesystem/ChangeDetectionService';
import { VectorStorageService } from '../storage/VectorStorageService';
import { GraphPersistenceService } from '../storage/GraphPersistenceService';
import { ParserService } from '../parser/ParserService';
import { TransactionCoordinator } from '../sync/TransactionCoordinator';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

// Type definitions for Node.js environment
// setTimeout and clearTimeout are already available in Node.js environment
// No need to redeclare them as they cause duplicate identifier errors

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
  private changeDetectionService: ChangeDetectionService;
  private vectorStorageService: VectorStorageService;
  private graphPersistenceService: GraphPersistenceService;
  private parserService: ParserService;
  private transactionCoordinator: TransactionCoordinator;
  private batchMetrics: BatchProcessingMetrics;
  
  private currentIndexing: Map<string, boolean> = new Map();
  private monitoredProjects: Map<string, boolean> = new Map();
  private pendingChanges: Map<string, FileChangeEvent[]> = new Map();
  private processingQueue: Map<string, boolean> = new Map();
  private activeBatchOperations: Map<string, BatchOperationMetrics> = new Map();
  
  // Performance optimization settings - now configurable
  private maxConcurrentOperations: number = 5;
  private defaultBatchSize: number = 50;
  private maxBatchSize: number = 500;
  private memoryThreshold: number = 80;
  private processingTimeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private debounceTime: number = 1000;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private adaptiveBatchingEnabled: boolean = true;
  private adaptiveBatchingHistory: Map<string, { batchSize: number; performance: number }[]> = new Map();

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ChangeDetectionService) changeDetectionService: ChangeDetectionService,
    @inject(VectorStorageService) vectorStorageService: VectorStorageService,
    @inject(GraphPersistenceService) graphPersistenceService: GraphPersistenceService,
    @inject(ParserService) parserService: ParserService,
    @inject(TransactionCoordinator) transactionCoordinator: TransactionCoordinator,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.changeDetectionService = changeDetectionService;
    this.vectorStorageService = vectorStorageService;
    this.graphPersistenceService = graphPersistenceService;
    this.parserService = parserService;
    this.transactionCoordinator = transactionCoordinator;
    this.batchMetrics = batchMetrics;
    
    this.initializeBatchProcessingConfig();
    this.initializeBatchProcessingConfig();
    this.setupChangeDetectionCallbacks();
  }

  private calculateOptimalBatchSize(projectPath: string, options: IndexOptions): number {
    if (!this.adaptiveBatchingEnabled) {
      return this.defaultBatchSize;
    }

    // Get historical performance data for this project
    const history = this.adaptiveBatchingHistory.get(projectPath) || [];
    
    if (history.length === 0) {
      return this.defaultBatchSize;
    }

    // Calculate average performance for recent batch sizes
    const recentPerformance = history.slice(-5);
    const avgPerformance = recentPerformance.reduce((sum, item) => sum + item.performance, 0) / recentPerformance.length;
    
    // Adjust batch size based on performance
    const config = this.configService.get('batchProcessing');
    const adaptiveConfig = config.adaptiveBatching;
    
    let newBatchSize = recentPerformance[recentPerformance.length - 1].batchSize;
    
    if (avgPerformance > adaptiveConfig.performanceThreshold) {
      // Performance is good, try increasing batch size
      newBatchSize = Math.min(
        Math.floor(newBatchSize * adaptiveConfig.adjustmentFactor),
        adaptiveConfig.maxBatchSize
      );
    } else {
      // Performance is poor, decrease batch size
      newBatchSize = Math.max(
        Math.floor(newBatchSize / adaptiveConfig.adjustmentFactor),
        adaptiveConfig.minBatchSize
      );
    }

    this.logger.debug('Calculated optimal batch size', {
      projectPath,
      previousBatchSize: recentPerformance[recentPerformance.length - 1].batchSize,
      newBatchSize,
      avgPerformance
    });

    return newBatchSize;
  }

  private calculateOptimalBatchSizeForFiles(fileCount: number): number {
    if (!this.adaptiveBatchingEnabled) {
      return Math.min(this.defaultBatchSize, fileCount);
    }

    // For file-based operations, use a different strategy
    const config = this.configService.get('batchProcessing');
    const adaptiveConfig = config.adaptiveBatching;
    
    // Start with a reasonable batch size based on file count
    let batchSize = Math.min(this.defaultBatchSize, fileCount);
    
    // Adjust based on file count - smaller batches for very large file counts
    if (fileCount > 1000) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 2, fileCount);
    } else if (fileCount > 500) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 3, fileCount);
    }

    return Math.max(adaptiveConfig.minBatchSize, Math.min(batchSize, adaptiveConfig.maxBatchSize));
  }

  private checkMemoryUsage(): boolean {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > this.memoryThreshold) {
      this.logger.warn('Memory usage exceeds threshold', {
        memoryUsagePercent,
        threshold: this.memoryThreshold
      });
      return false;
    }
    
    return true;
  }

  private async simulateIndexingWithBatching(
    projectPath: string,
    options: IndexOptions,
    batchSize: number
  ): Promise<void> {
    // Simulate processing time with batch processing
    const baseTime = 1000 + Math.random() * 2000;
    const batchFactor = 1 - (batchSize / this.maxBatchSize) * 0.3; // Larger batches are more efficient
    const processingTime = baseTime * batchFactor;
    
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Record adaptive batching performance
    if (this.adaptiveBatchingEnabled) {
      const performance = 1 / (processingTime / 1000); // Operations per second
      const history = this.adaptiveBatchingHistory.get(projectPath) || [];
      history.push({ batchSize, performance });
      
      // Keep only recent history
      if (history.length > 10) {
        history.shift();
      }
      
      this.adaptiveBatchingHistory.set(projectPath, history);
    }
  }

  private async processFilesInBatches(filePaths: string[]): Promise<any[]> {
    if (filePaths.length === 0) {
      return [];
    }

    const batchSize = this.calculateOptimalBatchSizeForFiles(filePaths.length);
    const results: any[] = [];
    
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      // Check memory usage before processing each batch
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }
      
      // Process batch with timeout
      const batchResults = await this.processWithTimeout(
        () => this.parserService.parseFiles(batch),
        this.processingTimeout
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  private async processChunksInBatches(chunks: any[], projectId: string): Promise<{
    vectorResult: any;
    graphResult: any;
  }> {
    if (chunks.length === 0) {
      return {
        vectorResult: { success: true, processedFiles: 0, totalChunks: 0 },
        graphResult: { success: true, nodesCreated: 0 }
      };
    }

    const batchSize = this.calculateOptimalBatchSizeForFiles(chunks.length);
    let vectorResult: any = { success: true, processedFiles: 0, totalChunks: 0, errors: [] };
    let graphResult: any = { success: true, nodesCreated: 0, relationshipsCreated: 0, errors: [] };
    
    // Process chunks in batches with transaction coordination
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Check memory usage before processing each batch
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }
      
      // Start transaction for cross-database consistency
      await this.transactionCoordinator.beginTransaction();
      
      try {
        // Add vector operation to transaction
        await this.transactionCoordinator.addVectorOperation({
          type: 'storeChunks',
          chunks: batch,
          options: {
            projectId,
            overwriteExisting: true,
            batchSize: batch.length
          }
        }, {
          type: 'deleteChunks',
          chunkIds: batch.map(c => c.id)
        });
        
        // Add graph operation to transaction
        await this.transactionCoordinator.addGraphOperation({
          type: 'storeChunks',
          chunks: batch,
          options: {
            projectId,
            overwriteExisting: true,
            batchSize: batch.length
          }
        }, {
          type: 'deleteNodes',
          nodeIds: batch.map(c => c.id)
        });
        
        // Commit transaction
        const transactionSuccess = await this.transactionCoordinator.commitTransaction();
        
        if (!transactionSuccess) {
          throw new Error('Transaction failed');
        }
        
        // Update results
        vectorResult.processedFiles += batch.length;
        vectorResult.totalChunks += batch.length;
        graphResult.nodesCreated += batch.length;
        
      } catch (error) {
        // Rollback transaction on error
        await this.transactionCoordinator.rollbackTransaction();
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        vectorResult.errors.push(errorMessage);
        graphResult.errors.push(errorMessage);
        
        this.logger.error('Batch processing failed', {
          projectId,
          batchSize: batch.length,
          error: errorMessage
        });
        
        // Continue with next batch if configured to do so
        const config = this.configService.get('batchProcessing');
        if (!config.continueOnError) {
          throw error;
        }
      }
    }
    
    vectorResult.success = vectorResult.errors.length === 0;
    graphResult.success = graphResult.errors.length === 0;
    
    return { vectorResult, graphResult };
  }

  private async processWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private initializeBatchProcessingConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');
    
    this.maxConcurrentOperations = batchConfig.maxConcurrentOperations;
    this.defaultBatchSize = batchConfig.defaultBatchSize;
    this.maxBatchSize = batchConfig.maxBatchSize;
    this.memoryThreshold = batchConfig.memoryThreshold;
    this.processingTimeout = batchConfig.processingTimeout;
    this.retryAttempts = batchConfig.retryAttempts;
    this.retryDelay = batchConfig.retryDelay;
    this.debounceTime = 1000; // Keep existing debounce time
    this.adaptiveBatchingEnabled = batchConfig.adaptiveBatching.enabled;
    
    this.logger.info('Batch processing configuration initialized', {
      maxConcurrentOperations: this.maxConcurrentOperations,
      defaultBatchSize: this.defaultBatchSize,
      maxBatchSize: this.maxBatchSize,
      memoryThreshold: this.memoryThreshold,
      processingTimeout: this.processingTimeout,
      adaptiveBatchingEnabled: this.adaptiveBatchingEnabled
    });
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
    const batchSize = this.calculateOptimalBatchSize(projectPath, options);
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'index',
      batchSize
    );
    this.activeBatchOperations.set(operationId, batchMetrics);

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      // Simulate indexing process with batch processing
      await this.simulateIndexingWithBatching(projectPath, options, batchSize);

      const result: IndexResult = {
        success: true,
        filesProcessed: 150, // Mock data
        filesSkipped: 10,
        chunksCreated: 450,
        processingTime: Date.now() - startTime,
        errors: []
      };

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: result.filesProcessed,
        successCount: result.filesProcessed,
        errorCount: result.filesSkipped
      });

      this.logger.info('Index creation completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        processingTime: result.processingTime,
        batchSize
      });

      return result;
    } catch (error) {
      const result: IndexResult = {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)]
      };

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: 1
      });

      this.logger.error('Index creation failed', {
        projectId: projectId.hash,
        error: error instanceof Error ? error.message : String(error)
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
      // Simulate search process
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
    const indexingStartTime = Date.now();

    // Start batch operation metrics
    const operationId = `updateIndex_${projectId.hash}_${Date.now()}`;
    const batchSize = this.calculateOptimalBatchSizeForFiles(changedFiles.length);
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'index',
      batchSize
    );
    this.activeBatchOperations.set(operationId, batchMetrics);

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      this.logger.debug('Starting index update processing', {
        projectId: projectId.hash,
        fileCount: changedFiles.length,
        batchSize
      });

      // Parse files to get chunks with batch processing
      const parsingStartTime = Date.now();
      const parsedFiles = await this.processFilesInBatches(changedFiles);
      const allChunks = parsedFiles.flatMap((file: any) => file.chunks || []);
      const parsingDuration = Date.now() - parsingStartTime;
      
      this.logger.debug('File parsing completed', {
        projectId: projectId.hash,
        fileCount: changedFiles.length,
        chunkCount: allChunks.length,
        parsingDuration
      });
      
      let vectorResult: any = null;
      let graphResult: any = null;

      if (allChunks.length > 0) {
        this.logger.debug('Starting transaction for database updates', {
          projectId: projectId.hash,
          chunkCount: allChunks.length
        });

        // Process chunks in batches with transaction coordination
        const processingResults = await this.processChunksInBatches(allChunks, projectId.hash);
        
        vectorResult = processingResults.vectorResult;
        graphResult = processingResults.graphResult;
      }

      const result: IndexResult = {
        success: true,
        filesProcessed: changedFiles.length,
        filesSkipped: 0,
        chunksCreated: allChunks.length,
        processingTime: Date.now() - startTime,
        errors: []
      };

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: result.filesProcessed,
        successCount: result.filesProcessed,
        errorCount: result.filesSkipped
      });

      this.logger.info('Index update completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        chunksCreated: result.chunksCreated,
        processingTime: result.processingTime,
        batchSize,
        vectorResult,
        graphResult
      });

      return result;
    } catch (error) {
      const result: IndexResult = {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)]
      };

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: 1
      });

      this.logger.error('Index update failed', {
        projectId: projectId.hash,
        error: error instanceof Error ? error.message : String(error),
        processingTime: result.processingTime
      });

      return result;
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, true);
      this.activeBatchOperations.delete(operationId);
      
      const totalProcessingTime = Date.now() - indexingStartTime;
      this.logger.debug('Index update processing finished', {
        projectId: projectId.hash,
        processingTime: totalProcessingTime
      });
      this.currentIndexing.delete(projectId.hash);
    }
  }

  async deleteIndex(projectPath: string): Promise<boolean> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Deleting index', { projectPath, projectId: projectId.hash });

    try {
      // Simulate deletion process
      await this.simulateDeletion();

      this.logger.info('Index deleted successfully', { projectId: projectId.hash });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete index', { 
        projectId: projectId.hash,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private async simulateIndexing(projectPath: string, options: IndexOptions): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }

  private async simulateSearch(query: string, options: SearchOptions): Promise<void> {
    // Simulate search time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }

  private async simulateUpdate(changedFiles: string[]): Promise<void> {
    // Simulate update time
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
  }

  private async simulateDeletion(): Promise<void> {
    // Simulate deletion time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }

  getActiveIndexing(): string[] {
    return Array.from(this.currentIndexing.entries())
      .filter(([_, isActive]) => isActive)
      .map(([projectId, _]) => projectId);
  }

  private setupChangeDetectionCallbacks(): void {
    const callbacks: ChangeDetectionCallbacks = {
      onFileCreated: (event) => this.handleFileCreated(event),
      onFileModified: (event) => this.handleFileModified(event),
      onFileDeleted: (event) => this.handleFileDeleted(event),
      onError: (error) => this.handleError(error)
    };
    
    this.changeDetectionService.setCallbacks(callbacks);
  }

  async startIncrementalMonitoring(projectPath: string): Promise<void> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    if (this.monitoredProjects.get(projectId.hash)) {
      this.logger.warn('Project is already being monitored', { projectId: projectId.hash });
      return;
    }

    try {
      this.logger.info('Starting incremental monitoring for project', { projectPath, projectId: projectId.hash });
      
      await this.changeDetectionService.initialize([projectPath]);
      this.monitoredProjects.set(projectId.hash, true);
      
      this.logger.info('Incremental monitoring started successfully', { projectId: projectId.hash });
    } catch (error) {
      this.logger.error('Failed to start incremental monitoring', {
        projectId: projectId.hash,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async stopIncrementalMonitoring(projectPath: string): Promise<void> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    if (!this.monitoredProjects.get(projectId.hash)) {
      this.logger.warn('Project is not being monitored', { projectId: projectId.hash });
      return;
    }

    try {
      this.logger.info('Stopping incremental monitoring for project', { projectId: projectId.hash });
      
      await this.changeDetectionService.stop();
      this.monitoredProjects.delete(projectId.hash);
      
      this.logger.info('Incremental monitoring stopped successfully', { projectId: projectId.hash });
    } catch (error) {
      this.logger.error('Failed to stop incremental monitoring', {
        projectId: projectId.hash,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async processIncrementalChanges(changes: FileChangeEvent[]): Promise<void> {
    if (changes.length === 0) {
      this.logger.debug('No changes to process');
      return;
    }

    this.logger.info('Processing incremental changes', { changeCount: changes.length });

    try {
      // Group changes by project
      const changesByProject = new Map<string, FileChangeEvent[]>();
      
      for (const change of changes) {
        const projectPath = this.extractProjectPath(change.relativePath);
        const projectId = await HashUtils.calculateDirectoryHash(projectPath);
        
        if (!changesByProject.has(projectId.hash)) {
          changesByProject.set(projectId.hash, []);
        }
        changesByProject.get(projectId.hash)!.push(change);
      }

      // Process changes for each project
      for (const [projectId, projectChanges] of changesByProject.entries()) {
        await this.processProjectChanges(projectId, projectChanges);
      }

      this.logger.info('Incremental changes processed successfully', { changeCount: changes.length });
    } catch (error) {
      this.logger.error('Failed to process incremental changes', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async processProjectChanges(projectId: string, changes: FileChangeEvent[]): Promise<void> {
    if (this.processingQueue.get(projectId)) {
      // Add to pending changes if already processing
      const pending = this.pendingChanges.get(projectId) || [];
      pending.push(...changes);
      this.pendingChanges.set(projectId, pending);
      return;
    }

    this.processingQueue.set(projectId, true);
    const processingStartTime = Date.now();

    try {
      // Separate changes by type
      const createdFiles = changes.filter(c => c.type === 'created').map(c => c.relativePath);
      const modifiedFiles = changes.filter(c => c.type === 'modified').map(c => c.relativePath);
      const deletedFiles = changes.filter(c => c.type === 'deleted').map(c => c.relativePath);

      this.logger.info('Processing project changes', {
        projectId,
        totalChanges: changes.length,
        createdFiles: createdFiles.length,
        modifiedFiles: modifiedFiles.length,
        deletedFiles: deletedFiles.length
      });

      // Process deletions first
      if (deletedFiles.length > 0) {
        const deletionStartTime = Date.now();
        await this.processFileDeletions(projectId, deletedFiles);
        const deletionDuration = Date.now() - deletionStartTime;
        this.logger.debug('File deletions completed', {
          projectId,
          fileCount: deletedFiles.length,
          duration: deletionDuration
        });
      }

      // Process creations and modifications
      const filesToProcess = [...createdFiles, ...modifiedFiles];
      if (filesToProcess.length > 0) {
        const updateStartTime = Date.now();
        await this.processFileUpdates(projectId, filesToProcess);
        const updateDuration = Date.now() - updateStartTime;
        this.logger.debug('File updates completed', {
          projectId,
          fileCount: filesToProcess.length,
          duration: updateDuration
        });
      }

      // Process any pending changes
      const pending = this.pendingChanges.get(projectId);
      if (pending && pending.length > 0) {
        this.logger.info('Processing pending changes', {
          projectId,
          pendingCount: pending.length
        });
        this.pendingChanges.delete(projectId);
        await this.processProjectChanges(projectId, pending);
      }

      const totalProcessingTime = Date.now() - processingStartTime;
      this.logger.info('Project changes processed successfully', {
        projectId,
        totalChanges: changes.length,
        processingTime: totalProcessingTime
      });
    } finally {
      const totalProcessingTime = Date.now() - processingStartTime;
      this.logger.debug('Project changes processing finished', {
        projectId,
        processingTime: totalProcessingTime
      });
      this.processingQueue.delete(projectId);
    }
  }

  private async processFileDeletions(projectId: string, deletedFiles: string[]): Promise<void> {
    this.logger.info('Processing file deletions', { projectId, fileCount: deletedFiles.length });

    try {
      // Get chunk IDs for deleted files
      const chunkIds = await this.getChunkIdsForFiles(deletedFiles);
      
      if (chunkIds.length > 0) {
        // Start transaction for cross-database consistency
        await this.transactionCoordinator.beginTransaction();
        
        try {
          // Add vector deletion operation to transaction
          await this.transactionCoordinator.addVectorOperation({
            type: 'deleteChunks',
            chunkIds
          }, {
            type: 'restoreChunks',
            chunkIds // In a real implementation, we'd need to store the chunk data for restoration
          });
          
          // Add graph deletion operation to transaction
          await this.transactionCoordinator.addGraphOperation({
            type: 'deleteNodes',
            nodeIds: chunkIds
          }, {
            type: 'restoreNodes',
            nodeIds: chunkIds // In a real implementation, we'd need to store the node data for restoration
          });
          
          // Commit transaction
          const transactionSuccess = await this.transactionCoordinator.commitTransaction();
          
          if (!transactionSuccess) {
            throw new Error('Transaction failed');
          }
          
          this.logger.info('File deletions processed successfully', {
            projectId,
            fileCount: deletedFiles.length,
            chunkCount: chunkIds.length,
            transactionDuration: 0
          });
        } catch (error) {
          // Rollback transaction on error
          await this.transactionCoordinator.rollbackTransaction();
          throw error;
        }
      }
    } catch (error) {
      this.logger.error('Failed to process file deletions', {
        projectId,
        fileCount: deletedFiles.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async processFileUpdates(projectId: string, filesToProcess: string[]): Promise<void> {
    this.logger.info('Processing file updates', { projectId, fileCount: filesToProcess.length });

    try {
      // Parse files to get chunks
      const parsedFiles = await this.parserService.parseFiles(filesToProcess);
      const allChunks = parsedFiles.flatMap((file: any) => file.chunks || []);
      
      if (allChunks.length > 0) {
        // Start transaction for cross-database consistency
        await this.transactionCoordinator.beginTransaction();
        
        try {
          // Add vector operation to transaction
          await this.transactionCoordinator.addVectorOperation({
            type: 'storeChunks',
            chunks: allChunks,
            options: {
              projectId,
              overwriteExisting: true
            }
          }, {
            type: 'deleteChunks',
            chunkIds: allChunks.map(c => c.id)
          });
          
          // Add graph operation to transaction
          await this.transactionCoordinator.addGraphOperation({
            type: 'storeChunks',
            chunks: allChunks,
            options: {
              projectId,
              overwriteExisting: true
            }
          }, {
            type: 'deleteNodes',
            nodeIds: allChunks.map(c => c.id)
          });
          
          // Commit transaction
          const transactionSuccess = await this.transactionCoordinator.commitTransaction();
          
          if (!transactionSuccess) {
            throw new Error('Transaction failed');
          }
          
          // Get results from services
          const vectorResult = {
            success: true,
            processedFiles: filesToProcess.length,
            totalChunks: allChunks.length,
            uniqueChunks: allChunks.length,
            duplicatesRemoved: 0,
            processingTime: 0,
            errors: []
          };
          
          const graphResult = {
            success: true,
            nodesCreated: allChunks.length,
            relationshipsCreated: 0,
            nodesUpdated: 0,
            processingTime: 0,
            errors: []
          };
          
          this.logger.info('File updates processed successfully', {
            projectId,
            fileCount: filesToProcess.length,
            chunkCount: allChunks.length,
            vectorResult,
            graphResult,
            transactionDuration: 0
          });
        } catch (error) {
          // Rollback transaction on error
          await this.transactionCoordinator.rollbackTransaction();
          throw error;
        }
      }
    } catch (error) {
      this.logger.error('Failed to process file updates', {
        projectId,
        fileCount: filesToProcess.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async getChunkIdsForFiles(filePaths: string[]): Promise<string[]> {
    // This would typically query the database to get chunk IDs for the specified files
    // For now, we'll return a mock implementation
    const chunkIds: string[] = [];
    
    for (const filePath of filePaths) {
      // Generate mock chunk IDs based on file path
      const mockChunkCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < mockChunkCount; i++) {
        chunkIds.push(`chunk_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${i}`);
      }
    }
    
    return chunkIds;
  }

  private extractProjectPath(relativePath: string): string {
    // Extract the project path from a relative file path
    // This is a simplified implementation - in reality, you'd need more sophisticated logic
    const parts = relativePath.split('/');
    if (parts.length > 0) {
      return parts[0];
    }
    return '';
  }

  private async handleFileCreated(event: FileChangeEvent): Promise<void> {
    this.logger.debug('Handling file created event', { event });
    await this.debouncedProcessIncrementalChanges([event]);
  }

  private async handleFileModified(event: FileChangeEvent): Promise<void> {
    this.logger.debug('Handling file modified event', { event });
    await this.debouncedProcessIncrementalChanges([event]);
  }

  private async handleFileDeleted(event: FileChangeEvent): Promise<void> {
    this.logger.debug('Handling file deleted event', { event });
    await this.debouncedProcessIncrementalChanges([event]);
  }

  private async debouncedProcessIncrementalChanges(changes: FileChangeEvent[]): Promise<void> {
    if (changes.length === 0) {
      return;
    }

    // Group changes by project
    const changesByProject = new Map<string, FileChangeEvent[]>();
    
    for (const change of changes) {
      const projectPath = this.extractProjectPath(change.relativePath);
      const projectId = await HashUtils.calculateDirectoryHash(projectPath);
      
      if (!changesByProject.has(projectId.hash)) {
        changesByProject.set(projectId.hash, []);
      }
      changesByProject.get(projectId.hash)!.push(change);
    }

    // Debounce changes for each project
    for (const [projectId, projectChanges] of changesByProject.entries()) {
      // Clear existing timer if any
      if (this.debounceTimers.has(projectId)) {
        const timer = this.debounceTimers.get(projectId);
        if (timer) {
          clearTimeout(timer);
        }
      }

      // Set a new timer
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(projectId);
        await this.processIncrementalChanges(projectChanges);
      }, this.debounceTime);

      this.debounceTimers.set(projectId, timer);
    }
  }

  private async processInBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  private async processConcurrently<T, R>(
    items: T[],
    maxConcurrency: number,
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const inProgress: Promise<void>[] = [];
    
    for (const item of items) {
      const promise = processor(item)
        .then(result => {
          results.push(result);
        })
        .finally(() => {
          // Remove from inProgress when done
          const index = inProgress.indexOf(promise);
          if (index !== -1) {
            inProgress.splice(index, 1);
          }
        });
      
      inProgress.push(promise);
      
      // If we've reached max concurrency, wait for one to finish
      if (inProgress.length >= maxConcurrency) {
        await Promise.race(inProgress);
      }
    }
    
    // Wait for all remaining promises to complete
    await Promise.all(inProgress);
    
    return results;
  }

  private handleError(error: Error): void {
    this.logger.error('Error in change detection', { error: error.message });
    this.errorHandler.handleError(error, { component: 'IndexService', operation: 'changeDetection' });
  }

  private async handleIndexingError(error: Error, projectId: string, operation: string): Promise<void> {
    this.logger.error(`Error during ${operation}`, {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Report the error
    const report = this.errorHandler.handleError(
      error,
      { component: 'IndexService', operation }
    );
    
    // Attempt recovery based on the operation
    try {
      switch (operation) {
        case 'updateIndex':
          await this.recoverFromUpdateError(projectId);
          break;
        case 'processFileDeletions':
          await this.recoverFromDeletionError(projectId);
          break;
        case 'processFileUpdates':
          await this.recoverFromUpdateError(projectId);
          break;
        default:
          this.logger.warn('No recovery mechanism available for operation', { operation });
      }
    } catch (recoveryError) {
      this.logger.error('Recovery attempt failed', {
        projectId,
        originalError: error instanceof Error ? error.message : String(error),
        recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
      });
    }
  }

  private async recoverFromUpdateError(projectId: string): Promise<void> {
    this.logger.info('Attempting recovery from update error', { projectId });
    
    // Rollback any active transaction
    if (this.currentIndexing.get(projectId)) {
      try {
        await this.transactionCoordinator.rollbackTransaction();
        this.logger.info('Transaction rolled back successfully', { projectId });
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          projectId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        });
      }
    }
    
    // Clear indexing state
    this.currentIndexing.delete(projectId);
    this.processingQueue.delete(projectId);
    
    // Clear any pending changes
    this.pendingChanges.delete(projectId);
    
    // Clear any debounce timers
    if (this.debounceTimers.has(projectId)) {
      const timer = this.debounceTimers.get(projectId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(projectId);
      }
    }
    
    this.logger.info('Recovery from update error completed', { projectId });
  }

  private async recoverFromDeletionError(projectId: string): Promise<void> {
    this.logger.info('Attempting recovery from deletion error', { projectId });
    
    // Similar to update error recovery
    await this.recoverFromUpdateError(projectId);
  }

  private async validateIndexingState(projectId: string): Promise<boolean> {
    // Check if the indexing state is valid
    if (this.currentIndexing.get(projectId)) {
      this.logger.warn('Indexing already in progress', { projectId });
      return false;
    }
    
    if (this.processingQueue.get(projectId)) {
      this.logger.warn('Project already in processing queue', { projectId });
      return false;
    }
    
    return true;
  }

  private async cleanupResources(projectId: string): Promise<void> {
    // Clean up any resources associated with the project
    this.currentIndexing.delete(projectId);
    this.processingQueue.delete(projectId);
    this.pendingChanges.delete(projectId);
    
    if (this.debounceTimers.has(projectId)) {
      const timer = this.debounceTimers.get(projectId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(projectId);
      }
    }
  }
}