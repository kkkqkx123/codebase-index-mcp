import { injectable, inject } from 'inversify';
import { QdrantClientWrapper, VectorPoint, SearchOptions, SearchResult } from '../../database/qdrant/QdrantClientWrapper';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';

export interface VectorStorageConfig {
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  recreateCollection: boolean;
}

export interface ProjectVectorConfig {
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
  private currentCollection: string = '';

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
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics,
    @inject(EmbedderFactory) private embedderFactory: EmbedderFactory
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

  private generateCollectionName(projectId: string): string {
    return `project-${projectId}`;
  }

  async initialize(projectId?: string): Promise<boolean> {
    try {
      // If already initialized, return true immediately
      if (this.isInitialized && (!projectId || this.currentCollection === this.generateCollectionName(projectId))) {
        return true;
      }
      
      if (!this.qdrantClient.isConnectedToDatabase()) {
        const connected = await this.qdrantClient.connect();
        if (!connected) {
          throw new Error('Failed to connect to Qdrant');
        }
      }

      // Set the collection name based on projectId or use default
      const collectionName = projectId ? this.generateCollectionName(projectId) : this.config.collectionName;
      this.currentCollection = collectionName;

      const collectionExists = await this.qdrantClient.collectionExists(collectionName);

      if (!collectionExists || this.config.recreateCollection) {
        const created = await this.qdrantClient.createCollection(
          collectionName,
          this.config.vectorSize,
          this.config.distance as 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan',
          this.config.recreateCollection
        );

        if (!created) {
          throw new Error(`Failed to create collection ${collectionName}`);
        }
      }

      const collectionInfo = await this.qdrantClient.getCollectionInfo(collectionName);
      if (!collectionInfo) {
        throw new Error(`Failed to get collection info for ${collectionName}`);
      }

      this.logger.info('Vector storage service initialized', {
        collectionName,
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
        this.qdrantClient.upsertPoints(this.currentCollection, vectorPoints)
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
      return await this.qdrantClient.searchVectors(this.currentCollection, queryVector, options);
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
      return await this.qdrantClient.deletePoints(this.currentCollection, chunkIds);
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
      return await this.qdrantClient.clearCollection(this.currentCollection);
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
        this.qdrantClient.getPointCount(this.currentCollection),
        this.qdrantClient.getCollectionInfo(this.currentCollection)
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

          // Check if this is a SnippetChunk
          const isSnippet = chunk.type === 'snippet' && 'snippetMetadata' in chunk;

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
              ...(chunk.functionName && { functionName: chunk.functionName }),
              ...(chunk.className && { className: chunk.className }),
              ...(options.projectId && { projectId: options.projectId }),
              ...(isSnippet && { snippetMetadata: (chunk as any).snippetMetadata }),
              metadata: {
                ...chunk.metadata,
                imports: chunk.imports || [],
                exports: chunk.exports || [],
                complexity: chunk.metadata.complexity || 1,
                parameters: chunk.metadata.parameters || [],
                returnType: chunk.metadata.returnType || 'unknown'
              },
              timestamp: new Date()
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
    try {
      // Use the embedder factory to get the configured embedder and generate embedding
      const result = await this.embedderFactory.embed({ text: content });
      
      // Handle both single result and array result
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      return embeddingResult.vector;
    } catch (error) {
      this.logger.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length
      });
      throw error;
    }
  }

  async updateConfig(newConfig: Partial<VectorStorageConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Vector storage config updated', { config: this.config });
  }

  private initializeBatchProcessingConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');

    this.maxConcurrentOperations = batchConfig?.maxConcurrentOperations ?? this.maxConcurrentOperations;
    this.defaultBatchSize = batchConfig?.defaultBatchSize ?? this.defaultBatchSize;
    this.maxBatchSize = batchConfig?.maxBatchSize ?? this.maxBatchSize;
    this.memoryThreshold = batchConfig?.memoryThreshold ?? this.memoryThreshold;
    this.processingTimeout = batchConfig?.processingTimeout ?? this.processingTimeout;
    this.retryAttempts = batchConfig?.retryAttempts ?? this.retryAttempts;
    this.retryDelay = batchConfig?.retryDelay ?? this.retryDelay;
    this.adaptiveBatchingEnabled = batchConfig?.adaptiveBatching?.enabled ?? this.adaptiveBatchingEnabled;

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
    let lastError: Error = new Error(`Operation failed after ${maxAttempts} attempts.`);

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
      const success = await this.qdrantClient.deletePoints(this.currentCollection, chunkIds);

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
    try {
      const existingChunkIds = await this.qdrantClient.getExistingChunkIds(this.currentCollection, chunkIds);
      this.logger.debug(`Found ${existingChunkIds.length} existing chunk IDs out of ${chunkIds.length} requested`);
      return existingChunkIds;
    } catch (error) {
      this.logger.error('Failed to get existing chunk IDs', {
        error: error instanceof Error ? error.message : String(error),
        requestedCount: chunkIds.length
      });
      return [];
    }
  }

