import { QdrantClientWrapper, VectorPoint, SearchOptions } from '../../qdrant/QdrantClientWrapper';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';

// Mock services
class MockConfigService {
  get(key: string) {
    if (key === 'qdrant') {
      return {
        host: 'localhost',
        port: 6333
      };
    }
    return {};
  }
}

class MockLoggerService {
  error(_message: string, _meta?: any) {}
  info(_message: string, _meta?: any) {}
  warn(_message: string, _meta?: any) {}
}

class MockErrorHandlerService {
  handleError(_error: Error, _context?: any) {
    return { id: 'test-error-id' };
  }
}

// Mock QdrantClient
class MockQdrantClient {
  private collections: string[] = [];
  private points: Map<string, any[]> = new Map();

  async getCollections() {
    return { collections: this.collections.map(name => ({ name })) };
  }

  async createCollection(collectionName: string, _config: any) {
    this.collections.push(collectionName);
    this.points.set(collectionName, []);
    return { result: true };
  }

  async deleteCollection(collectionName: string) {
    this.collections = this.collections.filter(name => name !== collectionName);
    this.points.delete(collectionName);
    return { result: true };
  }

  async getCollection(collectionName: string) {
    if (!this.collections.includes(collectionName)) {
      throw new Error('Collection not found');
    }
    const points = this.points.get(collectionName) || [];
    return {
      points_count: points.length,
      status: 'green',
      config: {
        params: {
          vectors: {
            size: 128,
            distance: 'Cosine'
          }
        }
      }
    };
  }

  async upsert(collectionName: string, data: any) {
    if (!this.collections.includes(collectionName)) {
      throw new Error('Collection not found');
    }
    
    const collectionPoints = this.points.get(collectionName) || [];
    data.points.forEach((point: any) => {
      const existingIndex = collectionPoints.findIndex((p: any) => p.id === point.id);
      if (existingIndex >= 0) {
        collectionPoints[existingIndex] = point;
      } else {
        collectionPoints.push(point);
      }
    });
    this.points.set(collectionName, collectionPoints);
    return { result: { operation_id: 1, status: 'completed' } };
  }

  async search(_collectionName: string, _params: any) {
    // Return mock search results
    return [
      {
        id: 'test-point-1',
        score: 0.95,
        payload: {
          content: 'test content',
          filePath: '/test/file.ts',
          language: 'typescript',
          chunkType: 'function',
          startLine: 1,
          endLine: 10,
          timestamp: new Date().toISOString()
        }
      }
    ];
  }

  async delete(_collectionName: string, _params: any) {
    return { result: { operation_id: 2, status: 'completed' } };
  }

  async createPayloadIndex(_collectionName: string, _params: any) {
    return { result: { operation_id: 3, status: 'completed' } };
  }
}

describe('QdrantClientWrapper', () => {
  let qdrantClient: QdrantClientWrapper;
  let mockQdrantClient: MockQdrantClient;

  beforeEach(() => {
    // Mock the QdrantClient
    jest.mock('@qdrant/js-client-rest', () => {
      return {
        QdrantClient: jest.fn().mockImplementation(() => mockQdrantClient)
      };
    });

    // Reset modules to ensure fresh mocks
    jest.resetModules();

    mockQdrantClient = new MockQdrantClient();
    
    const configService = new MockConfigService() as unknown as ConfigService;
    const loggerService = new MockLoggerService() as unknown as LoggerService;
    const errorHandlerService = new MockErrorHandlerService() as unknown as ErrorHandlerService;

    qdrantClient = new QdrantClientWrapper(
      configService,
      loggerService,
      errorHandlerService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const result = await qdrantClient.connect();
      expect(result).toBe(true);
      expect(qdrantClient.isConnectedToDatabase()).toBe(true);
    });

    it('should handle connection failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'getCollections').mockRejectedValue(new Error('Connection failed'));
      
      const result = await qdrantClient.connect();
      expect(result).toBe(false);
      expect(qdrantClient.isConnectedToDatabase()).toBe(false);
    });
  });

  describe('createCollection', () => {
    it('should create a new collection', async () => {
      const result = await qdrantClient.createCollection('test-collection', 128);
      expect(result).toBe(true);
    });

    it('should handle collection creation failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'createCollection').mockRejectedValue(new Error('Creation failed'));
      
      const result = await qdrantClient.createCollection('test-collection', 128);
      expect(result).toBe(false);
    });
  });

  describe('collectionExists', () => {
    it('should return true for existing collection', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const exists = await qdrantClient.collectionExists('test-collection');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing collection', async () => {
      const exists = await qdrantClient.collectionExists('non-existent-collection');
      expect(exists).toBe(false);
    });
  });

  describe('deleteCollection', () => {
    it('should delete an existing collection', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const result = await qdrantClient.deleteCollection('test-collection');
      expect(result).toBe(true);
    });

    it('should handle collection deletion failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'deleteCollection').mockRejectedValue(new Error('Deletion failed'));
      
      const result = await qdrantClient.deleteCollection('test-collection');
      expect(result).toBe(false);
    });
  });

  describe('getCollectionInfo', () => {
    it('should return collection info', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const info = await qdrantClient.getCollectionInfo('test-collection');
      expect(info).toBeDefined();
      expect(info?.name).toBe('test-collection');
      expect(info?.vectors.size).toBe(128);
      expect(info?.vectors.distance).toBe('Cosine');
    });

    it('should return null for non-existing collection', async () => {
      const info = await qdrantClient.getCollectionInfo('non-existent-collection');
      expect(info).toBeNull();
    });
  });

  describe('upsertPoints', () => {
    it('should upsert points successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      
      const points: VectorPoint[] = [
        {
          id: 'point-1',
          vector: Array(128).fill(0.5),
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      const result = await qdrantClient.upsertPoints('test-collection', points);
      expect(result).toBe(true);
    });

    it('should handle upsert failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'upsert').mockRejectedValue(new Error('Upsert failed'));
      
      const points: VectorPoint[] = [
        {
          id: 'point-1',
          vector: Array(128).fill(0.5),
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      const result = await qdrantClient.upsertPoints('test-collection', points);
      expect(result).toBe(false);
    });
  });

  describe('searchVectors', () => {
    it('should search vectors successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      
      const queryVector = Array(128).fill(0.5);
      const options: SearchOptions = {
        limit: 5,
        scoreThreshold: 0.8
      };

      const results = await qdrantClient.searchVectors('test-collection', queryVector, options);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('test-point-1');
      expect(results[0].score).toBe(0.95);
    });

    it('should handle search failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'search').mockRejectedValue(new Error('Search failed'));
      
      const queryVector = Array(128).fill(0.5);
      const results = await qdrantClient.searchVectors('test-collection', queryVector);
      expect(results).toEqual([]);
    });
  });

  describe('deletePoints', () => {
    it('should delete points successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      
      const result = await qdrantClient.deletePoints('test-collection', ['point-1']);
      expect(result).toBe(true);
    });

    it('should handle delete points failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'delete').mockRejectedValue(new Error('Delete failed'));
      
      const result = await qdrantClient.deletePoints('test-collection', ['point-1']);
      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the connection', async () => {
      await qdrantClient.connect();
      expect(qdrantClient.isConnectedToDatabase()).toBe(true);
      
      await qdrantClient.close();
      expect(qdrantClient.isConnectedToDatabase()).toBe(false);
    });
  });
});