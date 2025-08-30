import { injectable, inject } from 'inversify';
import { IndexService } from '../services/indexing/IndexService';
import { StorageCoordinator } from '../services/storage/StorageCoordinator';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { HashUtils } from '../utils/HashUtils';

@injectable()
export class SnippetController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private indexService: IndexService;
  private storageCoordinator: StorageCoordinator;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(IndexService) indexService: IndexService,
    @inject(StorageCoordinator) storageCoordinator: StorageCoordinator
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.indexService = indexService;
    this.storageCoordinator = storageCoordinator;

    this.logger.info('Snippet controller initialized');
  }

  /**
   * Search for snippets using vector and graph search
   */
  async searchSnippets(query: string, options: {
    projectId?: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<any> {
    try {
      this.logger.info('Searching snippets', { query, options });
      
      // Use the index service to perform the search
      const results = await this.indexService.searchSnippets(query, options);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to search snippets: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'searchSnippets', query, options }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get snippet by ID
   */
  async getSnippetById(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Getting snippet by ID', { snippetId, projectId });
      
      // In a real implementation, this would query the storage for the snippet
      // For now, we'll return mock data
      const mockSnippet = {
        id: snippetId,
        content: `// Mock content for snippet ${snippetId}`,
        filePath: `/mock/path/to/file_${snippetId}.ts`,
        startLine: 1,
        endLine: 10,
        language: 'typescript',
        metadata: {
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      return {
        success: true,
        data: mockSnippet
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get snippet by ID: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'getSnippetById', snippetId, projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get snippet processing status
   */
  async getSnippetProcessingStatus(projectId: string): Promise<any> {
    try {
      this.logger.info('Getting snippet processing status', { projectId });
      
      // Delegate to index service
      const status = await this.indexService.getSnippetProcessingStatus(projectId);
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get snippet processing status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'getSnippetProcessingStatus', projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check for duplicate snippets
   */
  async checkForDuplicates(snippetContent: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Checking for duplicate snippets', { projectId });
      
      // Calculate content hash
      const contentHash = HashUtils.calculateStringHash(snippetContent);
      
      // Delegate to index service
      const isDuplicate = await this.indexService.checkForDuplicates(snippetContent, projectId);
      
      return {
        success: true,
        data: {
          isDuplicate,
          contentHash
        }
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check for duplicates: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'checkForDuplicates', projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Detect cross-references between snippets
   */
  async detectCrossReferences(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Detecting cross-references', { snippetId, projectId });
      
      // Delegate to index service
      const references = await this.indexService.detectCrossReferences(snippetId, projectId);
      
      return {
        success: true,
        data: references
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to detect cross-references: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'detectCrossReferences', snippetId, projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze snippet dependencies
   */
  async analyzeDependencies(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Analyzing dependencies', { snippetId, projectId });
      
      // Delegate to index service
      const dependencies = await this.indexService.analyzeDependencies(snippetId, projectId);
      
      return {
        success: true,
        data: dependencies
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to analyze dependencies: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'analyzeDependencies', snippetId, projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Detect overlapping snippets
   */
 async detectOverlaps(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Detecting overlaps', { snippetId, projectId });
      
      // Delegate to index service
      const overlaps = await this.indexService.detectOverlaps(snippetId, projectId);
      
      return {
        success: true,
        data: overlaps
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to detect overlaps: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'detectOverlaps', snippetId, projectId }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}