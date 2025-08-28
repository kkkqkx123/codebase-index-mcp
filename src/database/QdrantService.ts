import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { QdrantClientWrapper } from './qdrant/QdrantClientWrapper';

@injectable()
export class QdrantService {
  private qdrantClient: QdrantClientWrapper;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(QdrantClientWrapper) qdrantClient: QdrantClientWrapper
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.qdrantClient = qdrantClient;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.qdrantClient.connect();
      if (connected) {
        this.logger.info('Qdrant service initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize Qdrant service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantService', operation: 'initialize' }
      );
      return false;
    }
  }

  async createCollection(name: string, vectorSize: number): Promise<boolean> {
    return this.qdrantClient.createCollection(name, vectorSize);
  }

  async upsertVectors(collectionName: string, vectors: any[]): Promise<boolean> {
    return this.qdrantClient.upsertPoints(collectionName, vectors);
  }

  async searchVectors(collectionName: string, query: number[], options?: any): Promise<any[]> {
    return this.qdrantClient.searchVectors(collectionName, query, options);
  }

  async getCollectionInfo(collectionName: string): Promise<any> {
    return this.qdrantClient.getCollectionInfo(collectionName);
  }

  isConnected(): boolean {
    return this.qdrantClient.isConnectedToDatabase();
  }

  async close(): Promise<void> {
    await this.qdrantClient.close();
  }
}