import { injectable, inject } from 'inversify';
import { ChangeDetectionService, FileChangeEvent } from '../filesystem/ChangeDetectionService';
import { ParserService } from '../parser/ParserService';
import { StorageCoordinator } from '../storage/StorageCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { HashUtils } from '../../utils/HashUtils';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';

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

@injectable()
export class IndexCoordinator {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private changeDetectionService: ChangeDetectionService;
  private parserService: ParserService;
  private storageCoordinator: StorageCoordinator;
  private fileSystemTraversal: FileSystemTraversal;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(ChangeDetectionService) changeDetectionService: ChangeDetectionService,
    @inject(ParserService) parserService: ParserService,
    @inject(StorageCoordinator) storageCoordinator: StorageCoordinator,
    @inject(FileSystemTraversal) fileSystemTraversal: FileSystemTraversal
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.changeDetectionService = changeDetectionService;
    this.parserService = parserService;
    this.storageCoordinator = storageCoordinator;
    this.fileSystemTraversal = fileSystemTraversal;
  }

  async createIndex(projectPath: string, options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    this.logger.info('Starting index creation', { projectPath, projectId: projectId.hash });

    try {
     // Traverse directory to get all files
     const traversalResult = await this.fileSystemTraversal.traverseDirectory(projectPath);
     const filePaths = traversalResult.files.map(file => file.path);
     
     if (filePaths.length === 0) {
       this.logger.info('No files to process', { projectId: projectId.hash });
       return {
         success: true,
         filesProcessed: 0,
         filesSkipped: 0,
         chunksCreated: 0,
         processingTime: Date.now() - startTime,
         errors: []
       };
     }

     // Parse files
     const parseResults = await this.parserService.parseFiles(filePaths);
      
      // Store parsed files using storage coordinator
      // Convert ParseResult to ParsedFile format for storage
      const parsedFiles = parseResults.map(result => ({
        filePath: result.filePath,
        chunks: [], // For now, we'll leave chunks empty - in a real implementation, this would be populated
        language: result.language,
        metadata: result.metadata
      }));
      
      // Store parsed files using storage coordinator
      const storageResult = await this.storageCoordinator.store(parsedFiles, projectId.hash);

     const result: IndexResult = {
       success: storageResult.success,
       filesProcessed: filePaths.length,
       filesSkipped: 0,
       chunksCreated: storageResult.chunksStored || 0,
       processingTime: Date.now() - startTime,
       errors: storageResult.errors || []
     };

      this.logger.info('Index creation completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        chunksCreated: result.chunksCreated,
        processingTime: result.processingTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Index creation failed', {
        projectId: projectId.hash,
        error: errorMessage
      });

      return {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [errorMessage]
      };
    }
  }

  async updateIndex(projectPath: string, changedFiles: string[]): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Starting index update', {
      projectPath,
      projectId: projectId.hash,
      changedFiles: changedFiles.length
    });

    try {
      // Parse changed files
      const parseResults = await this.parserService.parseFiles(changedFiles);
      
      // Convert ParseResult to ParsedFile format for storage
      const parsedFiles = parseResults.map(result => ({
        filePath: result.filePath,
        chunks: [], // For now, we'll leave chunks empty - in a real implementation, this would be populated
        language: result.language,
        metadata: result.metadata
      }));
      
      // Store parsed files using storage coordinator
      const storageResult = await this.storageCoordinator.store(parsedFiles, projectId.hash);

      const result: IndexResult = {
        success: storageResult.success,
        filesProcessed: changedFiles.length,
        filesSkipped: 0,
        chunksCreated: storageResult.chunksStored || 0,
        processingTime: Date.now() - startTime,
        errors: storageResult.errors || []
      };

      this.logger.info('Index update completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        chunksCreated: result.chunksCreated,
        processingTime: result.processingTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Index update failed', {
        projectId: projectId.hash,
        error: errorMessage
      });

      return {
        success: false,
        filesProcessed: 0,
        filesSkipped: 0,
        chunksCreated: 0,
        processingTime: Date.now() - startTime,
        errors: [errorMessage]
      };
    }
  }

  async deleteIndex(projectPath: string): Promise<boolean> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Deleting index', { projectPath, projectId: projectId.hash });

    try {
      // Delete from storage coordinator
      const result = await this.storageCoordinator.deleteProject(projectId.hash);
      
      if (result.success) {
        this.logger.info('Index deleted successfully', { projectId: projectId.hash });
        return true;
      } else {
        this.logger.error('Failed to delete index', { 
          projectId: projectId.hash,
          errors: result.errors
        });
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

  async processIncrementalChanges(changes: FileChangeEvent[]): Promise<void> {
    if (changes.length === 0) {
      this.logger.debug('No changes to process');
      return;
    }

    this.logger.info('Processing incremental changes', { changeCount: changes.length });

    try {
      // Group changes by type
      const createdFiles = changes.filter(c => c.type === 'created').map(c => c.relativePath);
      const modifiedFiles = changes.filter(c => c.type === 'modified').map(c => c.relativePath);
      const deletedFiles = changes.filter(c => c.type === 'deleted').map(c => c.relativePath);

      // Process deletions first
      if (deletedFiles.length > 0) {
        await this.storageCoordinator.deleteFiles(deletedFiles);
      }

      // Process creations and modifications
      const filesToProcess = [...createdFiles, ...modifiedFiles];
      if (filesToProcess.length > 0) {
        const parseResults = await this.parserService.parseFiles(filesToProcess);
        // Convert ParseResult to ParsedFile format for storage
        const parsedFiles = parseResults.map(result => ({
          filePath: result.filePath,
          chunks: [], // For now, we'll leave chunks empty - in a real implementation, this would be populated
          language: result.language,
          metadata: result.metadata
        }));
        await this.storageCoordinator.store(parsedFiles);
      }

      this.logger.info('Incremental changes processed successfully', { changeCount: changes.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to process incremental changes', {
        error: errorMessage
      });
      throw error;
    }
  }
}