import { Container } from 'inversify';
import { VectorStorageService } from './VectorStorageService';
import { QdrantService } from '../../database/QdrantService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('VectorStorageService', () => {
  let container: Container;
  let vectorStorageService: VectorStorageService;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockQdrantService = {
      upsert: jest.fn(),
      delete: jest.fn(),
      getPoint: jest.fn(),
      search: jest.fn(),
      createCollection: jest.fn(),
      deleteCollection: jest.fn(),
      getCollectionInfo: jest.fn(),
      updatePoint: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getVectorConfig: jest.fn().mockReturnValue({
        collectionName: 'codebase_vectors',
        vectorSize: 384,
        distance: 'Cosine',
        batchSize: 100,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.QdrantService).toConstantValue(mockQdrantService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.VectorStorageService).to(VectorStorageService);

    vectorStorageService = container.get<VectorStorageService>(TYPES.VectorStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeVector', () => {
    it('should store a single vector with metadata', async () => {
      const vectorData = {
        id: 'test-vector-1',
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: {
          content: 'function test() { return true; }',
          filePath: '/src/test.ts',
          language: 'typescript',
          functionName: 'test',
        }
      };

      mockQdrantService.upsert.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.storeVector(vectorData);

      expect(mockQdrantService.upsert).toHaveBeenCalledWith({
        points: [{
          id: vectorData.id,
          vector: vectorData.vector,
          payload: vectorData.metadata,
        }]
      });
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Stored vector', { id: vectorData.id });
    });

    it('should handle storage errors gracefully', async () => {
      const vectorData = {
        id: 'test-vector-1',
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: { content: 'test content' }
      };

      mockQdrantService.upsert.mockRejectedValue(new Error('Storage failed'));

      await expect(vectorStorageService.storeVector(vectorData)).rejects.toThrow('Storage failed');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('storeBatch', () => {
    it('should store multiple vectors in batches', async () => {
      const vectors = [
        {
          id: 'vector-1',
          vector: [0.1, 0.2, 0.3, 0.4],
          metadata: { content: 'content 1', filePath: '/src/file1.ts' }
        },
        {
          id: 'vector-2',
          vector: [0.5, 0.6, 0.7, 0.8],
          metadata: { content: 'content 2', filePath: '/src/file2.ts' }
        },
        {
          id: 'vector-3',
          vector: [0.9, 0.1, 0.2, 0.3],
          metadata: { content: 'content 3', filePath: '/src/file3.ts' }
        },
      ];

      mockQdrantService.upsert.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.storeBatch(vectors);

      expect(mockQdrantService.upsert).toHaveBeenCalledWith({
        points: vectors.map(v => ({
          id: v.id,
          vector: v.vector,
          payload: v.metadata,
        }))
      });
      expect(mockLoggerService.info).toHaveBeenCalledWith('Stored vector batch', { count: 3 });
    });

    it('should split large batches into smaller chunks', async () => {
      const vectors = Array.from({ length: 250 }, (_, i) => ({
        id: `vector-${i}`,
        vector: [0.1, 0.2, 0.3, 0.4],
        metadata: { content: `content ${i}` }
      }));

      mockQdrantService.upsert.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.storeBatch(vectors);

      expect(mockQdrantService.upsert).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    });
  });

  describe('updateVector', () => {
    it('should update an existing vector', async () => {
      const vectorId = 'existing-vector';
      const newVector = [0.9, 0.8, 0.7, 0.6];
      const newMetadata = {
        content: 'updated function test() { return false; }',
        lastModified: new Date().toISOString(),
      };

      mockQdrantService.updatePoint.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.updateVector(vectorId, newVector, newMetadata);

      expect(mockQdrantService.updatePoint).toHaveBeenCalledWith({
        id: vectorId,
        vector: newVector,
        payload: newMetadata,
      });
    });
  });

  describe('deleteVector', () => {
    it('should delete a vector by ID', async () => {
      const vectorId = 'vector-to-delete';

      mockQdrantService.delete.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.deleteVector(vectorId);

      expect(mockQdrantService.delete).toHaveBeenCalledWith({ ids: [vectorId] });
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Deleted vector', { id: vectorId });
    });
  });

  describe('deleteByFilter', () => {
    it('should delete vectors matching filter criteria', async () => {
      const filter = {
        must: [
          { key: 'filePath', match: { value: '/src/deprecated/' } }
        ]
      };

      mockQdrantService.delete.mockResolvedValue({ operation_id: 1, status: 'completed' });

      await vectorStorageService.deleteByFilter(filter);

      expect(mockQdrantService.delete).toHaveBeenCalledWith({ filter });
      expect(mockLoggerService.info).toHaveBeenCalledWith('Deleted vectors by filter', { filter });
    });
  });

  describe('getVector', () => {
    it('should retrieve a vector by ID', async () => {
      const vectorId = 'test-vector';
      const expectedVector = {
        id: vectorId,
        vector: [0.1, 0.2, 0.3, 0.4],
        payload: {
          content: 'function test() { return true; }',
          filePath: '/src/test.ts',
        }
      };

      mockQdrantService.getPoint.mockResolvedValue(expectedVector);

      const result = await vectorStorageService.getVector(vectorId);

      expect(result).toEqual({
        id: vectorId,
        vector: expectedVector.vector,
        metadata: expectedVector.payload,
      });
      expect(mockQdrantService.getPoint).toHaveBeenCalledWith(vectorId);
    });

    it('should return null for non-existent vectors', async () => {
      const vectorId = 'non-existent';

      mockQdrantService.getPoint.mockResolvedValue(null);

      const result = await vectorStorageService.getVector(vectorId);

      expect(result).toBeNull();
    });
  });

  describe('searchSimilar', () => {
    it('should find similar vectors', async () => {
      const queryVector = [0.1, 0.2, 0.3, 0.4];
      const options = { limit: 10, scoreThreshold: 0.7 };

      const searchResults = [
        {
          id: 'similar-1',
          score: 0.95,
          payload: { content: 'similar content 1', filePath: '/src/similar1.ts' }
        },
        {
          id: 'similar-2',
          score: 0.85,
          payload: { content: 'similar content 2', filePath: '/src/similar2.ts' }
        },
      ];

      mockQdrantService.search.mockResolvedValue(searchResults);

      const result = await vectorStorageService.searchSimilar(queryVector, options);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(0.95);
      expect(mockQdrantService.search).toHaveBeenCalledWith({
        vector: queryVector,
        limit: options.limit,
        score_threshold: options.scoreThreshold,
      });
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      const collectionInfo = {
        status: 'green',
        vectors_count: 1500,
        indexed_vectors_count: 1500,
        points_count: 1500,
        segments_count: 3,
        config: {
          params: {
            vector_size: 384,
            distance: 'Cosine'
          }
        }
      };

      mockQdrantService.getCollectionInfo.mockResolvedValue(collectionInfo);

      const stats = await vectorStorageService.getStorageStats();

      expect(stats).toEqual({
        totalVectors: 1500,
        indexedVectors: 1500,
        vectorDimensions: 384,
        distanceMetric: 'Cosine',
        segmentCount: 3,
        status: 'green',
      });
    });
  });

  describe('optimizeStorage', () => {
    it('should optimize vector storage', async () => {
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
        segments_count: 10, // Too many segments
      });

      await vectorStorageService.optimizeStorage();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Storage optimization completed');
    });
  });
});