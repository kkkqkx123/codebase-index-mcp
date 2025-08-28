import { injectable, inject } from 'inversify';
import { QdrantClientWrapper, VectorPoint, SearchOptions, SearchResult } from '../qdrant/QdrantClientWrapper';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

export interface VectorStorageConfig {
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  recreateCollection: boolean;
}

export interface IndexingOptions {
  projectId?: string;
  batchSize?: number;
  skipDeduplication?: boolean;
  overwriteExisting?: boolean;
}

export interface IndexingResult {
  success: boolean;
  processedFiles: number;
  totalChunks: number;
  uniqueChunks: number;
  duplicatesRemoved: number;
  processingTime: number;
  errors: string[];
}

@injectable()
export class VectorStorageService {
  private qdrantClient: QdrantClientWrapper;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private config: VectorStorageConfig;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  private isInitialized: boolean = false;
  
  // Batch processing configuration
  private maxConcurrentOperations: number = 5;
  private defaultBatchSize: number = 100;
  private maxBatchSize: number = 1000;
  private memoryThreshold: number = 80;
  private processingTimeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private adaptiveBatchingEnabled: boolean = true;

  constructor(
    @inject(QdrantClientWrapper) qdrantClient: QdrantClientWrapper,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.qdrantClient = qdrantClient;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.batchMetrics = batchMetrics;

    const qdrantConfig = configService.get('qdrant');
    this.config = {
      collectionName: qdrantConfig.collection,
      vectorSize: 1536, // Default OpenAI embedding size
      distance: 'Cosine',
      recreateCollection: false
    };
    
    this.initializeBatchProcessingConfig();
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.qdrantClient.isConnectedToDatabase()) {
        const connected = await this.qdrantClient.connect();
        if (!connected) {
          throw new Error('Failed to connect to Qdrant');
        }
      }

      const collectionExists = await this.qdrantClient.collectionExists(this.config.collectionName);
      
      if (!collectionExists || this.config.recreateCollection) {
        const created = await this.qdrantClient.createCollection(
          this.config.collectionName,
          this.config.vectorSize,
          this.config.distance,
          this.config.recreateCollection
        );

        if (!created) {
          throw new Error(`Failed to create collection ${this.config.collectionName}`);
        }
      }

      const collectionInfo = await this.qdrantClient.getCollectionInfo(this.config.collectionName);
      if (!collectionInfo) {
        throw new Error(`Failed to get collection info for ${this.config.collectionName}`);
      }

