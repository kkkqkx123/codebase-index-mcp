import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { IndexCoordinator } from './IndexCoordinator';
import { ConfigService } from '../../config/ConfigService';

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
  
  private currentIndexing: Map<string, boolean> = new Map();

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(IndexCoordinator) indexCoordinator: IndexCoordinator
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.indexCoordinator = indexCoordinator;
  }

  async createIndex(projectPath: string, options: IndexOptions = {}): Promise<IndexResult> {
    this.logger.info('Starting index creation', { projectPath });

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.createIndex(projectPath, options);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Index creation failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'createIndex' }
      );
      throw error;
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<any[]> {
    this.logger.info('Performing search', { query, options });

    try {
      // Delegate to IndexCoordinator for search
      const result = await this.indexCoordinator.search(query, options);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'search' }
      );
      throw error;
    }
  }

  async getStatus(projectPath: string): Promise<IndexStatus> {
    try {
      // Delegate to IndexCoordinator
      const status = await this.indexCoordinator.getStatus(projectPath);
      return status;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'getStatus' }
      );
      throw error;
    }
  }

  async updateIndex(projectPath: string, changedFiles: string[]): Promise<IndexResult> {
    this.logger.info('Starting index update', {
      projectPath,
      changedFiles: changedFiles.length
    });

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.updateIndex(projectPath, changedFiles);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Index update failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'updateIndex' }
      );
      throw error;
    }
  }

  async deleteIndex(projectPath: string): Promise<boolean> {
    this.logger.info('Deleting index', { projectPath });

    try {
      // Delegate to IndexCoordinator
      const result = await this.indexCoordinator.deleteIndex(projectPath);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Index deletion failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'deleteIndex' }
      );
      throw error;
    }
  }

  getActiveIndexing(): string[] {
    // Delegate to IndexCoordinator
    return this.indexCoordinator.getActiveIndexing();
  }
}