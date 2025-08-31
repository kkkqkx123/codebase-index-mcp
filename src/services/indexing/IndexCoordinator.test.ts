import { Container } from 'inversify';
import { IndexCoordinator } from './IndexCoordinator';
import { ParserService } from '../parser/ParserService';
import { StorageCoordinator } from '../storage/StorageCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { AsyncPipeline } from '../infrastructure/AsyncPipeline';
import { BatchProcessor } from '../processing/BatchProcessor';
import { MemoryManager } from '../processing/MemoryManager';
import { SearchCoordinator } from '../search/SearchCoordinator';
import { TYPES } from '../../core/DIContainer';
import { HashUtils } from '../../utils/HashUtils';

// Mock HashUtils
jest.mock('../../utils/HashUtils', () => ({
  HashUtils: {
    calculateDirectoryHash: jest.fn(),
    calculateStringHash: jest.fn(),
  },
}));

describe('IndexCoordinator', () => {
  let container: Container;
  let indexCoordinator: IndexCoordinator;
  let mockParserService: jest.Mocked<ParserService>;
  let mockStorageCoordinator: jest.Mocked<StorageCoordinator>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockFileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let mockAsyncPipeline: jest.Mocked<AsyncPipeline>;
  let mockBatchProcessor: jest.Mocked<BatchProcessor>;
  let mockMemoryManager: jest.Mocked<MemoryManager>;
  let mockSearchCoordinator: jest.Mocked<SearchCoordinator>;

  beforeEach(() => {
    container = new Container();

    // Create mocks for actual dependencies
    mockParserService = {
      parseFile: jest.fn(),
      parseFiles: jest.fn(),
    } as any;

    mockStorageCoordinator = {
      store: jest.fn(),
      deleteFiles: jest.fn(),
      deleteProject: jest.fn(),
      searchVectors: jest.fn(),
      searchGraph: jest.fn(),
      getSnippetStatistics: jest.fn(),
      findSnippetByHash: jest.fn(),
      findSnippetReferences: jest.fn(),
      analyzeSnippetDependencies: jest.fn(),
      findSnippetOverlaps: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockReturnValue({
        batchSize: 50,
        maxConcurrency: 5,
      }),
    } as any;

    mockFileSystemTraversal = {
      traverseDirectory: jest.fn(),
    } as any;

    mockAsyncPipeline = {
      execute: jest.fn(),
      addStep: jest.fn().mockReturnThis(),
      clearSteps: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    mockBatchProcessor = {
      processInBatches: jest.fn(),
    } as any;

    mockMemoryManager = {
      checkMemory: jest.fn(),
      startMonitoring: jest.fn(),
    } as any;

    mockSearchCoordinator = {
      search: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.ParserService).toConstantValue(mockParserService);
    container.bind(TYPES.StorageCoordinator).toConstantValue(mockStorageCoordinator);
    container.bind(TYPES.FileSystemTraversal).toConstantValue(mockFileSystemTraversal);
    container.bind(AsyncPipeline).toConstantValue(mockAsyncPipeline);
    container.bind(BatchProcessor).toConstantValue(mockBatchProcessor);
    container.bind(MemoryManager).toConstantValue(mockMemoryManager);
    container.bind(TYPES.SearchCoordinator).toConstantValue(mockSearchCoordinator);
    container.bind(TYPES.IndexCoordinator).to(IndexCoordinator);

    indexCoordinator = container.get<IndexCoordinator>(TYPES.IndexCoordinator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createIndex', () => {
    it('should create index for a project', async () => {
      const projectPath = '/src/project';
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 3,
        files: [],
      };
      
      const mockPipelineResult = {
        success: true,
        data: {
          traversalResult: {
            files: [
              { path: '/src/project/auth.ts' },
              { path: '/src/project/user.ts' },
              { path: '/src/project/utils.js' },
            ],
          },
          storageResult: {
            chunksStored: 150,
            errors: [],
          },
          projectId: 'abc123',
        },
        steps: [],
        totalTime: 100,
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockAsyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(projectPath);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(3);
      expect(result.chunksCreated).toBe(150);
      expect(mockAsyncPipeline.execute).toHaveBeenCalledWith({
        projectPath,
        options: {},
      });
    });

    it('should handle indexing errors gracefully', async () => {
      const projectPath = '/src/project';
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 0,
        files: [],
      };
      
      const mockPipelineResult = {
        success: false,
        data: null,
        steps: [],
        totalTime: 50,
        error: 'Pipeline execution failed',
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockAsyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(projectPath);

      expect(result.success).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.errors).toContain('Pipeline execution failed');
    });
  });

  describe('updateIndex', () => {
    it('should update index for modified files', async () => {
      const projectPath = '/src/project';
      const changedFiles = ['/src/project/auth.ts', '/src/project/user.ts'];
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 2,
        files: [],
      };
      
      const mockParseResults = [
        {
          filePath: '/src/project/auth.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {},
        },
        {
          filePath: '/src/project/user.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {},
        },
      ];

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockParserService.parseFiles.mockResolvedValue(mockParseResults);
      mockStorageCoordinator.store.mockResolvedValue({
        success: true,
        chunksStored: 50,
        errors: [],
      });

      const result = await indexCoordinator.updateIndex(projectPath, changedFiles);

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.chunksCreated).toBe(50);
      expect(mockParserService.parseFiles).toHaveBeenCalledWith(changedFiles);
      expect(mockStorageCoordinator.store).toHaveBeenCalled();
    });

    it('should handle update errors gracefully', async () => {
      const projectPath = '/src/project';
      const changedFiles = ['/src/project/broken.ts'];
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 1,
        files: [],
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockParserService.parseFiles.mockRejectedValue(new Error('Parse error'));

      const result = await indexCoordinator.updateIndex(projectPath, changedFiles);

      expect(result.success).toBe(false);
      expect(result.filesProcessed).toBe(0);
      expect(result.errors).toContain('Parse error');
    });
  });

  describe('deleteIndex', () => {
    it('should delete index for a project', async () => {
      const projectPath = '/src/project';
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 10,
        files: [],
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockStorageCoordinator.deleteProject.mockResolvedValue({
        success: true,
        filesDeleted: 10,
        errors: [],
      });

      const result = await indexCoordinator.deleteIndex(projectPath);

      expect(result).toBe(true);
      expect(mockStorageCoordinator.deleteProject).toHaveBeenCalledWith('abc123');
    });

    it('should handle delete errors gracefully', async () => {
      const projectPath = '/src/project';
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 10,
        files: [],
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);
      mockStorageCoordinator.deleteProject.mockResolvedValue({
        success: false,
        filesDeleted: 0,
        errors: ['Delete failed'],
      });

      const result = await indexCoordinator.deleteIndex(projectPath);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('processIncrementalChanges', () => {
    it('should process incremental file changes', async () => {
      const changes = [
        { type: 'created' as const, path: '/src/new.ts', relativePath: 'new.ts', timestamp: new Date() },
        { type: 'modified' as const, path: '/src/modified.ts', relativePath: 'modified.ts', timestamp: new Date() },
        { type: 'deleted' as const, path: '/src/deleted.ts', relativePath: 'deleted.ts', timestamp: new Date() },
      ];

      const mockParseResults = [
        {
          filePath: '/src/new.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {},
        },
        {
          filePath: '/src/modified.ts',
          language: 'typescript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          metadata: {},
        },
      ];

      mockParserService.parseFiles.mockResolvedValue(mockParseResults);
      mockStorageCoordinator.store.mockResolvedValue({
        success: true,
        chunksStored: 30,
        errors: [],
      });

      await indexCoordinator.processIncrementalChanges(changes);

      expect(mockStorageCoordinator.deleteFiles).toHaveBeenCalledWith(['deleted.ts']);
      expect(mockParserService.parseFiles).toHaveBeenCalledWith(['new.ts', 'modified.ts']);
      expect(mockStorageCoordinator.store).toHaveBeenCalled();
    });

    it('should handle empty changes', async () => {
      const changes: any[] = [];

      await indexCoordinator.processIncrementalChanges(changes);

      expect(mockLoggerService.debug).toHaveBeenCalledWith('No changes to process');
      expect(mockStorageCoordinator.deleteFiles).not.toHaveBeenCalled();
      expect(mockParserService.parseFiles).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should delegate search to SearchCoordinator', async () => {
      const query = 'test function';
      const mockSearchResponse = {
        results: [
          {
            id: '1',
            score: 0.95,
            finalScore: 0.95,
            filePath: '/src/test.ts',
            content: 'function test() {}',
            startLine: 1,
            endLine: 1,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
          },
        ],
        totalResults: 1,
        queryTime: 50,
        searchStrategy: 'semantic',
        filters: {},
        options: {},
      };

      mockSearchCoordinator.search.mockResolvedValue(mockSearchResponse);

      const result = await indexCoordinator.search(query);

      expect(result).toEqual(mockSearchResponse.results);
      expect(mockSearchCoordinator.search).toHaveBeenCalledWith({
        text: query,
        options: {
          limit: undefined,
          threshold: undefined,
          includeGraph: undefined,
          useHybrid: false,
          useReranking: true,
        },
      });
    });

    it('should handle search errors', async () => {
      const query = 'test function';
      mockSearchCoordinator.search.mockRejectedValue(new Error('Search failed'));
      mockErrorHandlerService.handleError.mockImplementation(() => undefined as any);

      await expect(indexCoordinator.search(query)).rejects.toThrow('Search failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return index status', async () => {
      const projectPath = '/src/project';
      const mockHashResult = {
        hash: 'abc123',
        fileCount: 10,
        files: [],
      };

      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue(mockHashResult);

      const mockIndexStatus = {
        lastIndexed: new Date(),
        fileCount: 150,
        chunkCount: 450,
        status: 'completed' as const,
      };

      // Mock the getIndexStatus method
      const getIndexStatusSpy = jest.spyOn(indexCoordinator as any, 'getIndexStatus').mockResolvedValue(mockIndexStatus);

      const result = await indexCoordinator.getStatus(projectPath);

      expect(result.projectId).toBe('abc123');
      expect(result.isIndexing).toBe(false);
      expect(result.fileCount).toBe(150);
      expect(result.chunkCount).toBe(450);
      expect(result.status).toBe('completed');

      getIndexStatusSpy.mockRestore();
    });
  });

  describe('getSnippetProcessingStatus', () => {
    it('should return snippet processing statistics', async () => {
      const projectId = 'test-project';
      const mockStats = {
        totalSnippets: 150,
        processedSnippets: 142,
        duplicateSnippets: 8,
        processingRate: 45.2,
      };

      mockStorageCoordinator.getSnippetStatistics.mockResolvedValue(mockStats);

      const result = await indexCoordinator.getSnippetProcessingStatus(projectId);

      expect(result).toEqual(mockStats);
      expect(mockStorageCoordinator.getSnippetStatistics).toHaveBeenCalledWith(projectId);
    });
  });

  describe('checkForDuplicates', () => {
    it('should check for duplicate snippets', async () => {
      const snippetContent = 'function test() { return true; }';
      const projectId = 'test-project';
      const mockExistingSnippet = { id: 'existing-123' };

      (HashUtils.calculateStringHash as jest.Mock).mockReturnValue('content-hash');
      mockStorageCoordinator.findSnippetByHash.mockResolvedValue(mockExistingSnippet);

      const result = await indexCoordinator.checkForDuplicates(snippetContent, projectId);

      expect(result).toBe(true);
      expect(mockStorageCoordinator.findSnippetByHash).toHaveBeenCalledWith('content-hash', projectId);
    });

    it('should return false for non-duplicate snippets', async () => {
      const snippetContent = 'function unique() { return true; }';
      const projectId = 'test-project';

      (HashUtils.calculateStringHash as jest.Mock).mockReturnValue('unique-hash');
      mockStorageCoordinator.findSnippetByHash.mockResolvedValue(null);

      const result = await indexCoordinator.checkForDuplicates(snippetContent, projectId);

      expect(result).toBe(false);
    });
  });
});