      this.logger.info('Vector storage service initialized', {
        collectionName: this.config.collectionName,
        vectorSize: collectionInfo.vectors.size,
        pointsCount: collectionInfo.pointsCount,
        status: collectionInfo.status
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to initialize vector storage: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'initialize' }
      );
      this.logger.error('Failed to initialize vector storage', { errorId: report.id });
      return false;
    }
  }

  async storeChunks(chunks: CodeChunk[], options: IndexingOptions = {}): Promise<IndexingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `storeChunks_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(chunks.length);
    
    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'vector',
      batchSize
    );

    const result: IndexingResult = {
      success: false,
      processedFiles: 0,
      totalChunks: chunks.length,
      uniqueChunks: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      // Process chunks in batches with optimized conversion
      const vectorPoints = await this.convertChunksToVectorPointsOptimized(chunks, options, batchSize);
      
      if (vectorPoints.length === 0) {
        result.success = true;
        result.processingTime = Date.now() - startTime;
        
        // Update batch metrics
        this.batchMetrics.updateBatchOperation(operationId, {
          processedCount: chunks.length,
          successCount: chunks.length,
          errorCount: 0
        });
        
        return result;
      }

      // Store vector points with retry logic
      const success = await this.retryOperation(() =>
        this.qdrantClient.upsertPoints(this.config.collectionName, vectorPoints)
      );
      
      if (success) {
        result.success = true;
        result.uniqueChunks = vectorPoints.length;
        result.duplicatesRemoved = chunks.length - vectorPoints.length;
        result.processingTime = Date.now() - startTime;
        
        // Update batch metrics
        this.batchMetrics.updateBatchOperation(operationId, {
          processedCount: chunks.length,
          successCount: result.uniqueChunks,
          errorCount: result.duplicatesRemoved
        });
        
        this.logger.info('Chunks stored successfully', {
          totalChunks: chunks.length,
          uniqueChunks: vectorPoints.length,
          duplicatesRemoved: result.duplicatesRemoved,
          processingTime: result.processingTime,
          batchSize
        });
      } else {
        throw new Error('Failed to upsert vector points');
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to store chunks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'storeChunks' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store chunks', { errorId: report.id });
      
      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: chunks.length
      });
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
    }

    return result;
  }

  async searchVectors(queryVector: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.qdrantClient.searchVectors(this.config.collectionName, queryVector, options);
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to search vectors: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'searchVectors' }
      );
      this.logger.error('Failed to search vectors', { errorId: report.id });
      return [];
    }
  }

  async deleteChunks(chunkIds: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.qdrantClient.deletePoints(this.config.collectionName, chunkIds);
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete chunks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'deleteChunks' }
      );
      this.logger.error('Failed to delete chunks', { errorId: report.id, chunkCount: chunkIds.length });
      return false;
    }
  }

  async clearCollection(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.qdrantClient.clearCollection(this.config.collectionName);
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to clear collection: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'clearCollection' }
      );
      this.logger.error('Failed to clear collection', { errorId: report.id });
      return false;
    }
  }

  async getCollectionStats(): Promise<{
    totalPoints: number;
    collectionInfo: any;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [pointCount, collectionInfo] = await Promise.all([
        this.qdrantClient.getPointCount(this.config.collectionName),
        this.qdrantClient.getCollectionInfo(this.config.collectionName)
      ]);

      return {
        totalPoints: pointCount,
        collectionInfo
      };
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to get collection stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'getCollectionStats' }
      );
      this.logger.error('Failed to get collection stats', { errorId: report.id });
      return {
        totalPoints: 0,
        collectionInfo: null
      };
    }
  }

  private async convertChunksToVectorPoints(chunks: CodeChunk[], options: IndexingOptions): Promise<VectorPoint[]> {
    const vectorPoints: VectorPoint[] = [];
    const batchSize = options.batchSize || 100;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      for (const chunk of batch) {
        try {
          const vector = await this.generateEmbedding(chunk.content);
          
          const vectorPoint: VectorPoint = {
            id: chunk.id,
            vector,
            payload: {
              content: chunk.content,
              filePath: chunk.metadata.filePath || '',
              language: chunk.metadata.language || 'unknown',
              chunkType: chunk.type,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              functionName: chunk.functionName,
              className: chunk.className,
              imports: chunk.imports,
              exports: chunk.exports,
              metadata: {
                ...chunk.metadata,
                complexity: chunk.metadata.complexity || 1,
                parameters: chunk.metadata.parameters || [],
                returnType: chunk.metadata.returnType || 'unknown'
              },
              timestamp: new Date(),
              projectId: options.projectId
            }
          };

          vectorPoints.push(vectorPoint);
        } catch (error) {
          this.logger.warn('Failed to generate embedding for chunk', {
            chunkId: chunk.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return vectorPoints;
  }

  private async generateEmbedding(content: string): Promise<number[]> {
    // This is a placeholder implementation
    // In a real implementation, this would use the configured embedding provider
    // For now, we'll generate a random vector of the correct size
    const vector: number[] = [];
    for (let i = 0; i < this.config.vectorSize; i++) {
      vector.push(Math.random() * 2 - 1); // Random values between -1 and 1
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vector.map(val => val / magnitude);
    }
    
    return vector;
  }

  async updateConfig(newConfig: Partial<VectorStorageConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Vector storage config updated', { config: this.config });
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
    this.adaptiveBatchingEnabled = batchConfig.adaptiveBatching.enabled;
    
    this.logger.info('Vector storage batch processing configuration initialized', {
      maxConcurrentOperations: this.maxConcurrentOperations,
      defaultBatchSize: this.defaultBatchSize,
      maxBatchSize: this.maxBatchSize,
      memoryThreshold: this.memoryThreshold,
      processingTimeout: this.processingTimeout,
      adaptiveBatchingEnabled: this.adaptiveBatchingEnabled
    });
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

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts,
    delayMs: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          this.logger.debug('Operation failed, retrying', {
            attempt,
            maxAttempts,
            error: lastError.message
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError;
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  async updateChunks(chunks: CodeChunk[], options: IndexingOptions = {}): Promise<IndexingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `updateChunks_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(chunks.length);
    
    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'vector',
      batchSize
    );

    const result: IndexingResult = {
      success: false,
      processedFiles: 0,
      totalChunks: chunks.length,
      uniqueChunks: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      // For incremental updates, we need to:
      // 1. Check which chunks already exist
      // 2. Only update the chunks that have changed
      // 3. Delete chunks that no longer exist (if specified in options)
      
      const existingChunkIds = await this.getExistingChunkIds(chunks.map(c => c.id));
      const chunksToUpdate = chunks.filter(chunk => existingChunkIds.includes(chunk.id));
      const chunksToCreate = chunks.filter(chunk => !existingChunkIds.includes(chunk.id));
      
      let updatedCount = 0;
      let createdCount = 0;
      
      // Update existing chunks in batches
      if (chunksToUpdate.length > 0) {
        const updateBatchSize = this.calculateOptimalBatchSize(chunksToUpdate.length);
        const updateResults = await this.processChunksInBatches(
          chunksToUpdate,
          options,
          updateBatchSize,
          'update'
        );
        
        if (updateResults.success) {
          updatedCount = chunksToUpdate.length;
        } else {
          throw new Error('Failed to update existing chunks');
        }
      }
      
      // Create new chunks in batches
      if (chunksToCreate.length > 0) {
        const createBatchSize = this.calculateOptimalBatchSize(chunksToCreate.length);
        const createResults = await this.processChunksInBatches(
          chunksToCreate,
          options,
          createBatchSize,
          'create'
        );
        
        if (createResults.success) {
          createdCount = chunksToCreate.length;
        } else {
          throw new Error('Failed to create new chunks');
        }
      }
      
      result.success = true;
      result.processedFiles = this.extractUniqueFileCount(chunks);
      result.uniqueChunks = createdCount + updatedCount;
      result.duplicatesRemoved = 0; // No duplicates in incremental update
      result.processingTime = Date.now() - startTime;
      
      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: chunks.length,
        successCount: result.uniqueChunks,
        errorCount: result.duplicatesRemoved
      });
      
      this.logger.info('Chunks updated incrementally', {
        totalChunks: chunks.length,
        createdChunks: createdCount,
        updatedChunks: updatedCount,
        processingTime: result.processingTime,
        batchSize
      });
      
      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to update chunks incrementally: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'updateChunks' }
      );
      result.errors.push(`Incremental update failed: ${report.id}`);
      this.logger.error('Failed to update chunks incrementally', { errorId: report.id });
      
      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: chunks.length
      });
      
      return result;
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
    }
  }

  async deleteChunksByFiles(filePaths: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get all chunk IDs for the specified files
      const chunkIds = await this.getChunkIdsByFiles(filePaths);
      
      if (chunkIds.length === 0) {
        this.logger.debug('No chunks found for files', { filePaths });
        return true;
      }
      
      // Delete the chunks
      const success = await this.qdrantClient.deletePoints(this.config.collectionName, chunkIds);
      
      if (success) {
        this.logger.info('Chunks deleted by files', {
          fileCount: filePaths.length,
          chunkCount: chunkIds.length
        });
      }
      
      return success;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete chunks by files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'deleteChunksByFiles' }
      );
      this.logger.error('Failed to delete chunks by files', {
        errorId: report.id,
        fileCount: filePaths.length
      });
      return false;
    }
  }

  private async getExistingChunkIds(chunkIds: string[]): Promise<string[]> {
    // This would typically query the vector database to check which chunks exist
    // For now, we'll return a mock implementation
    return chunkIds.filter(() => Math.random() > 0.5); // Randomly return half the chunk IDs
  }

  private async getChunkIdsByFiles(filePaths: string[]): Promise<string[]> {
    // This would typically query the vector database to get chunk IDs for the specified files
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

  private extractUniqueFileCount(chunks: CodeChunk[]): number {
    const uniqueFiles = new Set<string>();
    
    for (const chunk of chunks) {
      if (chunk.metadata.filePath) {
        uniqueFiles.add(chunk.metadata.filePath);
      }
    }
    
    return uniqueFiles.size;
  }

  private calculateOptimalBatchSize(totalItems: number): number {
    if (!this.adaptiveBatchingEnabled) {
      return Math.min(this.defaultBatchSize, totalItems);
    }

    // For vector operations, use a different strategy based on item count
    const config = this.configService.get('batchProcessing');
    const adaptiveConfig = config.adaptiveBatching;
    
    // Start with a reasonable batch size based on total items
    let batchSize = Math.min(this.defaultBatchSize, totalItems);
    
    // Adjust based on item count - smaller batches for very large item counts
    if (totalItems > 1000) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 2, totalItems);
    } else if (totalItems > 500) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 3, totalItems);
    }

    return Math.max(adaptiveConfig.minBatchSize, Math.min(batchSize, adaptiveConfig.maxBatchSize));
  }

  private async convertChunksToVectorPointsOptimized(
    chunks: CodeChunk[],
    options: IndexingOptions,
    batchSize: number
  ): Promise<VectorPoint[]> {
    if (chunks.length === 0) {
      return [];
    }

    const vectorPoints: VectorPoint[] = [];
    
    // Process chunks in batches with concurrent embedding generation
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Check memory usage before processing each batch
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }
      
      // Generate embeddings for the batch with timeout and retry
      const batchVectorPoints = await this.processWithTimeout(
        () => this.generateEmbeddingsForBatch(batch, options),
        this.processingTimeout
      );
      
      vectorPoints.push(...batchVectorPoints);
    }
    
    return vectorPoints;
  }

  private async generateEmbeddingsForBatch(
    batch: CodeChunk[],
    options: IndexingOptions
  ): Promise<VectorPoint[]> {
    // Generate embeddings concurrently for better performance
    const embeddingPromises = batch.map(async (chunk) => {
      try {
        const vector = await this.generateEmbedding(chunk.content);
        
        return {
          id: chunk.id,
          vector,
          payload: {
            content: chunk.content,
            filePath: chunk.metadata.filePath || '',
            language: chunk.metadata.language || 'unknown',
            chunkType: chunk.type,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            functionName: chunk.functionName,
            className: chunk.className,
            imports: chunk.imports,
            exports: chunk.exports,
            metadata: {
              ...chunk.metadata,
              complexity: chunk.metadata.complexity || 1,
              parameters: chunk.metadata.parameters || [],
              returnType: chunk.metadata.returnType || 'unknown'
            },
            timestamp: new Date(),
            projectId: options.projectId
          }
        };
      } catch (error) {
        this.logger.warn('Failed to generate embedding for chunk', {
          chunkId: chunk.id,
          error: error instanceof Error ? error.message : String(error)
        });
        return null; // Filter out failed chunks
      }
    });

    // Wait for all embeddings to complete and filter out null results
    const results = await Promise.all(embeddingPromises);
    return results.filter((point): point is VectorPoint => point !== null);
  }

  private async processChunksInBatches(
    chunks: CodeChunk[],
    options: IndexingOptions,
    batchSize: number,
    operationType: 'create' | 'update'
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const result: IndexingResult = {
      success: false,
      processedFiles: 0,
      totalChunks: chunks.length,
      uniqueChunks: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      errors: []
    };

    try {
      const vectorPoints = await this.convertChunksToVectorPointsOptimized(chunks, options, batchSize);
      
      if (vectorPoints.length === 0) {
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Store vector points with retry logic
      const success = await this.retryOperation(() =>
        this.qdrantClient.upsertPoints(this.config.collectionName, vectorPoints)
      );
      
      if (success) {
        result.success = true;
        result.uniqueChunks = vectorPoints.length;
        result.duplicatesRemoved = chunks.length - vectorPoints.length;
        result.processingTime = Date.now() - startTime;
        
        this.logger.debug(`Chunks ${operationType}d successfully in batch`, {
          operationType,
          totalChunks: chunks.length,
          uniqueChunks: vectorPoints.length,
          duplicatesRemoved: result.duplicatesRemoved,
          processingTime: result.processingTime,
          batchSize
        });
      } else {
        throw new Error(`Failed to ${operationType} vector points in batch`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`${operationType} failed: ${errorMessage}`);
      this.logger.error(`Failed to ${operationType} chunks in batch`, {
        operationType,
        batchSize,
        error: errorMessage
      });
    }

    return result;
  }
}