import { StorageCoordinator, ParsedFile, Chunk, StorageResult, DeleteResult } from '../../../src/services/storage/StorageCoordinator';
import { VectorStorageService } from './vector/VectorStorageService';
import { GraphPersistenceService, GraphPersistenceOptions } from './graph/GraphPersistenceService';
import { TransactionCoordinator } from '../../../src/services/sync/TransactionCoordinator';
import { LoggerService } from '../../../src/core/LoggerService';
import { ErrorHandlerService } from '../../../src/core/ErrorHandlerService';
import { ConfigService } from '../../../src/config/ConfigService';
import { QdrantClientWrapper } from '../../../src/database/qdrant/QdrantClientWrapper';
import { createTestContainer } from '../../../test/setup';

describe('StorageCoordinator', () => {
  let storageCoordinator: StorageCoordinator;
  let vectorStorage: jest.Mocked<VectorStorageService>;
  let graphStorage: jest.Mocked<GraphPersistenceService>;
  let transactionCoordinator: jest.Mocked<TransactionCoordinator>;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let configService: jest.Mocked<ConfigService>;
  let qdrantClient: jest.Mocked<QdrantClientWrapper>;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();

    // Create mock services
    vectorStorage = {
      storeChunks: jest.fn(),
      deleteChunks: jest.fn(),
      search: jest.fn(),
      searchVectors: jest.fn(),
      deleteChunksByFiles: jest.fn(),
      getCollectionStats: jest.fn()
    } as any;

    graphStorage = {
      storeChunks: jest.fn(),
      deleteNodes: jest.fn(),
      search: jest.fn(),
      deleteNodesByFiles: jest.fn(),
      getGraphStats: jest.fn()
    } as any;

    transactionCoordinator = {
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      addVectorOperation: jest.fn(),
      addGraphOperation: jest.fn()
    } as any;

    qdrantClient = {
      getChunkIdsByFiles: jest.fn()
    } as any;

    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);
    
    // Mock configService.get to return qdrant config
    configService.get.mockImplementation((key: any): any => {
      if (key === 'qdrant') {
        return {
          host: 'localhost',
          port: 6333,
          collection: 'test_collection'
        };
      }
      return {};
    });

    // Create StorageCoordinator instance with mocked QdrantClientWrapper
    storageCoordinator = new StorageCoordinator(
      loggerService,
      errorHandlerService,
      configService,
      vectorStorage,
      graphStorage,
      transactionCoordinator,
      qdrantClient
    );
  });

  describe('store', () => {
    const mockFiles: ParsedFile[] = [
      {
        filePath: '/test/project/file1.ts',
        language: 'typescript',
        metadata: { size: 1000 },
        chunks: [
          {
            id: 'chunk_1',
            content: 'function test() { return true; }',
            filePath: '/test/project/file1.ts',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {},
            startByte: 0,
            endByte: 0,
            type: '',
            imports: [],
            exports: []
          },
          {
            id: 'chunk_2',
            content: 'const variable = "test";',
            filePath: '/test/project/file1.ts',
            startLine: 5,
            endLine: 5,
            language: 'typescript',
            chunkType: 'variable',
            metadata: {},
            startByte: 0,
            endByte: 0,
            type: '',
            imports: [],
            exports: []
          }
        ]
      },
      {
        filePath: '/test/project/file2.ts',
        language: 'typescript',
        metadata: { size: 1500 },
        chunks: [
          {
            id: 'chunk_3',
            content: 'class TestClass { constructor() {} }',
            filePath: '/test/project/file2.ts',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'class',
            metadata: {},
            startByte: 0,
            endByte: 0,
            type: '',
            imports: [],
            exports: []
          }
        ]
      }
    ];

    const mockProjectId = 'test_project_hash';

    it('should successfully store files with chunks', async () => {
      // Setup transaction mocks
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.store(mockFiles, mockProjectId);

      expect(result.success).toBe(true);
      expect(result.chunksStored).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Verify transaction was used
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        {
          type: 'storeChunks',
          chunks: expect.arrayContaining([
            expect.objectContaining({ id: 'chunk_1' }),
            expect.objectContaining({ id: 'chunk_2' }),
            expect.objectContaining({ id: 'chunk_3' })
          ]),
          options: {
            projectId: mockProjectId,
            overwriteExisting: true,
            batchSize: 3
          }
        },
        {
          type: 'deleteChunks',
          chunkIds: ['chunk_1', 'chunk_2', 'chunk_3']
        }
      );
      expect(transactionCoordinator.addGraphOperation).toHaveBeenCalledWith(
        {
          type: 'storeChunks',
          chunks: expect.arrayContaining([
            expect.objectContaining({ id: 'chunk_1' }),
            expect.objectContaining({ id: 'chunk_2' }),
            expect.objectContaining({ id: 'chunk_3' })
          ]),
          options: {
            projectId: mockProjectId,
            overwriteExisting: true,
            batchSize: 3
          }
        },
        {
          type: 'deleteNodes',
          nodeIds: ['chunk_1', 'chunk_2', 'chunk_3']
        }
      );
      expect(transactionCoordinator.commitTransaction).toHaveBeenCalled();

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Storing files in databases', {
        fileCount: 2,
        chunkCount: 3,
        projectId: mockProjectId
      });
      expect(loggerService.info).toHaveBeenCalledWith('Files stored successfully', {
        fileCount: 2,
        chunkCount: 3,
        projectId: mockProjectId
      });
    });

    it('should handle empty files array', async () => {
      const result = await storageCoordinator.store([], mockProjectId);

      expect(result.success).toBe(true);
      expect(result.chunksStored).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify no operations were performed
      expect(transactionCoordinator.beginTransaction).not.toHaveBeenCalled();
    });

    it('should handle files with no chunks', async () => {
      const filesWithoutChunks: ParsedFile[] = [
        {
          filePath: '/test/project/empty.ts',
          language: 'typescript',
          metadata: { size: 0 },
          chunks: []
        }
      ];

      const result = await storageCoordinator.store(filesWithoutChunks, mockProjectId);

      expect(result.success).toBe(true);
      expect(result.chunksStored).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify no operations were performed
      expect(transactionCoordinator.beginTransaction).not.toHaveBeenCalled();
    });

    it('should handle transaction commit failure', async () => {
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(false);
      transactionCoordinator.rollbackTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.store(mockFiles, mockProjectId);

      expect(result.success).toBe(false);
      expect(result.chunksStored).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Transaction failed');

      // Verify rollback was called
      expect(transactionCoordinator.rollbackTransaction).toHaveBeenCalled();

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to store files', {
        fileCount: 2,
        chunkCount: 3,
        projectId: mockProjectId,
        error: 'Transaction failed'
      });
    });

    it('should handle unexpected errors during storage', async () => {
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.rollbackTransaction.mockResolvedValue(true);

      const unexpectedError = new Error('Database connection failed');
      transactionCoordinator.addGraphOperation.mockRejectedValue(unexpectedError);

      const result = await storageCoordinator.store(mockFiles, mockProjectId);

      expect(result.success).toBe(false);
      expect(result.chunksStored).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Database connection failed');

      // Verify rollback was called
      expect(transactionCoordinator.rollbackTransaction).toHaveBeenCalled();

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to store files', {
        fileCount: 2,
        chunkCount: 3,
        projectId: mockProjectId,
        error: 'Database connection failed'
      });
    });

    it('should store files without project ID', async () => {
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.store(mockFiles);

      expect(result.success).toBe(true);
      expect(result.chunksStored).toBe(3);

      // Verify operations were called without project ID
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            projectId: undefined
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('deleteFiles', () => {
    const mockFilePaths = ['/test/project/file1.ts', '/test/project/file2.ts'];

    it('should successfully delete files', async () => {
      // Mock chunk IDs for files
      jest.spyOn(storageCoordinator as any, 'getChunkIdsForFiles').mockResolvedValue([
        'chunk_1', 'chunk_2', 'chunk_3'
      ]);

      // Setup transaction mocks
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.deleteFiles(mockFilePaths);

      expect(result.success).toBe(true);
      expect(result.filesDeleted).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify transaction was used
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        {
          type: 'deleteChunks',
          chunkIds: ['chunk_1', 'chunk_2', 'chunk_3']
        },
        {
          type: 'restoreChunks',
          chunkIds: ['chunk_1', 'chunk_2', 'chunk_3']
        }
      );
      expect(transactionCoordinator.addGraphOperation).toHaveBeenCalledWith(
        {
          type: 'deleteNodes',
          nodeIds: ['chunk_1', 'chunk_2', 'chunk_3']
        },
        {
          type: 'restoreNodes',
          nodeIds: ['chunk_1', 'chunk_2', 'chunk_3']
        }
      );
      expect(transactionCoordinator.commitTransaction).toHaveBeenCalled();

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Deleting files from databases', {
        fileCount: 2
      });
      expect(loggerService.info).toHaveBeenCalledWith('Files deleted successfully', {
        fileCount: 2,
        chunkCount: 3
      });
    });

    it('should handle empty file paths array', async () => {
      const result = await storageCoordinator.deleteFiles([]);

      expect(result.success).toBe(true);
      expect(result.filesDeleted).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify no operations were performed
      expect(transactionCoordinator.beginTransaction).not.toHaveBeenCalled();
    });

    it('should handle files with no chunks', async () => {
      jest.spyOn(storageCoordinator as any, 'getChunkIdsForFiles').mockResolvedValue([]);

      const result = await storageCoordinator.deleteFiles(mockFilePaths);

      expect(result.success).toBe(true);
      expect(result.filesDeleted).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify no transaction was started
      expect(transactionCoordinator.beginTransaction).not.toHaveBeenCalled();
    });

    it('should handle transaction failure during deletion', async () => {
      jest.spyOn(storageCoordinator as any, 'getChunkIdsForFiles').mockResolvedValue(['chunk_1']);
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(false);
      transactionCoordinator.rollbackTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.deleteFiles(mockFilePaths);

      expect(result.success).toBe(false);
      expect(result.filesDeleted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Transaction failed');

      // Verify rollback was called
      expect(transactionCoordinator.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    const mockProjectId = 'test_project_hash';

    it('should successfully delete project', async () => {
      // Mock chunk IDs for project
      qdrantClient.getChunkIdsByFiles.mockResolvedValue([
        'chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5'
      ]);

      // Setup transaction mocks
      transactionCoordinator.beginTransaction.mockResolvedValue('test_transaction_id');
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(true);

      const result = await storageCoordinator.deleteProject(mockProjectId);

      expect(result.success).toBe(true);
      expect(result.filesDeleted).toBe(5);
      expect(result.errors).toHaveLength(0);

      // Verify transaction was used
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        {
          type: 'deleteChunks',
          chunkIds: ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5']
        },
        {
          type: 'restoreChunks',
          chunkIds: ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5']
        }
      );
      expect(transactionCoordinator.addGraphOperation).toHaveBeenCalledWith(
        {
          type: 'deleteNodes',
          nodeIds: ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5']
        },
        {
          type: 'restoreNodes',
          nodeIds: ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5']
        }
      );
      expect(transactionCoordinator.commitTransaction).toHaveBeenCalled();

      // Verify logging
      expect(loggerService.info).toHaveBeenCalledWith('Deleting project from databases', {
        projectId: mockProjectId
      });
      expect(loggerService.info).toHaveBeenCalledWith('Project deleted successfully', {
        projectId: mockProjectId,
        chunkCount: 5
      });
    });

    it('should handle project with no chunks', async () => {
      qdrantClient.getChunkIdsByFiles.mockResolvedValue([]);

      const result = await storageCoordinator.deleteProject(mockProjectId);

      expect(result.success).toBe(true);
      expect(result.filesDeleted).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify no transaction was started
      expect(transactionCoordinator.beginTransaction).not.toHaveBeenCalled();
    });
  });

  describe('searchVectors', () => {
    const mockQuery = 'function test';
    const mockOptions = { limit: 10, threshold: 0.8 };
    const mockResults = [
      { id: 'chunk_1', score: 0.95, content: 'function test() { return true; }' },
      { id: 'chunk_2', score: 0.87, content: 'function test2() { return false; }' }
    ];

    it('should successfully search vectors', async () => {
      vectorStorage.search.mockResolvedValue(mockResults);

      const result = await storageCoordinator.searchVectors(mockQuery, mockOptions);

      expect(result).toEqual(mockResults);
      expect(vectorStorage.search).toHaveBeenCalledWith(mockQuery, mockOptions);
    });

    it('should handle search errors', async () => {
      const searchError = new Error('Vector search failed');
      vectorStorage.search.mockRejectedValue(searchError);

      await expect(storageCoordinator.searchVectors(mockQuery, mockOptions)).rejects.toThrow('Vector search failed');

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to search vectors', {
        query: mockQuery,
        options: mockOptions,
        error: 'Vector search failed'
      });
    });

    it('should search with default options', async () => {
      vectorStorage.search.mockResolvedValue([]);

      await storageCoordinator.searchVectors(mockQuery);

      expect(vectorStorage.search).toHaveBeenCalledWith(mockQuery, {});
    });
  });

  describe('searchGraph', () => {
    const mockQuery = 'MATCH (n:Function) RETURN n';
    const mockOptions: GraphPersistenceOptions = {
      limit: 5,
      projectId: 'test_project',
      batchSize: 10,
      type: 'semantic'
    };
    const mockResults = [
      { id: 'node_1', labels: ['Function'], properties: { name: 'test' } },
      { id: 'node_2', labels: ['Function'], properties: { name: 'test2' } }
    ];

    it('should successfully search graph', async () => {
      graphStorage.search.mockResolvedValue(mockResults);

      const result = await storageCoordinator.searchGraph(mockQuery, mockOptions);

      expect(result).toEqual(mockResults);
      expect(graphStorage.search).toHaveBeenCalledWith(mockQuery, mockOptions);
    });

    it('should handle search errors', async () => {
      const searchError = new Error('Graph search failed');
      graphStorage.search.mockRejectedValue(searchError);

      await expect(storageCoordinator.searchGraph(mockQuery, mockOptions)).rejects.toThrow('Graph search failed');

      // Verify error logging
      expect(loggerService.error).toHaveBeenCalledWith('Failed to search graph', {
        query: mockQuery,
        options: mockOptions,
        error: 'Graph search failed'
      });
    });
  });

  describe('utility methods', () => {
    it('should get snippet statistics', async () => {
      const mockProjectId = 'test_project';

      // Mock the return values of the storage services
      vectorStorage.getCollectionStats.mockResolvedValue({
        totalPoints: 150,
        collectionInfo: {}
      });

      graphStorage.getGraphStats.mockResolvedValue({
        nodeCount: 100,
        relationshipCount: 50,
        nodeTypes: {},
        relationshipTypes: {}
      });

      const result = await storageCoordinator.getSnippetStatistics(mockProjectId);

      expect(result).toEqual({
        totalSnippets: 150,
        processedSnippets: 142, // 150 * 0.95
        duplicateSnippets: 8, // 150 - 142
        processingRate: 45.2
      });
    });

    it('should find snippet by hash', async () => {
      const mockContentHash = 'abc123';
      const mockProjectId = 'test_project';

      // Mock vector storage search results
      vectorStorage.searchVectors.mockResolvedValue([]);

      // Mock graph storage search results
      graphStorage.search.mockResolvedValue([]);

      const result = await storageCoordinator.findSnippetByHash(mockContentHash, mockProjectId);

      expect(result).toBeNull();
    });

    it('should find snippet references', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';

      // Mock vector storage search results
      vectorStorage.searchVectors.mockResolvedValue([]);

      // Mock graph storage search results
      graphStorage.search.mockResolvedValue([]);

      const result = await storageCoordinator.findSnippetReferences(mockSnippetId, mockProjectId);

      expect(result).toEqual([]);
    });

    it('should analyze snippet dependencies', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';

      // Mock vector storage search results
      vectorStorage.searchVectors.mockResolvedValue([]);

      // Mock graph storage search results
      graphStorage.search.mockResolvedValue([]);

      const result = await storageCoordinator.analyzeDependencies(mockSnippetId, mockProjectId);

      expect(result).toEqual([]);
    });

    it('should find snippet overlaps', async () => {
      const mockSnippetId = 'snippet_1';
      const mockProjectId = 'test_project';

      // Mock vector storage search results
      vectorStorage.searchVectors.mockResolvedValue([]);

      // Mock graph storage search results
      graphStorage.search.mockResolvedValue([]);

      const result = await storageCoordinator.findSnippetOverlaps(mockSnippetId, mockProjectId);

      expect(result).toEqual([]);
    });
  });

  describe('private helper methods', () => {
    describe('getChunkIdsForFiles', () => {
      it('should return chunk IDs for files', async () => {
        const mockFilePaths = ['/test/project/file1.ts', '/test/project/file2.ts'];
        const mockChunkIds = ['chunk_1', 'chunk_2', 'chunk_3'];

        // Mock QdrantClientWrapper method
        qdrantClient.getChunkIdsByFiles.mockResolvedValue(mockChunkIds);

        // Mock configService to return collection name for qdrant
        (configService.get as jest.Mock).mockImplementation((key: string) => {
          if (key === 'qdrant') {
            return { host: 'localhost', port: 6333, collection: 'test_collection' };
          }
          return {} as any;
        });

        // Call the private method directly using reflection
        const getChunkIdsForFiles = (storageCoordinator as any)['getChunkIdsForFiles'];
        const result = await getChunkIdsForFiles.call(storageCoordinator, mockFilePaths);

        // Verify QdrantClientWrapper method was called correctly
        expect(qdrantClient.getChunkIdsByFiles).toHaveBeenCalledWith(
          'test_collection',
          mockFilePaths
        );

        // Verify the result
        expect(result).toEqual(mockChunkIds);
      });

      it('should handle empty file paths array', async () => {
        // Mock configService to return collection name for qdrant
        (configService.get as jest.Mock).mockImplementation((key: string) => {
          if (key === 'qdrant') {
            return { host: 'localhost', port: 6333, collection: 'test_collection' };
          }
          return {} as any;
        });

        // Call the private method directly using reflection
        const getChunkIdsForFiles = (storageCoordinator as any)['getChunkIdsForFiles'];
        const result = await getChunkIdsForFiles.call(storageCoordinator, []);

        // Verify QdrantClientWrapper method was NOT called with empty array (optimization)
        expect(qdrantClient.getChunkIdsByFiles).not.toHaveBeenCalled();

        // Verify the result
        expect(result).toEqual([]);
      });
    });

    describe('getProjectChunkIds', () => {
      it('should return chunk IDs for project', async () => {
        const mockProjectId = 'test_project';
        const mockChunkIds = ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4', 'chunk_5'];

        // Mock QdrantClientWrapper method
        qdrantClient.getChunkIdsByFiles.mockResolvedValue(mockChunkIds);

        // Mock configService to return collection name for qdrant
        (configService.get as jest.Mock).mockImplementation((key: string) => {
          if (key === 'qdrant') {
            return { host: 'localhost', port: 6333, collection: 'test_collection' };
          }
          return {} as any;
        });

        // Call the private method directly using reflection
        const getProjectChunkIds = (storageCoordinator as any)['getProjectChunkIds'];
        const result = await getProjectChunkIds.call(storageCoordinator, mockProjectId);

        // Verify QdrantClientWrapper method was called correctly
        expect(qdrantClient.getChunkIdsByFiles).toHaveBeenCalledWith(
          'test_collection',
          [mockProjectId]
        );

        // Verify the result
        expect(result).toEqual(mockChunkIds);
      });
    });
  });
});