  private async getChunkIdsByFiles(filePaths: string[]): Promise<string[]> {
    try {
      const chunkIds = await this.qdrantClient.getChunkIdsByFiles(this.currentCollection, filePaths);
      this.logger.debug(`Retrieved ${chunkIds.length} chunk IDs for ${filePaths.length} files`);
      return chunkIds;
    } catch (error) {
      this.logger.error('Failed to get chunk IDs by files', {
        error: error instanceof Error ? error.message : String(error),
        fileCount: filePaths.length
      });
      return [];
    }
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
    const adaptiveConfig = config?.adaptiveBatching;

    // Start with a reasonable batch size based on total items
    let batchSize = Math.min(this.defaultBatchSize, totalItems);

    // Adjust based on item count - smaller batches for very large item counts
    if (totalItems > 1000 && adaptiveConfig?.minBatchSize) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 2, totalItems);
    } else if (totalItems > 500 && adaptiveConfig?.minBatchSize) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 3, totalItems);
    }

    const minBatchSize = adaptiveConfig?.minBatchSize ?? 10;
    const maxBatchSize = adaptiveConfig?.maxBatchSize ?? 200;
    return Math.max(minBatchSize, Math.min(batchSize, maxBatchSize));
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

        // Check if this is a SnippetChunk
        const isSnippet = chunk.type === 'snippet' && 'snippetMetadata' in chunk;

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
            ...(chunk.functionName && { functionName: chunk.functionName }),
            ...(chunk.className && { className: chunk.className }),
            ...(options.projectId && { projectId: options.projectId }),
            ...(isSnippet && { snippetMetadata: (chunk as any).snippetMetadata }),
            metadata: {
              ...chunk.metadata,
              imports: chunk.imports || [],
              exports: chunk.exports || [],
              complexity: chunk.metadata.complexity || 1,
              parameters: chunk.metadata.parameters || [],
              returnType: chunk.metadata.returnType || 'unknown'
            },
            timestamp: new Date()
          }
        };

        return vectorPoint;
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
        this.qdrantClient.upsertPoints(this.currentCollection, vectorPoints)
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

  async search(query: string, options: any = {}): Promise<any[]> {
    try {
      // Generate embedding for the query
      const queryVector = await this.generateEmbedding(query);
      
      // Use the existing searchVectors method
      const searchOptions: SearchOptions = {
        limit: options.limit || 10,
        scoreThreshold: options.threshold || 0.5,
        ...options
      };
      
      const results = await this.searchVectors(queryVector, searchOptions);
      
      // Transform results to match expected format
      return results.map(result => ({
        id: result.id,
        score: result.score,
        payload: result.payload
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to search vectors', {
        query,
        options,
        error: errorMessage
      });
      
      throw new Error(`Failed to search vectors: ${errorMessage}`);
    }
  }

  /**
   * Process chunks asynchronously with batching and concurrency control
   * @param chunks Array of CodeChunk objects to process
   * @param options Indexing options
   * @param concurrency Maximum number of concurrent batch operations
   * @returns Promise that resolves when all chunks are processed
   */
  async processChunksAsync(
    chunks: CodeChunk[],
    options: IndexingOptions = {},
    concurrency: number = this.maxConcurrentOperations
  ): Promise<IndexingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `processChunksAsync_${options.projectId || 'unknown'}_${Date.now()}`;
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
      // Split chunks into batches
      const batches: CodeChunk[][] = [];
      for (let i = 0; i < chunks.length; i += batchSize) {
        batches.push(chunks.slice(i, i + batchSize));
      }

      // Process batches with controlled concurrency
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      // Process batches in concurrent groups
      for (let i = 0; i < batches.length; i += concurrency) {
        const batchGroup = batches.slice(i, i + concurrency);
        const batchPromises = batchGroup.map(async (batch, index) => {
          try {
            const batchResult = await this.processChunksInBatches(batch, options, batchSize, 'create');
            processedCount += batch.length;
            if (batchResult.success) {
              successCount += batchResult.uniqueChunks;
              result.duplicatesRemoved += batchResult.duplicatesRemoved;
            } else {
              errorCount += batch.length;
              result.errors.push(...batchResult.errors);
            }
            return batchResult;
          } catch (error) {
            errorCount += batch.length;
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Batch ${i + index} failed: ${errorMessage}`);
            this.logger.error(`Failed to process batch ${i + index}`, {
              batchIndex: i + index,
              batchSize: batch.length,
              error: errorMessage
            });
            return null;
          }
        });

        // Wait for all batches in this group to complete
        await Promise.all(batchPromises);
        
        // Update batch metrics
        this.batchMetrics.updateBatchOperation(operationId, {
          processedCount,
          successCount,
          errorCount
        });
      }

      result.success = errorCount === 0;
      result.processedFiles = this.extractUniqueFileCount(chunks);
      result.uniqueChunks = successCount;
      result.processingTime = Date.now() - startTime;

      this.logger.info('Chunks processed asynchronously', {
        totalChunks: chunks.length,
        processedFiles: result.processedFiles,
        uniqueChunks: result.uniqueChunks,
        duplicatesRemoved: result.duplicatesRemoved,
        processingTime: result.processingTime,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to process chunks asynchronously: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'VectorStorageService', operation: 'processChunksAsync' }
      );
      result.errors.push(`Async processing failed: ${report.id}`);
      this.logger.error('Failed to process chunks asynchronously', { errorId: report.id });

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
}