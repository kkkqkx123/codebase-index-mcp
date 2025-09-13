import { CacheInterface } from './CacheInterface';
import { EnhancedMultiLevelCache } from './EnhancedMultiLevelCache';
import { EnhancedRedisCacheAdapter } from './EnhancedRedisCacheAdapter';
import { EnhancedCacheMonitor } from './EnhancedCacheMonitor';
import { RedisConfig } from '../../config/RedisConfig';
import { MemoryCacheAdapter } from './MemoryCacheAdapter';
import { LoggerService } from '../../core/LoggerService';

export interface CacheFactoryConfig {
  redis?: RedisConfig;
  monitor?: {
    enabled: boolean;
    metricsInterval?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
  memory?: {
    maxSize?: number;
    ttl?: number;
    cleanupInterval?: number;
  };
}

export class EnhancedCacheFactory {
  private static instance: EnhancedCacheFactory;
  private monitor: EnhancedCacheMonitor;
  private logger: LoggerService;
  private cacheInstances: Map<string, CacheInterface> = new Map();

  constructor(config?: CacheFactoryConfig) {
    this.logger = new LoggerService();
    this.monitor = new EnhancedCacheMonitor();
  }

  static getInstance(config?: CacheFactoryConfig): EnhancedCacheFactory {
    if (!EnhancedCacheFactory.instance) {
      EnhancedCacheFactory.instance = new EnhancedCacheFactory(config);
    }
    return EnhancedCacheFactory.instance;
  }

  /**
   * 创建内存缓存
   */
  createMemoryCache(name: string, config?: CacheFactoryConfig['memory']): CacheInterface {
    return new MemoryCacheAdapter(
      name,
      config?.ttl ?? 300
    );
  }

  /**
   * 创建Redis缓存
   */
  createRedisCache(name: string, redisConfig: RedisConfig): CacheInterface {
    const Redis = require('ioredis');
    const redis = new Redis(redisConfig.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000
    });
    return new EnhancedRedisCacheAdapter(name, redis, 3600, this.monitor);
  }

  /**
   * 创建多级缓存（L1: 内存 + L2: Redis）
   */
  createMultiLevelCache(
    name: string,
    redisConfig: RedisConfig,
    config?: CacheFactoryConfig
  ): EnhancedMultiLevelCache {
    // 检查是否已存在相同名称的缓存
    if (this.cacheInstances.has(name)) {
      const existing = this.cacheInstances.get(name);
      if (existing instanceof EnhancedMultiLevelCache) {
        this.logger.warn(`缓存实例已存在，返回现有实例: ${name}`);
        return existing;
      }
    }

    // 创建L1内存缓存
    const l1Cache = this.createMemoryCache(`${name}:l1`, config?.memory);
    
    // 创建L2 Redis缓存
    const l2Cache = this.createRedisCache(`${name}:l2`, redisConfig);
    
    // 创建多级缓存
    const multiLevelCache = new EnhancedMultiLevelCache(
      name,
      l1Cache,
      l2Cache,
      this.monitor
    );

    // 注册到实例管理
    this.cacheInstances.set(name, multiLevelCache);

    this.logger.info(`多级缓存创建完成: ${name}`, {
      name,
      l1Type: 'memory',
      l2Type: 'redis',
      l1MaxSize: config?.memory?.maxSize ?? 1000,
      l2RedisConfig: redisConfig
    });

    return multiLevelCache;
  }

  /**
   * 创建纯Redis缓存（单级）
   */
  createRedisOnlyCache(name: string, redisConfig: RedisConfig): CacheInterface {
    return this.createRedisCache(name, redisConfig);
  }

  /**
   * 创建纯内存缓存（单级）
   */
  createMemoryOnlyCache(name: string, config?: CacheFactoryConfig['memory']): CacheInterface {
    return this.createMemoryCache(name, config);
  }

  /**
   * 获取缓存实例
   */
  getCache(name: string): CacheInterface | undefined {
    return this.cacheInstances.get(name);
  }

  /**
   * 获取所有缓存实例
   */
  getAllCaches(): Map<string, CacheInterface> {
    return new Map(this.cacheInstances);
  }

