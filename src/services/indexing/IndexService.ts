import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { IndexCoordinator } from './IndexCoordinator';
import { ConfigService } from '../../config/ConfigService';
import { SearchQuery } from '../search/SearchCoordinator';

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
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.IndexCoordinator) indexCoordinator: IndexCoordinator
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
        new Error(
          `Index creation failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'IndexService', operation: 'createIndex' }
      );
      throw error;
    }
  }

  async search(query: string, projectId: string, options: SearchOptions = {}): Promise<any[]> {
    this.logger.info('Performing search', { query, projectId, options });

    try {
      // Delegate to IndexCoordinator for search
      const searchQuery: SearchQuery = {
        text: query,
        filters: {
          projectId,
          ...options.filters,
        },
        options: {
          ...options,
          searchType: 'general',
        },
      };
      const result = await this.indexCoordinator.search(searchQuery);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexService', operation: 'search' }
      );
      throw error;
    }
  }

  async searchSnippets(
    query: string,
    projectId: string,
    options: SearchOptions = {}
  ): Promise<any[]> {
    this.logger.info('Performing snippet search', { query, projectId, options });

    try {
      // Delegate to IndexCoordinator for snippet search
      const searchQuery: SearchQuery = {
        text: query,
        filters: {
          projectId,
          ...options.filters,
        },
        options: {
          ...options,
          searchType: 'snippet',
        },
      };
      const result = await this.indexCoordinator.search(searchQuery);
      return result;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Snippet search failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'IndexService', operation: 'searchSnippets' }
      );
      throw error;
    }
  }

  async getStatus(projectPath: string): Promise<IndexStatus> {
    try {
      // Delegate to IndexCoordinator
      const status = await this.indexCoordinator.getIndexStatus(projectPath);

      // Transform the result to match IndexStatus interface
      return {
        projectId: projectPath.split(/[/\\]/).pop() || 'unknown',
        isIndexing: false, // TODO: Add indexing status tracking
        lastIndexed: status.lastUpdated || undefined,
        fileCount: status.totalFiles,
        chunkCount: status.totalChunks,
        status: status.exists ? 'completed' : 'idle',
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'IndexService', operation: 'getStatus' }
      );
      throw error;
    }
  }

  async updateIndex(projectPath: string, changedFiles: string[]): Promise<IndexResult> {
    this.logger.info('Starting index update', {
      projectPath,
      changedFiles: changedFiles.length,
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
        new Error(
          `Index deletion failed: ${error instanceof Error ? error.message : String(error)}`
        ),
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
