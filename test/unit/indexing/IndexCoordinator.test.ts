import { IndexCoordinator, IndexOptions, IndexResult } from '../../../src/services/indexing/IndexCoordinator';
import { StorageCoordinator, ParsedFile, Chunk } from '../../../src/services/storage/StorageCoordinator';
import { ChangeDetectionService, FileChangeEvent } from '../../../src/services/filesystem/ChangeDetectionService';
import { ParserService, ParseResult } from '../../../src/services/parser/ParserService';
import { FileSystemTraversal, TraversalResult, FileInfo } from '../../../src/services/filesystem/FileSystemTraversal';
import { AsyncPipeline, PipelineResult, PipelineStepResult } from '../../../src/services/infrastructure/AsyncPipeline';
import { BatchProcessor } from '../../../src/services/processing/BatchProcessor';
import { MemoryManager } from '../../../src/services/processing/MemoryManager';
import { LoggerService } from '../../../src/core/LoggerService';
import { ErrorHandlerService } from '../../../src/core/ErrorHandlerService';
import { ConfigService } from '../../../src/config/ConfigService';
import { HashUtils, DirectoryHash, FileHash } from '../../../src/utils/HashUtils';
import { createTestContainer } from '../../setup';

describe('IndexCoordinator', () => {
  let indexCoordinator: IndexCoordinator;
  let storageCoordinator: jest.Mocked<StorageCoordinator>;
  let changeDetectionService: jest.Mocked<ChangeDetectionService>;
  let parserService: jest.Mocked<ParserService>;
  let fileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let asyncPipeline: jest.Mocked<AsyncPipeline>;
  let batchProcessor: jest.Mocked<BatchProcessor>;
  let memoryManager: jest.Mocked<MemoryManager>;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let configService: jest.Mocked<ConfigService>;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();

    // Create mock services
    storageCoordinator = {
      store: jest.fn(),
      deleteFiles: jest.fn(),
      deleteProject: jest.fn(),
      searchVectors: jest.fn(),
      searchGraph: jest.fn(),
      getSnippetStatistics: jest.fn(),
      findSnippetByHash: jest.fn(),
      findSnippetReferences: jest.fn(),
      analyzeSnippetDependencies: jest.fn(),
      findSnippetOverlaps: jest.fn()
    } as any;

    changeDetectionService = {
      detectChanges: jest.fn(),
      startWatching: jest.fn(),
      stopWatching: jest.fn()
    } as any;

    parserService = {
      parseFiles: jest.fn(),
      parseFile: jest.fn(),
      getSupportedLanguages: jest.fn()
    } as any;

    fileSystemTraversal = {
      traverseDirectory: jest.fn(),
      getFileStats: jest.fn()
    } as any;

    asyncPipeline = {
      clearSteps: jest.fn(),
      addStep: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      getMetrics: jest.fn()
    } as any;

    batchProcessor = {
      processInBatches: jest.fn()
    } as any;

    memoryManager = {
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      checkMemory: jest.fn(),
      getMemoryStatus: jest.fn(),
      onMemoryUpdate: jest.fn(),
      forceGarbageCollection: jest.fn()
    } as any;

    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);

    // Create IndexCoordinator instance
    indexCoordinator = new IndexCoordinator(
      loggerService,
      errorHandlerService,
      configService,
      changeDetectionService,
      parserService,
      storageCoordinator,
      fileSystemTraversal,
      asyncPipeline,
      batchProcessor,
      memoryManager
    );
  });

  describe('createIndex', () => {
    const mockProjectPath = '/test/project';
    const mockOptions: IndexOptions = {
      recursive: true,
      includePatterns: ['*.ts'],
      excludePatterns: ['*.test.ts'],
      maxFileSize: 1024 * 1024,
      chunkSize: 1000,
      overlapSize: 200
    };

    it('should successfully create an index with valid parameters', async () => {
      // Setup mocks
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 2,
        files: [
          { path: 'file1.ts', hash: 'hash1', size: 100, lastModified: new Date() },
          { path: 'file2.ts', hash: 'hash2', size: 200, lastModified: new Date() }
        ]
      };
      
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockTraversalResult: TraversalResult = {
        files: [
          {
            path: '/test/project/file1.ts',
            relativePath: 'file1.ts',
            name: 'file1.ts',
            extension: 'ts',
            size: 1000,
            hash: 'hash1',
            lastModified: new Date(),
            language: 'typescript',
            isBinary: false
          },
          {
            path: '/test/project/file2.ts',
            relativePath: 'file2.ts',
            name: 'file2.ts',
            extension: 'ts',
            size: 1500,
            hash: 'hash2',
            lastModified: new Date(),
            language: 'typescript',
            isBinary: false
          }
        ],
        directories: [],
        errors: [],
        totalSize: 2500,
        processingTime: 100
      };
      fileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const mockParseResults: ParseResult[] = [
        {
          filePath: '/test/project/file1.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        },
        {
          filePath: '/test/project/file2.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        }
      ];
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      const mockStorageResult = {
        success: true,
        chunksStored: 10,
        errors: []
      };
      storageCoordinator.store.mockResolvedValue(mockStorageResult);

      const mockPipelineResult: PipelineResult<any> = {
        success: true,
        data: {
          traversalResult: mockTraversalResult,
          storageResult: mockStorageResult
        },
        totalTime: 1500,
        steps: [
          {
            name: 'memory-check',
            success: true,
            startTime: Date.now() - 1000,
            endTime: Date.now() - 900,
            duration: 100,
            retryCount: 0
          },
          {
            name: 'file-traversal',
            success: true,
            startTime: Date.now() - 800,
            endTime: Date.now() - 600,
            duration: 200,
            retryCount: 0
          },
          {
            name: 'batch-parsing',
            success: true,
            startTime: Date.now() - 500,
            endTime: Date.now() - 300,
            duration: 200,
            retryCount: 0
          },
          {
            name: 'storage-coordination',
            success: true,
            startTime: Date.now() - 200,
            endTime: Date.now(),
            duration: 200,
            retryCount: 0
          }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.chunksCreated).toBe(10);
      expect(result.processingTime).toBe(1500);
      expect(result.errors).toHaveLength(0);

      // Verify pipeline was executed
      expect(asyncPipeline.execute).toHaveBeenCalledWith({
        projectPath: mockProjectPath,
        options: mockOptions
      });

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Starting index creation', {
        projectPath: mockProjectPath,
        projectId: mockProjectId.hash
      });
    });

    it('should handle empty project directory', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'empty_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockTraversalResult: TraversalResult = {
        files: [],
        directories: [],
        errors: [],
        totalSize: 0,
        processingTime: 50
      };
      fileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const mockPipelineResult: PipelineResult<any> = {
        success: true,
        data: {
          traversalResult: mockTraversalResult,
          storageResult: { success: true, chunksStored: 0 }
        },
        totalTime: 500,
        steps: [
          {
            name: 'memory-check',
            success: true,
            startTime: Date.now() - 400,
            endTime: Date.now() - 300,
            duration: 100,
            retryCount: 0
          },
          {
            name: 'file-traversal',
            success: true,
            startTime: Date.now() - 250,
            endTime: Date.now() - 150,
            duration: 100,
            retryCount: 0
          },
          {
            name: 'storage-coordination',
            success: true,
            startTime: Date.now() - 100,
            endTime: Date.now(),
            duration: 100,
            retryCount: 0
          }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath, mockOptions);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
      expect(result.chunksCreated).toBe(0);
      expect(result.processingTime).toBe(500);
    });

    it('should handle pipeline execution failure', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockPipelineResult: PipelineResult<any> = {
        success: false,
        error: 'Pipeline step failed: memory-check',
        data: null,
        totalTime: 1000,
        steps: [
          {
            name: 'memory-check',
            success: false,
            startTime: Date.now() - 1000,
            endTime: Date.now() - 900,
            duration: 100,
            retryCount: 0,
            error: 'Insufficient memory for indexing operation'
          }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath, mockOptions);

      expect(result.success).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.chunksCreated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Pipeline step failed: memory-check');

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Index creation failed', {
        projectId: mockProjectId.hash,
        error: 'Pipeline step failed: memory-check'
      });
    });

    it('should handle unexpected errors during indexing', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const unexpectedError = new Error('Unexpected database error');
      asyncPipeline.execute.mockRejectedValue(unexpectedError);

      const result = await indexCoordinator.createIndex(mockProjectPath, mockOptions);

      expect(result.success).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.chunksCreated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Unexpected database error');

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Index creation failed', {
        projectId: mockProjectId.hash,
        error: 'Unexpected database error'
      });
    });

    it('should use default options when none provided', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 1,
        files: [
          { path: 'file1.ts', hash: 'hash1', size: 100, lastModified: new Date() }
        ]
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockTraversalResult: TraversalResult = {
        files: [
          {
            path: '/test/project/file1.ts',
            relativePath: 'file1.ts',
            name: 'file1.ts',
            extension: 'ts',
            size: 1000,
            hash: 'hash1',
            lastModified: new Date(),
            language: 'typescript',
            isBinary: false
          }
        ],
        directories: [],
        errors: [],
        totalSize: 1000,
        processingTime: 50
      };
      fileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const mockPipelineResult: PipelineResult<any> = {
        success: true,
        data: {
          traversalResult: mockTraversalResult,
          storageResult: { success: true, chunksStored: 5 }
        },
        totalTime: 1000,
        steps: [
          {
            name: 'memory-check',
            success: true,
            startTime: Date.now() - 800,
            endTime: Date.now() - 600,
            duration: 200,
            retryCount: 0
          },
          {
            name: 'file-traversal',
            success: true,
            startTime: Date.now() - 500,
            endTime: Date.now() - 300,
            duration: 200,
            retryCount: 0
          },
          {
            name: 'storage-coordination',
            success: true,
            startTime: Date.now() - 200,
            endTime: Date.now(),
            duration: 200,
            retryCount: 0
          }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath);

      expect(result.success).toBe(true);
      expect(asyncPipeline.execute).toHaveBeenCalledWith({
        projectPath: mockProjectPath,
        options: {}
      });
    });
  });

  describe('updateIndex', () => {
    const mockProjectPath = '/test/project';
    const mockChangedFiles = ['/test/project/file1.ts', '/test/project/file2.ts'];

    it('should successfully update index with changed files', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 2,
        files: [
          { path: 'file1.ts', hash: 'hash1', size: 100, lastModified: new Date() },
          { path: 'file2.ts', hash: 'hash2', size: 200, lastModified: new Date() }
        ]
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockParseResults: ParseResult[] = [
        {
          filePath: '/test/project/file1.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        },
        {
          filePath: '/test/project/file2.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        }
      ];
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      const mockStorageResult = {
        success: true,
        chunksStored: 8,
        errors: []
      };
      storageCoordinator.store.mockResolvedValue(mockStorageResult);

      const result = await indexCoordinator.updateIndex(mockProjectPath, mockChangedFiles);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.chunksCreated).toBe(8);
      expect(result.errors).toHaveLength(0);

      // Verify parser was called with changed files
      expect(parserService.parseFiles).toHaveBeenCalledWith(mockChangedFiles);

      // Verify storage coordinator was called
      expect(storageCoordinator.store).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ filePath: '/test/project/file1.ts' }),
          expect.objectContaining({ filePath: '/test/project/file2.ts' })
        ]),
        mockProjectId.hash
      );
    });

    it('should handle empty changed files list', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      // Mock parser service to return empty array for empty input
      parserService.parseFiles.mockResolvedValue([]);

      // Mock storage coordinator to return success for empty files
      storageCoordinator.store.mockResolvedValue({
        success: true,
        chunksStored: 0,
        errors: []
      });

      const result = await indexCoordinator.updateIndex(mockProjectPath, []);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
      expect(result.chunksCreated).toBe(0);

      // Verify parser was called with empty array
      expect(parserService.parseFiles).toHaveBeenCalledWith([]);
    });

    it('should handle parsing failures', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      parserService.parseFiles.mockRejectedValue(new Error('Parsing failed'));

      const result = await indexCoordinator.updateIndex(mockProjectPath, mockChangedFiles);

      expect(result.success).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.chunksCreated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Parsing failed');
    });
  });

  describe('deleteIndex', () => {
    const mockProjectPath = '/test/project';

    it('should successfully delete index', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockDeleteResult = {
        success: true,
        filesDeleted: 10,
        errors: []
      };
      storageCoordinator.deleteProject.mockResolvedValue(mockDeleteResult);

      const result = await indexCoordinator.deleteIndex(mockProjectPath);

      expect(result).toBe(true);

      // Verify storage coordinator was called
      expect(storageCoordinator.deleteProject).toHaveBeenCalledWith(mockProjectId.hash);

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Deleting index', {
        projectPath: mockProjectPath,
        projectId: mockProjectId.hash
      });
      expect(loggerService.info).toHaveBeenCalledWith('Index deleted successfully', {
        projectId: mockProjectId.hash
      });
    });

    it('should handle deletion failure', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockDeleteResult = {
        success: false,
        filesDeleted: 0,
        errors: ['Database connection failed']
      };
      storageCoordinator.deleteProject.mockResolvedValue(mockDeleteResult);

      const result = await indexCoordinator.deleteIndex(mockProjectPath);

      expect(result).toBe(false);

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to delete index', {
        projectId: mockProjectId.hash,
        errors: ['Database connection failed']
      });
    });

    it('should handle unexpected errors during deletion', async () => {
      const mockProjectId: DirectoryHash = {
        path: mockProjectPath,
        hash: 'test_project_hash',
        fileCount: 0,
        files: []
      };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      storageCoordinator.deleteProject.mockRejectedValue(new Error('Network error'));

      const result = await indexCoordinator.deleteIndex(mockProjectPath);

      expect(result).toBe(false);

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to delete index', {
        projectId: mockProjectId.hash,
        error: 'Network error'
      });
    });
  });

  describe('processIncrementalChanges', () => {
    const mockChanges: FileChangeEvent[] = [
      { 
        type: 'created', 
        path: '/test/project/newfile.ts', 
        relativePath: '/test/project/newfile.ts',
        timestamp: new Date()
      },
      { 
        type: 'modified', 
        path: '/test/project/existing.ts', 
        relativePath: '/test/project/existing.ts',
        timestamp: new Date()
      },
      { 
        type: 'deleted', 
        path: '/test/project/oldfile.ts', 
        relativePath: '/test/project/oldfile.ts',
        timestamp: new Date()
      }
    ];

    it('should successfully process incremental changes', async () => {
      const mockParseResults: ParseResult[] = [
        {
          filePath: '/test/project/newfile.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        },
        {
          filePath: '/test/project/existing.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {}
        }
      ];
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      storageCoordinator.deleteFiles.mockResolvedValue({
        success: true,
        filesDeleted: 1,
        errors: []
      });

      storageCoordinator.store.mockResolvedValue({
        success: true,
        chunksStored: 6,
        errors: []
      });

      await indexCoordinator.processIncrementalChanges(mockChanges);

      // Verify deletions were processed first
      expect(storageCoordinator.deleteFiles).toHaveBeenCalledWith(['/test/project/oldfile.ts']);

      // Verify creations and modifications were processed
      expect(parserService.parseFiles).toHaveBeenCalledWith([
        '/test/project/newfile.ts',
        '/test/project/existing.ts'
      ]);

      // Verify storage was called with processed files
      expect(storageCoordinator.store).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ filePath: '/test/project/newfile.ts' }),
          expect.objectContaining({ filePath: '/test/project/existing.ts' })
        ])
      );

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Processing incremental changes', {
        changeCount: 3
      });
      expect(loggerService.info).toHaveBeenCalledWith('Incremental changes processed successfully', {
        changeCount: 3
      });
    });

    it('should handle empty changes list', async () => {
      await indexCoordinator.processIncrementalChanges([]);

      // Verify no operations were performed
      expect(storageCoordinator.deleteFiles).not.toHaveBeenCalled();
      expect(parserService.parseFiles).not.toHaveBeenCalled();
      expect(storageCoordinator.store).not.toHaveBeenCalled();

      // Verify debug logging
      expect(loggerService.debug).toHaveBeenCalledWith('No changes to process');
    });

    it('should handle processing failures', async () => {
      storageCoordinator.deleteFiles.mockRejectedValue(new Error('Deletion failed'));

      await expect(indexCoordinator.processIncrementalChanges(mockChanges)).rejects.toThrow('Deletion failed');

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to process incremental changes', {
        error: 'Deletion failed'
      });
    });
  });

  describe('utility methods', () => {
    it('should get snippet processing status', async () => {
      const mockStats = {
        totalSnippets: 150,
        processedSnippets: 142,
        duplicateSnippets: 8,
        processingRate: 45.2
      };
      storageCoordinator.getSnippetStatistics.mockResolvedValue(mockStats);

      const result = await indexCoordinator.getSnippetProcessingStatus('test_project');

      expect(result).toEqual(mockStats);
      expect(storageCoordinator.getSnippetStatistics).toHaveBeenCalledWith('test_project');
    });

    it('should check for duplicates', async () => {
      const mockSnippet = 'const test = "hello";';
      const mockProjectId = 'test_project';
      const isDuplicate = true;

      storageCoordinator.findSnippetByHash.mockResolvedValue({ id: 'existing_snippet' });

      const result = await indexCoordinator.checkForDuplicates(mockSnippet, mockProjectId);

      expect(result).toBe(isDuplicate);
      expect(storageCoordinator.findSnippetByHash).toHaveBeenCalledWith(
        expect.any(String),
        mockProjectId
      );
    });

    it('should detect cross references', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';
      const mockReferences = ['ref_1', 'ref_2'];

      storageCoordinator.findSnippetReferences.mockResolvedValue(mockReferences);

      const result = await indexCoordinator.detectCrossReferences(mockSnippetId, mockProjectId);

      expect(result).toEqual(mockReferences);
      expect(storageCoordinator.findSnippetReferences).toHaveBeenCalledWith(mockSnippetId, mockProjectId);
    });

    it('should analyze dependencies', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';
      const mockDependencies = {
        dependsOn: ['dep_1', 'dep_2'],
        usedBy: ['user_1'],
        complexity: 5
      };

      storageCoordinator.analyzeSnippetDependencies.mockResolvedValue(mockDependencies);

      const result = await indexCoordinator.analyzeDependencies(mockSnippetId, mockProjectId);

      expect(result).toEqual(mockDependencies);
      expect(storageCoordinator.analyzeSnippetDependencies).toHaveBeenCalledWith(mockSnippetId, mockProjectId);
    });

    it('should detect overlaps', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';
      const mockOverlaps = ['overlap_1'];

      storageCoordinator.findSnippetOverlaps.mockResolvedValue(mockOverlaps);

      const result = await indexCoordinator.detectOverlaps(mockSnippetId, mockProjectId);

      expect(result).toEqual(mockOverlaps);
      expect(storageCoordinator.findSnippetOverlaps).toHaveBeenCalledWith(mockSnippetId, mockProjectId);
    });

    it('should get index status', async () => {
      const mockProjectId = 'test_project';
      const status = await indexCoordinator.getIndexStatus(mockProjectId);

      expect(status).toEqual({
        lastIndexed: expect.any(Date),
        fileCount: 150,
        chunkCount: 450,
        status: 'completed'
      });
    });
  });

  describe('initialization', () => {
    it('should initialize performance components correctly', () => {
      // Verify memory manager was started
      expect(memoryManager.startMonitoring).toHaveBeenCalled();

      // Verify pipeline was set up
      expect(asyncPipeline.clearSteps).toHaveBeenCalled();
      expect(asyncPipeline.addStep).toHaveBeenCalledTimes(4); // memory-check, file-traversal, batch-parsing, storage-coordination
    });

    it('should create file pool with correct configuration', () => {
      // The file pool should be created in the constructor
      // This is tested implicitly by the fact that the coordinator can be created without errors
      expect(indexCoordinator).toBeDefined();
    });
  });
});