  /**
   * 移除缓存实例
   */
  async removeCache(name: string): Promise<boolean> {
    const cache = this.cacheInstances.get(name);
    if (cache) {
      try {
        await cache.close();
        this.cacheInstances.delete(name);
        
        this.logger.info(`缓存实例移除完成: ${name}`);
        return true;
      } catch (error) {
        this.logger.error(`缓存实例移除失败: ${name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    }
    return false;
  }

  /**
   * 获取监控器
   */
  getMonitor(): EnhancedCacheMonitor {
    return this.monitor;
  }

  /**
   * 获取所有缓存的统计信息
   */
  async getAllCacheStats(): Promise<Map<string, any>> {
    const stats = new Map<string, any>();
    
    for (const [name, cache] of this.cacheInstances) {
      try {
        if (cache instanceof EnhancedMultiLevelCache) {
          stats.set(name, await cache.getStats());
        } else {
          stats.set(name, await cache.getStats());
        }
      } catch (error) {
        this.logger.error(`获取缓存统计失败: ${name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return stats;
  }

  /**
   * 清空所有缓存
   */
  async clearAllCaches(): Promise<void> {
    const promises = Array.from(this.cacheInstances.entries()).map(async ([name, cache]) => {
      try {
        await cache.clear();
        this.logger.info(`缓存清空完成: ${name}`);
      } catch (error) {
        this.logger.error(`缓存清空失败: ${name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(promises);
    this.logger.info('所有缓存已清空');
  }

  /**
   * 关闭所有缓存
   */
  async closeAllCaches(): Promise<void> {
    const promises = Array.from(this.cacheInstances.entries()).map(async ([name, cache]) => {
      try {
        await cache.close();
        this.logger.info(`缓存关闭完成: ${name}`);
      } catch (error) {
        this.logger.error(`缓存关闭失败: ${name}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(promises);
    this.cacheInstances.clear();
    
    // 监控器不需要关闭，它是无状态的
    
    this.logger.info('所有缓存和监控器已关闭');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Map<string, { healthy: boolean; message?: string }>;
  }> {
    const details = new Map<string, { healthy: boolean; message?: string }>();
    let allHealthy = true;

    for (const [name, cache] of this.cacheInstances) {
      try {
        if (cache instanceof EnhancedMultiLevelCache) {
          // 多级缓存的健康检查
          const health = await this.basicHealthCheck(cache, name);
          details.set(name, health);
          
          if (!health.healthy) {
            allHealthy = false;
          }
        } else {
          // 基本健康检查
          const testKey = `health:${Date.now()}`;
          await cache.set(testKey, 'health-check', { ttl: 1 });
          const value = await cache.get(testKey);
          const healthy = value === 'health-check';
          
          details.set(name, { healthy });
          
          if (!healthy) {
            allHealthy = false;
          }
        }
      } catch (error) {
        details.set(name, {
          healthy: false,
          message: error instanceof Error ? error.message : String(error)
        });
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      details
    };
  }

  /**
   * 基础健康检查
   */
  private async basicHealthCheck(cache: any, name: string): Promise<{ healthy: boolean; message?: string }> {
    try {
      const testKey = `health:${Date.now()}`;
      await cache.set(testKey, 'health-check', { ttl: 1 });
      const value = await cache.get(testKey);
      const healthy = value === 'health-check';
      
      return {
        healthy,
        message: healthy ? undefined : '健康检查失败'
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取缓存配置模板
   */
  static getDefaultConfig(): CacheFactoryConfig {
    return {
      redis: {
        enabled: true,
        url: 'redis://localhost:6379/0',
        useMultiLevel: true,
        ttl: {
          embedding: 86400,
          search: 3600,
          graph: 1800,
          progress: 300
        },
        retry: {
          attempts: 3,
          delay: 1000
        },
        pool: {
          min: 1,
          max: 10
        }
      },
      monitor: {
        enabled: true,
        metricsInterval: 30000, // 30秒
        logLevel: 'info'
      },
      memory: {
        maxSize: 1000,
        ttl: 300, // 5分钟
        cleanupInterval: 60 // 1分钟
      }
    };
  }

  /**
   * 获取环境配置
   */
  static getConfigFromEnv(): CacheFactoryConfig {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD;
    const db = process.env.REDIS_DB || '0';
    const protocol = password ? 'rediss' : 'redis';
    const auth = password ? `${password}@` : '';
    
    return {
      redis: {
        enabled: process.env.REDIS_ENABLED !== 'false',
        url: `${protocol}://${auth}${host}:${port}/${db}`,
        maxmemory: process.env.REDIS_MAXMEMORY || '256mb',
        useMultiLevel: process.env.REDIS_USE_MULTI_LEVEL !== 'false',
        ttl: {
          embedding: parseInt(process.env.REDIS_TTL_EMBEDDING || '86400', 10),
          search: parseInt(process.env.REDIS_TTL_SEARCH || '3600', 10),
          graph: parseInt(process.env.REDIS_TTL_GRAPH || '1800', 10),
          progress: parseInt(process.env.REDIS_TTL_PROGRESS || '300', 10)
        },
        retry: {
          attempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
          delay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10)
        },
        pool: {
          min: parseInt(process.env.REDIS_POOL_MIN || '1', 10),
          max: parseInt(process.env.REDIS_POOL_MAX || '10', 10)
        }
      },
      monitor: {
        enabled: process.env.CACHE_MONITOR_ENABLED !== 'false',
        metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '30000', 10),
        logLevel: (process.env.CACHE_LOG_LEVEL as any) || 'info'
      },
      memory: {
        maxSize: parseInt(process.env.CACHE_MEMORY_MAX_SIZE || '1000', 10),
        ttl: parseInt(process.env.CACHE_MEMORY_TTL || '300', 10),
        cleanupInterval: parseInt(process.env.CACHE_MEMORY_CLEANUP_INTERVAL || '60', 10)
      }
    };
  }
}