import { injectable, inject } from 'inversify';
import { QdrantClientWrapper, VectorPoint, SearchOptions, SearchResult } from '../qdrant/QdrantClientWrapper';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

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
  private isInitialized: boolean = false;

  constructor(
    @inject(QdrantClientWrapper) qdrantClient: QdrantClientWrapper,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService
  ) {
    this.qdrantClient = qdrantClient;
    this.logger = logger;
    this.errorHandler = errorHandler;

    const qdrantConfig = configService.get('qdrant');
    this.config = {
      collectionName: qdrantConfig.collection,
      vectorSize: 1536, // Default OpenAI embedding size
      distance: 'Cosine',
      recreateCollection: false
    };
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
      const vectorPoints = await this.convertChunksToVectorPoints(chunks, options);
      
      if (vectorPoints.length === 0) {
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      const success = await this.qdrantClient.upsertPoints(this.config.collectionName, vectorPoints);
      
      if (success) {
        result.success = true;
        result.uniqueChunks = vectorPoints.length;
        result.duplicatesRemoved = chunks.length - vectorPoints.length;
        result.processingTime = Date.now() - startTime;
        
        this.logger.info('Chunks stored successfully', {
          totalChunks: chunks.length,
          uniqueChunks: vectorPoints.length,
          duplicatesRemoved: result.duplicatesRemoved,
          processingTime: result.processingTime
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

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}