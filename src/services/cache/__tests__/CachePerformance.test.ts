import { EnhancedCacheFactory } from '../EnhancedCacheFactory';
import { createMockRedis } from './types';

describe('Cache Performance Tests', () => {
  let cacheFactory: EnhancedCacheFactory;
  let mockRedis: any;

  beforeEach(() => {
    cacheFactory = new EnhancedCacheFactory();
    mockRedis = createMockRedis();
  });

  test('应该测试多级缓存性能', async () => {
    const mockRedisConfig = {
      url: 'redis://localhost:6379',
      enabled: true,
      useMultiLevel: true,
      ttl: { embedding: 3600, search: 1800, graph: 7200, progress: 300 },
      retry: { attempts: 3, delay: 100 },
      pool: { min: 5, max: 10 },
    };

    const cache = cacheFactory.createMultiLevelCache('perf-test', mockRedisConfig);

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);

    // 测试批量操作性能
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      key: `key-${i}`,
      value: `value-${i}`,
    }));

    const startTime = Date.now();

    // 批量设置
    await Promise.all(testData.map(({ key, value }) => cache.set(key, value)));

    const setTime = Date.now() - startTime;
    console.log(`批量设置1000条数据耗时: ${setTime}ms`);

    // 批量获取
    const getStartTime = Date.now();
    const results = await Promise.all(testData.map(({ key }) => cache.get(key)));

    const getTime = Date.now() - getStartTime;
    console.log(`批量获取1000条数据耗时: ${getTime}ms`);

    // 验证数据完整性
    expect(results).toHaveLength(1000);
    expect(results.every(r => r !== null)).toBe(true);

    // 验证统计信息
    const stats = await cache.getStats();
    expect(stats.name).toBe('perf-test');
    expect(stats.hitRate).toBeDefined();
    expect(stats.size).toBeGreaterThan(0);
  });

  test('应该测试缓存命中率', async () => {
    const mockRedisConfig = {
      url: 'redis://localhost:6379',
      enabled: true,
      useMultiLevel: true,
      ttl: { embedding: 3600, search: 1800, graph: 7200, progress: 300 },
      retry: { attempts: 3, delay: 100 },
      pool: { min: 5, max: 10 },
    };

    const cache = cacheFactory.createMultiLevelCache('hit-test', mockRedisConfig);

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);

    // 预热缓存
    await cache.set('test-key', 'test-value');

    // 多次获取同一键，应该主要命中L1
    const requests = 100;
    for (let i = 0; i < requests; i++) {
      await cache.get('test-key');
    }

    const stats = await cache.getStats();
    expect(stats.hitCount).toBeGreaterThan(0);
    expect(stats.missCount).toBeGreaterThan(0);
    expect(stats.hitRate).toBeGreaterThan(0.9);
  });
});
