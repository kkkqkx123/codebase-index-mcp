import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ChangeDetectionService, FileChangeEvent } from '../filesystem/ChangeDetectionService';
import { ParserService } from '../parser/ParserService';
import { StorageCoordinator } from '../storage/StorageCoordinator';
import { LSPEnhancementPhase } from './LSPEnhancementPhase';
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
  enableLSP?: boolean;
  lspTimeout?: number;
  includeTypes?: boolean;
  includeReferences?: boolean;
  includeDiagnostics?: boolean;
  cacheLSP?: boolean;
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
  private lspEnhancementPhase: LSPEnhancementPhase;
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
    @inject(TYPES.SearchCoordinator) searchCoordinator: SearchCoordinator,
    @inject(TYPES.LSPEnhancementPhase) lspEnhancementPhase: LSPEnhancementPhase
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
    this.lspEnhancementPhase = lspEnhancementPhase;
    
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
            batchSize: this.configService.get('indexing')?.batchSize ?? 50,
            maxConcurrency: this.configService.get('indexing')?.maxConcurrency ?? 3,
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
        name: 'lsp-enhancement',
        execute: async (data: any) => {
          if (!data.options.enableLSP) {
            return { ...data, enhancedResults: data.parseResults };
          }

          const lspResult = await this.lspEnhancementPhase.execute(data.parseResults, {
            enableLSP: data.options.enableLSP,
            lspTimeout: data.options.lspTimeout,
            includeTypes: data.options.includeTypes,
            includeReferences: data.options.includeReferences,
            includeDiagnostics: data.options.includeDiagnostics,
            cacheLSP: data.options.cacheLSP,
            batchSize: this.configService.get('lsp')?.batchSize ?? 20,
            maxConcurrency: this.configService.get('lsp')?.maxConcurrency ?? 3
          });

          return { ...data, enhancedResults: lspResult.enhancedResults };
        },
        timeout: 300000,
        retryAttempts: 2,
        continueOnError: true
      })
      .addStep({
        name: 'storage-coordination',
        execute: async (data: any) => {
          const projectId = await HashUtils.calculateDirectoryHash(data.projectPath);
          const parsedFiles = data.enhancedResults.map((result: any) => ({
            filePath: result.filePath,
            chunks: [],
            language: result.language,
            metadata: {
              ...result.metadata,
              lspSymbols: result.lspSymbols,
              lspDiagnostics: result.lspDiagnostics,
              typeDefinitions: result.typeDefinitions,
              references: result.references,
              lspMetadata: result.lspMetadata
            }
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

  async updateIndex(projectPath: string, changedFiles: string[], options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);

    this.logger.info('Starting index update', {
      projectPath,
      projectId: projectId.hash,
      filesToUpdate: changedFiles.length
    });

    try {
      if (changedFiles.length === 0) {
        return {
          success: true,
          filesProcessed: 0,
          filesSkipped: 0,
          chunksCreated: 0,
          processingTime: 0,
          errors: []
        };
      }

      // Parse files
      const parseResults = await this.parserService.parseFiles(changedFiles);
      
      // Apply LSP enhancement
      let enhancedResults = parseResults;
      if (options.enableLSP && parseResults.length > 0) {
        const lspResult = await this.lspEnhancementPhase.execute(parseResults, {
          enableLSP: options.enableLSP,
          lspTimeout: options.lspTimeout,
          includeTypes: options.includeTypes,
          includeReferences: options.includeReferences,
          includeDiagnostics: options.includeDiagnostics,
          cacheLSP: options.cacheLSP,
          batchSize: this.configService.get('lsp')?.batchSize ?? 20,
          maxConcurrency: this.configService.get('lsp')?.maxConcurrency ?? 3
        });
        enhancedResults = lspResult.enhancedResults;
      }
      
      // Convert ParseResult to ParsedFile format for storage
      const parsedFiles = enhancedResults.map(result => ({
        filePath: result.filePath,
        chunks: [], // For now, we'll leave chunks empty - in a real implementation, this would be populated
        language: result.language,
        metadata: {
          ...result.metadata,
          // Add LSP data if available (enhanced result)
          ...((result as any).lspSymbols && { lspSymbols: (result as any).lspSymbols }),
          ...((result as any).lspDiagnostics && { lspDiagnostics: (result as any).lspDiagnostics }),
          ...((result as any).typeDefinitions && { typeDefinitions: (result as any).typeDefinitions }),
          ...((result as any).references && { references: (result as any).references }),
          ...((result as any).lspMetadata && { lspMetadata: (result as any).lspMetadata })
        }
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

  async processIncrementalChanges(projectPath: string, changes: FileChangeEvent[], options: IndexOptions = {}): Promise<void> {
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
        
        // Apply LSP enhancement
        let enhancedResults = parseResults;
        if (options.enableLSP && parseResults.length > 0) {
          const lspResult = await this.lspEnhancementPhase.execute(parseResults, {
            enableLSP: options.enableLSP,
            lspTimeout: options.lspTimeout,
            includeTypes: options.includeTypes,
            includeReferences: options.includeReferences,
            includeDiagnostics: options.includeDiagnostics,
            cacheLSP: options.cacheLSP,
            batchSize: this.configService.get('lsp')?.batchSize ?? 20,
          maxConcurrency: this.configService.get('lsp')?.maxConcurrency ?? 3
          });
          enhancedResults = lspResult.enhancedResults;
        }
        
        // Convert ParseResult to ParsedFile format for storage
        const parsedFiles = enhancedResults.map(result => ({
          filePath: result.filePath,
          chunks: [], // For now, we'll leave chunks empty - in a real implementation, this would be populated
          language: result.language,
          metadata: {
            ...result.metadata,
            // Add LSP data if available (enhanced result)
            ...((result as any).lspSymbols && { lspSymbols: (result as any).lspSymbols }),
            ...((result as any).lspDiagnostics && { lspDiagnostics: (result as any).lspDiagnostics }),
            ...((result as any).typeDefinitions && { typeDefinitions: (result as any).typeDefinitions }),
            ...((result as any).references && { references: (result as any).references }),
            ...((result as any).lspMetadata && { lspMetadata: (result as any).lspMetadata })
          }
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
      return false;
    }
  }

  // Add cross-reference detection
  async detectCrossReferences(projectId: string): Promise<{
    references: Array<{
      fromFile: string;
      toFile: string;
      referenceType: string;
      lineNumber: number;
    }>;
    totalReferences: number;
  }> {
    try {
      // Get cross-reference data from storage
      const references: any = await this.storageCoordinator.getCrossReferences(projectId);

      // Handle case where storage doesn't implement this yet
      if (!references) {
        return {
          references: [],
          totalReferences: 0
        };
      }

      return {
        references,
        totalReferences: references.length
      };
    } catch (error) {
      this.logger.error('Failed to detect cross-references', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return empty data instead of throwing
      return {
        references: [],
        totalReferences: 0
      };
    }
  }

  // Add dependency analysis
  async analyzeDependencies(projectId: string): Promise<{
    dependencies: Array<{
      file: string;
      imports: string[];
      exports: string[];
      externalDependencies: string[];
    }>;
    dependencyGraph: Map<string, string[]>;
  }> {
    try {
      // Get dependency data from storage
      const dependencies: any = await this.storageCoordinator.getDependencies(projectId);

      // Handle case where storage doesn't implement this yet
      if (!dependencies) {
        return {
          dependencies: [],
          dependencyGraph: new Map()
        };
      }

      // Build dependency graph
      const dependencyGraph = new Map<string, string[]>();
      dependencies.forEach((dep: { file: string; imports: string[]; }) => {
        dependencyGraph.set(dep.file, dep.imports);
      });

      return {
        dependencies,
        dependencyGraph
      };
    } catch (error) {
      this.logger.error('Failed to analyze dependencies', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return empty data instead of throwing
      return {
        dependencies: [],
        dependencyGraph: new Map()
      };
    }
  }

  // Add overlap detection
  async detectOverlaps(projectId: string): Promise<{
    overlaps: Array<{
      file1: string;
      file2: string;
      overlapPercentage: number;
      commonLines: number[];
    }>;
    totalOverlaps: number;
  }> {
    try {
      // Get overlap data from storage
      const overlaps: any = await this.storageCoordinator.getOverlaps(projectId);

      // Handle case where storage doesn't implement this yet
      if (!overlaps) {
        return {
          overlaps: [],
          totalOverlaps: 0
        };
      }

      return {
        overlaps,
        totalOverlaps: overlaps.length
      };
    } catch (error) {
      this.logger.error('Failed to detect overlaps', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return empty data instead of throwing
      return {
        overlaps: [],
        totalOverlaps: 0
      };
    }
  }

  // Add status monitoring
  async getIndexStatus(projectPath: string): Promise<{
    exists: boolean;
    lastUpdated: Date | null;
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
    languages: string[];
  }> {
    try {
      const projectId = await HashUtils.calculateDirectoryHash(projectPath);
      const status: any = await this.storageCoordinator.getProjectStatus(projectId.hash);

      // Handle case where storage doesn't implement this yet
      if (!status) {
        return {
          exists: false,
          lastUpdated: null,
          totalFiles: 0,
          totalChunks: 0,
          totalSize: 0,
          languages: []
        };
      }

      return {
        exists: status.exists,
        lastUpdated: status.lastUpdated,
        totalFiles: status.totalFiles,
        totalChunks: status.totalChunks,
        totalSize: status.totalSize,
        languages: status.languages
      };
    } catch (error) {
      this.logger.error('Failed to get index status', {
        projectPath,
        error: error instanceof Error ? error.message : String(error)
      });
      // Return default status instead of throwing
      return {
        exists: false,
        lastUpdated: null,
        totalFiles: 0,
        totalChunks: 0,
        totalSize: 0,
        languages: []
      };
    }
  }

  // Get overall system status
  async getStatus(): Promise<{
    indexing: {
      activeProjects: string[];
      totalIndexedFiles: number;
      totalChunks: number;
      indexingRate: number;
    };
    storage: {
      totalProjects: number;
      totalFiles: number;
      totalChunks: number;
      storageSize: number;
    };
    performance: {
      memoryUsage: number;
      cpuUsage: number;
      processingRate: number;
    };
  }> {
    try {
      const storageStats: any = await this.storageCoordinator.getStorageStats();
      const indexingStats: any = await this.storageCoordinator.getIndexingStats();

      // Handle case where storage doesn't implement these methods yet
      const defaultStorageStats = {
        totalProjects: 0,
        totalFiles: 0,
        totalChunks: 0,
        storageSize: 0
      };

      const defaultIndexingStats = {
        totalIndexedFiles: 0,
        totalChunks: 0,
        indexingRate: 0,
        processingRate: 0
      };

      return {
        indexing: {
          activeProjects: Array.from(this.currentIndexing.keys()),
          totalIndexedFiles: indexingStats?.totalIndexedFiles || defaultIndexingStats.totalIndexedFiles,
          totalChunks: indexingStats?.totalChunks || defaultIndexingStats.totalChunks,
          indexingRate: indexingStats?.indexingRate || defaultIndexingStats.indexingRate
        },
        storage: {
          totalProjects: storageStats?.totalProjects || defaultStorageStats.totalProjects,
          totalFiles: storageStats?.totalFiles || defaultStorageStats.totalFiles,
          totalChunks: storageStats?.totalChunks || defaultStorageStats.totalChunks,
          storageSize: storageStats?.storageSize || defaultStorageStats.storageSize
        },
        performance: {
          memoryUsage: this.memoryManager.getCurrentMemoryUsage(),
          cpuUsage: 0, // TODO: Implement CPU usage monitoring
          processingRate: indexingStats?.processingRate || defaultIndexingStats.processingRate
        }
      };
    } catch (error) {
      this.logger.error('Failed to get system status', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Return default status instead of throwing
      return {
        indexing: {
          activeProjects: [],
          totalIndexedFiles: 0,
          totalChunks: 0,
          indexingRate: 0
        },
        storage: {
          totalProjects: 0,
          totalFiles: 0,
          totalChunks: 0,
          storageSize: 0
        },
        performance: {
          memoryUsage: 0,
          cpuUsage: 0,
          processingRate: 0
        }
      };
    }
  }

  // Search functionality
  async search(query: SearchQuery): Promise<any> {
    try {
      return await this.searchCoordinator.search(query);
    } catch (error) {
      this.logger.error('Search failed', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Check if indexing is active for a project
  isIndexingActive(projectPath: string): boolean {
    const normalizedPath = projectPath.replace(/\\/g, '/');
    return this.currentIndexing.has(normalizedPath);
  }

  // Mark project as indexing
  private markIndexingActive(projectPath: string): void {
    const normalizedPath = projectPath.replace(/\\/g, '/');
    this.currentIndexing.set(normalizedPath, true);
  }

  // Mark project as not indexing
  private markIndexingInactive(projectPath: string): void {
    const normalizedPath = projectPath.replace(/\\/g, '/');
    this.currentIndexing.delete(normalizedPath);
  }

  // Get active indexing projects
  getActiveIndexing(): string[] {
    return Array.from(this.currentIndexing.keys());
  }
}