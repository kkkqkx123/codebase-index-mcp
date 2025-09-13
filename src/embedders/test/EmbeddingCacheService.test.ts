import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { EmbeddingResult } from '../BaseEmbedder';

// Mock classes
class MockConfigService {
  private config: any;
  
  constructor(config: any = {}) {
    // Default configuration
    this.config = {
      caching: {
        defaultTTL: 300,
        maxSize: 1000
      },
      cache: {
        ttl: 300,
        maxEntries: 1000,
        cleanupInterval: 60
      },
      ...config
    };
  }
  
  get(key: string): any {
    if (key === 'caching') return this.config.caching;
    if (key === 'cache') return this.config.cache;
    return this.config[key];
  }
}

class MockLoggerService {
  debug(message: string, meta?: any): void {
    // Mock implementation
  }
  
  warn(message: string, meta?: any): void {
    // Mock implementation
  }
  
  error(message: string, meta?: any): void {
    // Mock implementation
  }
  
  info(message: string, meta?: any): void {
    // Mock implementation
  }
}

describe('EmbeddingCacheService', () => {
  let cacheService: EmbeddingCacheService;
  let mockConfigService: MockConfigService;
  let mockLoggerService: MockLoggerService;
  
  beforeEach(() => {
    mockConfigService = new MockConfigService();
    mockLoggerService = new MockLoggerService();
    cacheService = new EmbeddingCacheService(
      mockConfigService as unknown as ConfigService,
      mockLoggerService as unknown as LoggerService,
      {} as any // Mock CacheManager
    );
  });
  
  afterEach(() => {
    // Clear the cache after each test
    (cacheService as any).cache.clear();
  });
  
  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await cacheService.get('test text', 'test-model');
      expect(result).toBeNull();
    });
    
    it('should return cached result for existing key', async () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      // Set a value in cache
      (cacheService as any).cache.set('test-model:test text', {
        result: embeddingResult,
        timestamp: Date.now(),
        expiry: Date.now() + 10000 // 10 seconds in the future
      });
      
      const result = await cacheService.get('test text', 'test-model');
      expect(result).toEqual(embeddingResult);
    });
    
    it('should return null for expired entry', async () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      // Set an expired value in cache
      (cacheService as any).cache.set('test-model:test text', {
        result: embeddingResult,
        timestamp: Date.now() - 10000, // 10 seconds in the past
        expiry: Date.now() - 5000 // 5 seconds in the past
      });
      
      const result = await cacheService.get('test text', 'test-model');
      expect(result).toBeNull();
    });
  });
  
  describe('set', () => {
    it('should set a value in cache', async () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      await cacheService.set('test text', 'test-model', embeddingResult);
      
      const result = await cacheService.get('test text', 'test-model');
      expect(result).toEqual(embeddingResult);
    });
    
    it('should remove oldest entry when cache is at maximum size', async () => {
      // Create a cache with maxSize of 2
      const smallCacheConfig = new MockConfigService({
        caching: { defaultTTL: 300, maxSize: 2 },
        cache: { ttl: 300, maxEntries: 2, cleanupInterval: 60 }
      });
      
      const smallCacheService = new EmbeddingCacheService(
        smallCacheConfig as unknown as ConfigService,
        mockLoggerService as unknown as LoggerService,
        {} as any // Mock CacheManager
      );
      
      const embeddingResult1: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      const embeddingResult2: EmbeddingResult = {
        vector: [0.4, 0.5, 0.6],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      const embeddingResult3: EmbeddingResult = {
        vector: [0.7, 0.8, 0.9],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      // Add three entries to a cache with maxSize of 2
      await smallCacheService.set('text 1', 'test-model', embeddingResult1);
      await smallCacheService.set('text 2', 'test-model', embeddingResult2);
      await smallCacheService.set('text 3', 'test-model', embeddingResult3);
      
      // The first entry should be removed
      const result1 = await smallCacheService.get('text 1', 'test-model');
      expect(result1).toBeNull();
      
      // The second and third entries should still be there
      const result2 = await smallCacheService.get('text 2', 'test-model');
      expect(result2).toEqual(embeddingResult2);
      
      const result3 = await smallCacheService.get('text 3', 'test-model');
      expect(result3).toEqual(embeddingResult3);
    });
  });
  
  describe('clear', () => {
    it('should clear all entries from cache', async () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      await cacheService.set('test text', 'test-model', embeddingResult);
      await cacheService.clear();
      
      const result = await cacheService.get('test text', 'test-model');
      expect(result).toBeNull();
    });
  });
  
  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      await cacheService.set('test text', 'test-model', embeddingResult);
      
      const stats = await cacheService.getStats();
      expect(stats.size).toBe(1);
    });
  });
  
  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const embeddingResult: EmbeddingResult = {
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        model: 'test-model',
        processingTime: 100
      };
      
      // Set an expired value in cache
      (cacheService as any).cache.set('test-model:expired text', {
        result: embeddingResult,
        timestamp: Date.now() - 10000, // 10 seconds in the past
        expiry: Date.now() - 5000 // 5 seconds in the past
      });
      
      // Set a valid value in cache
      (cacheService as any).cache.set('test-model:valid text', {
        result: embeddingResult,
        timestamp: Date.now(),
        expiry: Date.now() + 10000 // 10 seconds in the future
      });
      
      // Call cleanup
      (cacheService as any).cleanup();
      
      // Expired entry should be removed
      const expiredResult = cacheService.get('expired text', 'test-model');
      expect(expiredResult).toBeNull();
      
      // Valid entry should still be there
      const validResult = cacheService.get('valid text', 'test-model');
      expect(validResult).toEqual(embeddingResult);
    });
  });
});