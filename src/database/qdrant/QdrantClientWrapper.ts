import { QdrantClient } from '@qdrant/js-client-rest';
import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../core/ErrorHandlerService';

export interface QdrantConfig {
  host: string;
  port: number;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    content: string;
    filePath: string;
    language: string;
    chunkType: string;
    startLine: number;
    endLine: number;
    functionName?: string;
    className?: string;
    metadata: Record<string, any>;
    timestamp: Date;
    projectId?: string;
  };
}

export interface CollectionInfo {
  name: string;
  vectors: {
    size: number;
    distance: 'Cosine' | 'Euclidean' | 'Dot';
  };
  pointsCount: number;
  status: 'green' | 'yellow' | 'red';
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: {
    language?: string[];
    chunkType?: string[];
    filePath?: string[];
    projectId?: string;
  };
  withPayload?: boolean;
  withVector?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: VectorPoint['payload'];
}

@injectable()
export class QdrantClientWrapper {
  private client: QdrantClient;
  private config: QdrantConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private isConnected: boolean = false;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    const qdrantConfig = configService.get('qdrant');
    this.config = {
      host: qdrantConfig.host,
      port: qdrantConfig.port,
      apiKey: process.env.QDRANT_API_KEY,
      useHttps: false,
      timeout: 30000
    };

    this.client = new QdrantClient({
      url: `${this.config.useHttps ? 'https' : 'http'}://${this.config.host}:${this.config.port}`,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });
  }

  async connect(): Promise<boolean> {
    try {
      const health = await this.client.health();
      this.isConnected = true;
      this.logger.info('Connected to Qdrant successfully', {
        version: health.version,
        status: health.status
      });
      return true;
    } catch (error) {
      this.isConnected = false;
      const report = this.errorHandler.handleError(
        new Error(`Failed to connect to Qdrant: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'connect' }
      );
      this.logger.error('Failed to connect to Qdrant', { errorId: report.id });
      return false;
    }
  }

  async createCollection(
    collectionName: string,
    vectorSize: number,
    distance: 'Cosine' | 'Euclidean' | 'Dot' = 'Cosine',
    recreateIfExists: boolean = false
  ): Promise<boolean> {
    try {
      const exists = await this.collectionExists(collectionName);
      
      if (exists && recreateIfExists) {
        await this.deleteCollection(collectionName);
      } else if (exists) {
        this.logger.info(`Collection ${collectionName} already exists`);
        return true;
      }

      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: distance
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      });

      await this.createPayloadIndex(collectionName, 'language');
      await this.createPayloadIndex(collectionName, 'chunkType');
      await this.createPayloadIndex(collectionName, 'filePath');
      await this.createPayloadIndex(collectionName, 'projectId');

      this.logger.info(`Created collection ${collectionName}`, {
        vectorSize,
        distance
      });

      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to create collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'createCollection' }
      );
      this.logger.error('Failed to create collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(col => col.name === collectionName);
    } catch (error) {
      this.logger.warn('Failed to check collection existence', { 
        collectionName, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  async deleteCollection(collectionName: string): Promise<boolean> {
    try {
      await this.client.deleteCollection(collectionName);
      this.logger.info(`Deleted collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'deleteCollection' }
      );
      this.logger.error('Failed to delete collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      const info = await this.client.getCollection(collectionName);
      return {
        name: collectionName,
        vectors: {
          size: info.config.params.vectors.size,
          distance: info.config.params.vectors.distance
        },
        pointsCount: info.points_count,
        status: info.status
      };
    } catch (error) {
      this.logger.warn('Failed to get collection info', { 
        collectionName, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<boolean> {
    try {
      if (points.length === 0) {
        return true;
      }

      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        
        await this.client.upsert(collectionName, {
          points: batch.map(point => ({
            id: point.id,
            vector: point.vector,
            payload: {
              ...point.payload,
              timestamp: point.payload.timestamp.toISOString()
            }
          }))
        });
      }

      this.logger.info(`Upserted ${points.length} points to collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to upsert points to ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'upsertPoints' }
      );
      this.logger.error('Failed to upsert points', { errorId: report.id, collectionName, pointCount: points.length });
      return false;
    }
  }

  async searchVectors(
    collectionName: string,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const searchParams: any = {
        limit: options.limit || 10,
        with_payload: options.withPayload !== false,
        with_vector: options.withVector || false
      };

      if (options.scoreThreshold !== undefined) {
        searchParams.score_threshold = options.scoreThreshold;
      }

      if (options.filter) {
        searchParams.filter = this.buildFilter(options.filter);
      }

      const results = await this.client.search(collectionName, {
        vector: queryVector,
        ...searchParams
      });

      return results.map(result => ({
        id: result.id as string,
        score: result.score,
        payload: {
          ...result.payload as any,
          timestamp: new Date(result.payload?.timestamp || Date.now())
        }
      }));
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to search vectors in ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'searchVectors' }
      );
      this.logger.error('Failed to search vectors', { errorId: report.id, collectionName });
      return [];
    }
  }

  async deletePoints(collectionName: string, pointIds: string[]): Promise<boolean> {
    try {
      await this.client.delete(collectionName, {
        filter: {
          must: [
            {
              key: 'id',
              match: {
                any: pointIds
              }
            }
          ]
        }
      });

      this.logger.info(`Deleted ${pointIds.length} points from collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete points from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'deletePoints' }
      );
      this.logger.error('Failed to delete points', { errorId: report.id, collectionName });
      return false;
    }
  }

  async clearCollection(collectionName: string): Promise<boolean> {
    try {
      await this.client.delete(collectionName, {
        filter: {
          must: [
            {
              key: 'id',
              match: {
                any: true
              }
            }
          ]
        }
      });

      this.logger.info(`Cleared collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to clear collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantClient', operation: 'clearCollection' }
      );
      this.logger.error('Failed to clear collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async getPointCount(collectionName: string): Promise<number> {
    try {
      const info = await this.client.getCollection(collectionName);
      return info.points_count || 0;
    } catch (error) {
      this.logger.warn('Failed to get point count', { 
        collectionName, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return 0;
    }
  }

  async createPayloadIndex(collectionName: string, field: string): Promise<boolean> {
    try {
      await this.client.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: 'keyword',
        field_type: 'keyword'
      });

      this.logger.info(`Created payload index for field ${field} in collection ${collectionName}`);
      return true;
    } catch (error) {
      this.logger.warn('Failed to create payload index', { 
        collectionName, 
        field,
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  private buildFilter(filter: SearchOptions['filter']): any {
    if (!filter) return undefined;

    const must: any[] = [];

    if (filter.language) {
      must.push({
        key: 'language',
        match: {
          any: filter.language
        }
      });
    }

    if (filter.chunkType) {
      must.push({
        key: 'chunkType',
        match: {
          any: filter.chunkType
        }
      });
    }

    if (filter.filePath) {
      must.push({
        key: 'filePath',
        match: {
          any: filter.filePath
        }
      });
    }

    if (filter.projectId) {
      must.push({
        key: 'projectId',
        match: {
          value: filter.projectId
        }
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    this.logger.info('Qdrant client connection closed');
  }
}