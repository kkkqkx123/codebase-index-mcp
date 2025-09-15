import { RedisConfig } from '../../../config/RedisConfig';
import { EnhancedCacheFactory } from '../EnhancedCacheFactory';

describe('Redis Configuration', () => {
  test('应该正确解析Redis配置', () => {
    const config: RedisConfig = {
      url: 'redis://localhost:6379',
      enabled: true,
      useMultiLevel: true,
      ttl: {
        embedding: 3600,
        search: 1800,
        graph: 7200,
        progress: 300,
      },
      retry: {
        attempts: 3,
        delay: 100,
      },
      pool: {
        min: 5,
        max: 10,
      },
    };

    expect(config.url).toBe('redis://localhost:6379');
    expect(config.enabled).toBe(true);
    expect(config.ttl.embedding).toBe(3600);
    expect(config.retry.attempts).toBe(3);
  });

  test('应该使用默认配置', () => {
    const factory = new EnhancedCacheFactory();
    const defaultConfig = EnhancedCacheFactory.getDefaultConfig();

    expect(defaultConfig.redis).toBeDefined();
    expect(defaultConfig.redis?.enabled).toBe(true);
    expect(defaultConfig.redis?.useMultiLevel).toBe(true);
  });

  test('应该从环境变量获取配置', () => {
    // 设置测试环境变量
    process.env.REDIS_HOST = 'test';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_ENABLED = 'true';
    process.env.REDIS_TTL_EMBEDDING = '7200';

    const factory = new EnhancedCacheFactory();
    const config = EnhancedCacheFactory.getConfigFromEnv();

    expect(config.redis?.url).toBe('redis://test:6379/0');
    expect(config.redis?.enabled).toBe(true);
    expect(config.redis?.ttl.embedding).toBe(7200);

    // 清理环境变量
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_TTL_EMBEDDING;
  });
});
