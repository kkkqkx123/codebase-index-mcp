import { Container } from 'inversify';
import { VectorStorageService } from './VectorStorageService';
import { QdrantClientWrapper } from '../../database/qdrant/QdrantClientWrapper';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { BatchProcessingMetrics } from '../monitoring/BatchProcessingMetrics';
import { TYPES } from '../../core/DIContainer';

describe('VectorStorageService', () => {
  let container: Container;
  let vectorStorageService: VectorStorageService;
  let mockQdrantClient: jest.Mocked<QdrantClientWrapper>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockBatchMetrics: jest.Mocked<BatchProcessingMetrics>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockQdrantClient = {
      upsertPoints: jest.fn(),
      deletePoints: jest.fn(),
      getPoint: jest.fn(),
      searchVectors: jest.fn(),
      createCollection: jest.fn(),
      clearCollection: jest.fn(),
      getCollectionInfo: jest.fn(),
      getPointCount: jest.fn(),
      collectionExists: jest.fn(),
      connect: jest.fn(),
      close: jest.fn(),
      isConnectedToDatabase: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn().mockReturnValue({ id: 'test-error-id' }),
    } as any;

    mockBatchMetrics = {
      startBatchOperation: jest.fn(),
      updateBatchOperation: jest.fn(),
      endBatchOperation: jest.fn(),
    } as any;

    // Setup mock config
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'qdrant') {
        return {
          collection: 'codebase_vectors',
          host: 'localhost',
          port: 6333,
        };
      }
      if (key === 'batchProcessing') {
        return {
          maxConcurrentOperations: 5,
          defaultBatchSize: 100,
          maxBatchSize: 1000
        };
      }
      return null;
    });

    // Bind mocks to container
    container.bind(TYPES.QdrantClientWrapper).toConstantValue(mockQdrantClient);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    container.bind(TYPES.BatchProcessingMetrics).toConstantValue(mockBatchMetrics);
    container.bind(VectorStorageService).toSelf();

    vectorStorageService = container.get<VectorStorageService>(VectorStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when collection exists', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.connect).toHaveBeenCalled();
      expect(mockQdrantClient.createCollection).not.toHaveBeenCalled();
    });

    it('should create collection when it does not exist', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(false);
      mockQdrantClient.createCollection.mockResolvedValue(true);
      mockQdrantClient.getCollectionInfo.mockResolvedValue({
        name: 'codebase_vectors',
        status: 'green' as const,
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 0
      });

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        'codebase_vectors',
        1536,
        'Cosine',
        false
      );
    });

    it('should handle connection failure', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(false);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle collection creation failure', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(false);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(false);
      mockQdrantClient.createCollection.mockResolvedValue(false);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(false);
    });

    it('should skip initialization if already connected', async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);

      const result = await vectorStorageService.initialize();

      expect(result).toBe(true);
      expect(mockQdrantClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('storeChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.upsertPoints.mockResolvedValue(true);
    });

    it('should store code chunks as vectors', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'function test() { return true; }',
          type: 'function',
          startLine: 1,
          endLine: 3,
          metadata: {
            filePath: '/src/test.ts',
            language: 'typescript',
            functionName: 'test'
          }
        }
      ];

      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(1);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalled();
    });

    it('should store multiple vectors with metadata', async () => {
      const chunks = [
        {
          id: 'chunk-1',
          content: 'function test1() { return true; }',
          type: 'function',
          startLine: 1,
          endLine: 5,
          startByte: 0,
          endByte: 50,
          filePath: '/src/test1.ts',
          language: 'typescript',
          metadata: {
            filePath: '/src/test1.ts',
            language: 'typescript',
            functionName: 'test1'
          }
        },
        {
          id: 'chunk-2',
          content: 'function test2() { return false; }',
          type: 'function',
          startLine: 6,
          endLine: 10,
          startByte: 51,
          endByte: 100,
          filePath: '/src/test2.ts',
          language: 'typescript',
          metadata: {
            filePath: '/src/test2.ts',
            language: 'typescript',
            functionName: 'test2'
          }
        }
      ];

      mockQdrantClient.upsertPoints.mockResolvedValue(true);

      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(2);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalledWith(
        'codebase_vectors',
        expect.any(Array)
      );
    });

    it('should handle empty chunks array', async () => {
      await vectorStorageService.initialize();
      const result = await vectorStorageService.storeChunks([]);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(0);
    });
  });

  describe('updateChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.upsertPoints.mockResolvedValue(true);
    });

    it('should update existing chunks with new vectors', async () => {
      const chunks = [
        {
          id: 'existing-1',
          content: 'updated function content',
          type: 'function',
          startLine: 1,
          endLine: 5,
          startByte: 0,
          endByte: 50,
          filePath: '/src/updated.ts',
          language: 'typescript',
          metadata: {
            filePath: '/src/updated.ts',
            language: 'typescript',
            functionName: 'updatedFunction'
          }
        }
      ];

      mockQdrantClient.upsertPoints.mockResolvedValue(true);

      await vectorStorageService.initialize();
      const result = await vectorStorageService.updateChunks(chunks);

      expect(result.success).toBe(true);
      expect(result.totalChunks).toBe(1);
      expect(mockQdrantClient.upsertPoints).toHaveBeenCalled();
    });
  });

  describe('deleteChunks', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
    });

    it('should delete chunks by IDs', async () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];

      mockQdrantClient.deletePoints.mockResolvedValue(true);

      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks(chunkIds);

      expect(result).toBe(true);
      expect(mockQdrantClient.deletePoints).toHaveBeenCalledWith(
        'codebase_vectors',
        chunkIds
      );
    });

    it('should handle empty chunks array', async () => {
      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks([]);

      expect(result).toBe(true);
      expect(mockQdrantClient.deletePoints).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const chunkIds = ['chunk-1'];

      mockQdrantClient.deletePoints.mockRejectedValue(new Error('Deletion failed'));

      await vectorStorageService.initialize();
      const result = await vectorStorageService.deleteChunks(chunkIds);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('searchVectors', () => {
    beforeEach(async () => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      await vectorStorageService.initialize();
    });

    it('should search for similar vectors', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options = {
        limit: 10,
        scoreThreshold: 0.8
      };

      const mockResults = [{
        id: 'vector-1',
        score: 0.95,
        payload: {
          content: 'function test() { return true; }',
          filePath: '/src/test.ts',
          language: 'typescript',
          chunkType: 'function',
          startLine: 1,
          endLine: 5,
          functionName: 'test',
          metadata: { functionName: 'test' },
          timestamp: new Date('2024-01-01')
        }
      }];

      mockQdrantClient.searchVectors.mockResolvedValue(mockResults);

      const result = await vectorStorageService.searchVectors(queryVector, options);

      expect(mockQdrantClient.searchVectors).toHaveBeenCalledWith(
        'codebase_vectors',
        queryVector,
        10,
        0.8
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when search fails', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options = { limit: 5 };

      mockQdrantClient.searchVectors.mockRejectedValue(new Error('Search failed'));

      const result = await vectorStorageService.searchVectors(queryVector, options);

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });



  describe('getCollectionStats', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
    });

    it('should return collection statistics', async () => {
      const collectionInfo = {
        name: 'codebase_vectors',
        status: 'green' as const,
        vectors: { size: 1536, distance: 'Cosine' as const },
        pointsCount: 1500
      };

      mockQdrantClient.getCollectionInfo.mockResolvedValue(collectionInfo);
      mockQdrantClient.getPointCount.mockResolvedValue(1500);

      await vectorStorageService.initialize();
      const stats = await vectorStorageService.getCollectionStats();

      expect(stats.totalPoints).toBe(1500);
      expect(stats.collectionInfo).toEqual(collectionInfo);
    });

    it('should handle errors when getting stats', async () => {
      mockQdrantClient.getCollectionInfo.mockRejectedValue(new Error('Collection not found'));

      await vectorStorageService.initialize();
      const stats = await vectorStorageService.getCollectionStats();

      expect(stats.totalPoints).toBe(0);
      expect(stats.collectionInfo).toBeNull();
    });
  });

  describe('clearCollection', () => {
    beforeEach(() => {
      mockQdrantClient.isConnectedToDatabase.mockReturnValue(true);
      mockQdrantClient.collectionExists.mockResolvedValue(true);
      mockQdrantClient.connect.mockResolvedValue(true);
      mockQdrantClient.clearCollection.mockResolvedValue(true);
    });

    it('should clear the collection', async () => {
      await vectorStorageService.initialize();
      const result = await vectorStorageService.clearCollection();

      expect(result).toBe(true);
      expect(mockQdrantClient.clearCollection).toHaveBeenCalledWith('codebase_vectors');
    });

    it('should handle clear collection errors', async () => {
      mockQdrantClient.clearCollection.mockRejectedValue(new Error('Clear failed'));

      await vectorStorageService.initialize();
      const result = await vectorStorageService.clearCollection();

      expect(result).toBe(false);
    });
  });
});