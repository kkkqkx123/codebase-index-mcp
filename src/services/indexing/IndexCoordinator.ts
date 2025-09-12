import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ChangeDetectionService, FileChangeEvent } from '../filesystem/ChangeDetectionService';
import { ParserService } from '../parser/ParserService';
import { StorageCoordinator } from '../storage/StorageCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { HashUtils } from '../../utils/HashUtils';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { AsyncPipeline, PipelineStep, PipelineOptions } from '../infrastructure/AsyncPipeline';
import { BatchProcessor, BatchOptions } from '../processing/BatchProcessor';
import { MemoryManager, MemoryManagerOptions } from '../processing/MemoryManager';
import { ObjectPool, PoolOptions } from '../infrastructure/ObjectPool';
import { SearchCoordinator, SearchQuery } from '../search/SearchCoordinator';

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
  private asyncPipeline: AsyncPipeline;
  private batchProcessor: BatchProcessor;
  private memoryManager: MemoryManager;
  private filePool: ObjectPool<string>;
  private searchCoordinator: SearchCoordinator;
  private currentIndexing: Map<string, boolean> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.ChangeDetectionService) changeDetectionService: ChangeDetectionService,
    @inject(TYPES.ParserService) parserService: ParserService,
    @inject(TYPES.StorageCoordinator) storageCoordinator: StorageCoordinator,
    @inject(TYPES.FileSystemTraversal) fileSystemTraversal: FileSystemTraversal,
    @inject(TYPES.AsyncPipeline) asyncPipeline: AsyncPipeline,
    @inject(TYPES.BatchProcessor) batchProcessor: BatchProcessor,
    @inject(TYPES.MemoryManager) memoryManager: MemoryManager,
    @inject(TYPES.SearchCoordinator) searchCoordinator: SearchCoordinator
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.changeDetectionService = changeDetectionService;
    this.parserService = parserService;
    this.storageCoordinator = storageCoordinator;
    this.fileSystemTraversal = fileSystemTraversal;
    this.asyncPipeline = asyncPipeline;
    this.batchProcessor = batchProcessor;
    this.memoryManager = memoryManager;
    this.searchCoordinator = searchCoordinator;
    
    // Initialize file pool
    this.filePool = new ObjectPool<string>({
      initialSize: 100,
      maxSize: 1000,
      creator: () => '',
      resetter: (path: string) => path,
      validator: (path: string) => typeof path === 'string',
      destroy: (path: string) => {},
      evictionPolicy: 'lru'
    }, this.logger);
    
    this.initializePerformanceComponents();
  }

  private initializePerformanceComponents(): void {
    // Initialize memory manager with optimized settings
    this.memoryManager.startMonitoring();
    
    // Setup async pipeline for indexing operations
    this.setupIndexingPipeline();
  }

  private setupIndexingPipeline(): void {
    this.asyncPipeline.clearSteps();
    
    this.asyncPipeline
      .addStep({
        name: 'memory-check',
        execute: async (data: any) => {
          // 使用更宽松的内存检查，允许90%使用率
          const memoryOk = this.memoryManager.checkMemory(95);
          if (!memoryOk) {
            // 如果内存不足，尝试强制垃圾回收
            this.memoryManager.forceGarbageCollection();
            // 再次检查，使用更宽松的阈值
            const retryOk = this.memoryManager.checkMemory(95);
            if (!retryOk) {
              throw new Error('Insufficient memory for indexing operation');
            }
          }
          return data;
        },
        timeout: 5000,
        retryAttempts: 2
      })
      .addStep({
        name: 'file-traversal',
        execute: async (data: { projectPath: string; options: IndexOptions }) => {
          const result = await this.fileSystemTraversal.traverseDirectory(data.projectPath);
          return { ...data, traversalResult: result };
        },
        timeout: 60000,
        retryAttempts: 2
      })
      .addStep({
        name: 'batch-parsing',
        execute: async (data: any) => {
          const filePaths = data.traversalResult.files.map((file: any) => file.path);
          if (filePaths.length === 0) {
            return { ...data, parseResults: [] };
          }

          const batchOptions: BatchOptions = {
            batchSize: this.configService.get('indexing').batchSize || 50,
            maxConcurrency: this.configService.get('indexing').maxConcurrency || 3,
            timeout: 300000,
            retryAttempts: 3,
            continueOnError: true
          };

          const parseResults = await this.batchProcessor.processInBatches(
            filePaths,
            async (batch: string[]) => {
              return await this.parserService.parseFiles(batch);
            },
            batchOptions
          );

          return { ...data, parseResults: parseResults.results };
        },
        timeout: 300000,
        retryAttempts: 2,
        continueOnError: true
      })
      .addStep({
        name: 'storage-coordination',
        execute: async (data: any) => {
          const projectId = await HashUtils.calculateDirectoryHash(data.projectPath);
          const parsedFiles = data.parseResults.map((result: any) => ({
            filePath: result.filePath,
            chunks: [],
            language: result.language,
            metadata: result.metadata
          }));

          const storageResult = await this.storageCoordinator.store(parsedFiles, projectId.hash);
          return { ...data, storageResult, projectId: projectId.hash };
        },
        timeout: 120000,
        retryAttempts: 3
      });
  }

  async createIndex(projectPath: string, options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    this.logger.info('Starting index creation', { projectPath, projectId: projectId.hash });

    try {
      // Execute indexing through optimized pipeline
      const pipelineResult = await this.asyncPipeline.execute({
        projectPath,
        options
      });

      if (!pipelineResult.success) {
        throw new Error(pipelineResult.error || 'Pipeline execution failed');
      }

      const result: IndexResult = {
        success: true,
        filesProcessed: pipelineResult.data.traversalResult?.files?.length || 0,
        filesSkipped: 0,
        chunksCreated: pipelineResult.data.storageResult?.chunksStored || 0,
        processingTime: pipelineResult.totalTime,
        errors: pipelineResult.steps
          .filter(step => !step.success)
          .map(step => step.error || 'Unknown error')
      };

      this.logger.info('Index creation completed', {
        projectId: projectId.hash,
        filesProcessed: result.filesProcessed,
        chunksCreated: result.chunksCreated,
        processingTime: result.processingTime,
        pipelineMetrics: this.asyncPipeline.getMetrics()
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

  async processIncrementalChanges(projectPath: string, changes: FileChangeEvent[]): Promise<void> {
    if (changes.length === 0) {
      this.logger.debug('No changes to process');
      return;
    }

    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    this.logger.info('Processing incremental changes', {
      projectPath,
      projectId: projectId.hash,
      changeCount: changes.length
    });

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
        await this.storageCoordinator.store(parsedFiles, projectId.hash);
      }

      this.logger.info('Incremental changes processed successfully', {
        projectId: projectId.hash,
        changeCount: changes.length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to process incremental changes', {
        projectId: projectId.hash,
        error: errorMessage
      });
      throw error;
    }
  }

  // Add snippet processing status monitoring
  async getSnippetProcessingStatus(projectId: string): Promise<{
    totalSnippets: number;
    processedSnippets: number;
    duplicateSnippets: number;
    processingRate: number;
  }> {
    try {
      // Query the storage for actual snippet statistics
      const stats = await this.storageCoordinator.getSnippetStatistics(projectId);
      return stats;
    } catch (error) {
      this.logger.error('Failed to get snippet processing status', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Add real-time deduplication check
  async checkForDuplicates(snippetContent: string, projectId: string): Promise<boolean> {
    try {
      // Check the storage for duplicate snippets using content hash
      const contentHash = HashUtils.calculateStringHash(snippetContent);
      const existingSnippet = await this.storageCoordinator.findSnippetByHash(contentHash, projectId);
      return !!existingSnippet;
    } catch (error) {
      this.logger.error('Failed to check for duplicates', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Add cross-reference detection
  async detectCrossReferences(snippetId: string, projectId: string): Promise<string[]> {
    try {
      // Analyze relationships between snippets using the storage
      const references = await this.storageCoordinator.findSnippetReferences(snippetId, projectId);
      return references;
    } catch (error) {
      this.logger.error('Failed to detect cross references', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Add dependency analysis
  async analyzeDependencies(snippetId: string, projectId: string): Promise<{
    dependsOn: string[];
    usedBy: string[];
    complexity: number;
  }> {
    try {
      // Analyze code dependencies using the storage
      const dependencies = await this.storageCoordinator.analyzeSnippetDependencies(snippetId, projectId);
      return dependencies;
    } catch (error) {
      this.logger.error('Failed to analyze dependencies', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Add overlap detection
  async detectOverlaps(snippetId: string, projectId: string): Promise<string[]> {
    try {
      // Detect overlapping code segments using the storage
      const overlaps = await this.storageCoordinator.findSnippetOverlaps(snippetId, projectId);
      return overlaps;
    } catch (error) {
      this.logger.error('Failed to detect overlaps', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  async getIndexStatus(projectId: string): Promise<{
    lastIndexed?: Date;
    fileCount: number;
    chunkCount: number;
    status: 'idle' | 'indexing' | 'error' | 'completed';
  }> {
    // In a real implementation, this would query the storage for index status
    // For now, we'll return mock data
    return {
      lastIndexed: new Date(),
      fileCount: 150,
      chunkCount: 450,
      status: 'completed'
    };
  }

  async getStatus(projectPath: string): Promise<{
    projectId: string;
    isIndexing: boolean;
    lastIndexed?: Date;
    fileCount: number;
    chunkCount: number;
    status: 'idle' | 'indexing' | 'error' | 'completed';
  }> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    const indexStatus = await this.getIndexStatus(projectId.hash);
    
    return {
      projectId: projectId.hash,
      isIndexing: this.currentIndexing.get(projectId.hash) || false,
      lastIndexed: indexStatus.lastIndexed,
      fileCount: indexStatus.fileCount,
      chunkCount: indexStatus.chunkCount,
      status: indexStatus.status
    };
  }

  async search(query: string, projectId: string, options: any = {}): Promise<any[]> {
    try {
      // Delegate to SearchCoordinator with project context
      const searchQuery: SearchQuery = {
        text: query,
        filters: {
          projectId: projectId
        },
        options: {
          limit: options.limit,
          threshold: options.threshold,
          includeGraph: options.includeGraph,
          useHybrid: false,
          useReranking: true
        }
      };

      const searchResponse = await this.searchCoordinator.search(searchQuery);
      return searchResponse.results;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexCoordinator', operation: 'search' }
      );
      throw error;
    }
  }

  getActiveIndexing(): string[] {
    return Array.from(this.currentIndexing.entries())
      .filter(([_, isActive]) => isActive)
      .map(([projectId, _]) => projectId);
  }
}