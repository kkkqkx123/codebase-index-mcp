import { EnhancedCacheFactory } from '../EnhancedCacheFactory';
import { EnhancedMultiLevelCache } from '../EnhancedMultiLevelCache';
import { EnhancedRedisCacheAdapter, EnhancedCacheStats } from '../EnhancedRedisCacheAdapter';
import { MemoryCacheAdapter } from '../MemoryCacheAdapter';
import { CacheInterface } from '../CacheInterface';
import { RedisConfig } from '../../../config/RedisConfig';
import { createMockRedis } from './types';

// 使用类型化的mock Redis
const mockRedis = createMockRedis();

// 模拟 ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('Enhanced Cache System', () => {
  let cacheFactory: EnhancedCacheFactory;
  let mockRedisConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheFactory = new EnhancedCacheFactory();
    mockRedisConfig = {
      url: 'redis://localhost:6379',
      enabled: true,
      useMultiLevel: true,
      ttl: 3600,
      retry: { attempts: 3, delay: 100 },
      pool: { min: 5, max: 10 }
    };
  });

  afterEach(async () => {
    // 清理所有缓存实例
    const caches = cacheFactory.getAllCaches();
    for (const [name, cache] of caches) {
      await cache.close();
      await cacheFactory.removeCache(name);
    }
    
    // 确保所有Redis连接已关闭
    if (mockRedis.quit) {
      mockRedis.quit.mockClear();
    }
  });

  afterAll(async () => {
    // 清理所有缓存并关闭工厂
    await cacheFactory.closeAllCaches();
    
    // 清理所有模拟
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('EnhancedCacheFactory', () => {
    test('应该成功创建单例实例', () => {
      const instance1 = EnhancedCacheFactory.getInstance();
      const instance2 = EnhancedCacheFactory.getInstance();
      expect(instance1).toBe(instance2);
    });

    test('应该创建内存缓存', () => {
      const cache = cacheFactory.createMemoryCache('test-memory');
      expect(cache).toBeInstanceOf(MemoryCacheAdapter);
      expect(cache.getName()).toBe('test-memory');
    });

    test('应该创建Redis缓存', () => {
      const cache = cacheFactory.createRedisCache('test-redis', mockRedisConfig);
      expect(cache).toBeInstanceOf(EnhancedRedisCacheAdapter);
      expect(cache.getName()).toBe('test-redis');
    });

    test('应该创建多级缓存', () => {
      const cache = cacheFactory.createMultiLevelCache('test-multi', mockRedisConfig);
      expect(cache).toBeInstanceOf(EnhancedMultiLevelCache);
      expect(cache.getName()).toBe('test-multi');
    });

    test('应该管理缓存实例', () => {
      const cache1 = cacheFactory.createMultiLevelCache('test1', mockRedisConfig);
      const cache2 = cacheFactory.createMultiLevelCache('test2', mockRedisConfig);

      expect(cacheFactory.getCache('test1')).toBe(cache1);
      expect(cacheFactory.getCache('test2')).toBe(cache2);

      const allCaches = cacheFactory.getAllCaches();
      expect(allCaches.size).toBe(2);
      expect(allCaches.has('test1')).toBe(true);
      expect(allCaches.has('test2')).toBe(true);
    });

    test('应该移除缓存实例', async () => {
      const cache = cacheFactory.createMultiLevelCache('test-remove', mockRedisConfig);
      expect(cacheFactory.getCache('test-remove')).toBe(cache);

      const removed = await cacheFactory.removeCache('test-remove');
      expect(removed).toBe(true);
      expect(cacheFactory.getCache('test-remove')).toBeUndefined();
    });
  });

  describe('MemoryCacheAdapter', () => {
    let memoryCache: MemoryCacheAdapter;

    beforeEach(() => {
      memoryCache = new MemoryCacheAdapter('test-memory', 300);
    });

    test('应该设置和获取值', async () => {
      await memoryCache.set('key1', 'value1');
      const value = await memoryCache.get<string>('key1');
      expect(value).toBe('value1');
    });

    test('应该处理不存在的键', async () => {
      const value = await memoryCache.get<string>('nonexistent');
      expect(value).toBeNull();
    });

    test('应该删除键', async () => {
      await memoryCache.set('key1', 'value1');
      expect(await memoryCache.exists('key1')).toBe(true);

      await memoryCache.del('key1');
      expect(await memoryCache.exists('key1')).toBe(false);
    });

    test('应该清空缓存', async () => {
      await memoryCache.set('key1', 'value1');
      await memoryCache.set('key2', 'value2');

      await memoryCache.clear();

      expect(await memoryCache.get('key1')).toBeNull();
      expect(await memoryCache.get('key2')).toBeNull();
    });

    test('应该返回统计信息', async () => {
      await memoryCache.set('key1', 'value1');
      await memoryCache.get('key1'); // 命中
      await memoryCache.get('nonexistent'); // 未命中

      const stats = await memoryCache.getStats();
      expect(stats.name).toBe('test-memory');
      expect(stats.size).toBe(1);
      expect(stats.hitCount).toBe(1);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('EnhancedRedisCacheAdapter', () => {
    let redisCache: EnhancedRedisCacheAdapter;

    beforeEach(() => {
      redisCache = new EnhancedRedisCacheAdapter('test-redis', mockRedis as any, 3600, cacheFactory.getMonitor());
    });

    test('应该设置和获取值', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify('value1'));
      mockRedis.setex.mockResolvedValue('OK');

      await redisCache.set('key1', 'value1');
      const value = await redisCache.get<string>('key1');

      expect(mockRedis.setex).toHaveBeenCalledWith('key1', 3600, JSON.stringify('value1'));
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
      expect(value).toBe('value1');
    });

    test('应该处理Redis返回null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const value = await redisCache.get<string>('key1');
      expect(value).toBeNull();
    });

    test('应该删除键', async () => {
      mockRedis.del.mockResolvedValue(1);

      await redisCache.del('key1');
      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });

    test('应该清空缓存', async () => {
      mockRedis.flushall.mockResolvedValue('OK');

      await redisCache.clear();
      expect(mockRedis.flushall).toHaveBeenCalled();
    });

    test('应该检查键是否存在', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const exists = await redisCache.exists('key1');
      expect(exists).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('key1');
    });

    test('应该关闭连接', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await redisCache.close();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('应该处理Redis错误', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      const value = await redisCache.get<string>('key1');
      expect(value).toBeNull();
    });
  });

  describe('EnhancedMultiLevelCache', () => {
    let multiLevelCache: EnhancedMultiLevelCache;
    let mockL1: MemoryCacheAdapter;
    let mockL2: EnhancedRedisCacheAdapter;

    beforeEach(() => {
      mockL1 = new MemoryCacheAdapter('test-l1', 300);
      mockL2 = new EnhancedRedisCacheAdapter('test-l2', mockRedis as any, 3600, cacheFactory.getMonitor());
      multiLevelCache = new EnhancedMultiLevelCache('test-multi', mockL1, mockL2, cacheFactory.getMonitor());
    });

    test('应该在L1未命中时从L2获取', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify('value1'));

      // L1应该未命中，L2应该命中
      const value = await multiLevelCache.get<string>('key1');

      expect(value).toBe('value1');
      expect(mockRedis.get).toHaveBeenCalledWith('key1');
    });

    test('应该在L1命中时不访问L2', async () => {
      await mockL1.set('key1', 'value1');

      const value = await multiLevelCache.get<string>('key1');

      expect(value).toBe('value1');
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    test('应该设置值到两级缓存', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await multiLevelCache.set('key1', 'value1');

      const l1Value = await mockL1.get<string>('key1');
      expect(l1Value).toBe('value1');

      expect(mockRedis.setex).toHaveBeenCalledWith('key1', 3600, JSON.stringify('value1'));
    });

    test('应该删除两级缓存中的键', async () => {
      mockRedis.del.mockResolvedValue(1);
      await mockL1.set('key1', 'value1');

      await multiLevelCache.del('key1');

      expect(await mockL1.exists('key1')).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith('key1');
    });

    test('应该清空两级缓存', async () => {
      mockRedis.flushall.mockResolvedValue('OK');

      await multiLevelCache.clear();

      expect(await mockL1.getStats()).toMatchObject({ size: 0 });
      expect(mockRedis.flushall).toHaveBeenCalled();
    });

    test('应该获取多级缓存统计', async () => {
      mockRedis.info.mockResolvedValue('# Memory\r\nused_memory:1024\r\n');

      await mockL1.set('key1', 'value1');
      await multiLevelCache.get<string>('key1'); // 命中L1

      const stats = await multiLevelCache.getStats();

      expect(stats.name).toBe('test-multi');
      expect(stats.hitRate).toBeDefined();
    });

    test('应该处理健康检查', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test-value');

      const health = await cacheFactory.healthCheck();

      expect(health.healthy).toBeDefined();
      expect(health.details).toBeDefined();
    });
  });

  describe('集成测试', () => {
    test('应该通过工厂创建多级缓存并正常工作', async () => {
      const cache = cacheFactory.createMultiLevelCache('integration-test', mockRedisConfig);

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      // 设置值
      await cache.set('integration-key', 'integration-value');

      // 获取值（应该从L1命中）
      mockRedis.get.mockClear(); // 清除调用记录
      const value = await cache.get<string>('integration-key');

      expect(value).toBe('integration-value');
      expect(mockRedis.get).not.toHaveBeenCalled(); // L1应该命中

      // 获取统计信息
      const stats = await cache.getStats();
      expect(stats.name).toBe('integration-test');
      expect(stats.hitRate).toBeDefined();
    });

    test('应该获取所有缓存的统计信息', async () => {
      const cache1 = cacheFactory.createMultiLevelCache('test1', mockRedisConfig);
      const cache2 = cacheFactory.createMultiLevelCache('test2', mockRedisConfig);

      mockRedis.setex.mockResolvedValue('OK');

      await cache1.set('key1', 'value1');
      await cache2.set('key2', 'value2');

      const allStats = await cacheFactory.getAllCacheStats();
      expect(allStats.size).toBe(2);
      expect(allStats.has('test1')).toBe(true);
      expect(allStats.has('test2')).toBe(true);
    });

    test('应该执行健康检查', async () => {
      const cache = cacheFactory.createMultiLevelCache('health-test', mockRedisConfig);
      
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test-value');

      // 测试基本健康检查
      const health = await cacheFactory.healthCheck();
      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
    });

    test('应该正确关闭所有缓存', async () => {
      const cache1 = cacheFactory.createMultiLevelCache('close-test1', mockRedisConfig);
      const cache2 = cacheFactory.createMultiLevelCache('close-test2', mockRedisConfig);

      mockRedis.quit.mockResolvedValue('OK');

      await cacheFactory.closeAllCaches();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});