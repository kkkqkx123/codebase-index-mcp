import { Redis } from 'ioredis';
import { CacheInterface } from './CacheInterface';
import { MemoryCacheAdapter } from './MemoryCacheAdapter';
import { RedisCacheAdapter } from './RedisCacheAdapter';
import { MultiLevelCache } from './MultiLevelCache';
import { RedisConfig } from '../../config/RedisConfig';
import { RedisConfigManager } from './RedisConfigManager';

export class CacheFactory {
  private static redisInstance: Redis | null = null;

  static createMemoryCache(name: string, defaultTTL: number = 3600): CacheInterface {
    return new MemoryCacheAdapter(name, defaultTTL);
  }

  static createRedisCache(name: string, redis: Redis, defaultTTL: number = 3600): CacheInterface {
    return new RedisCacheAdapter(name, redis, defaultTTL);
  }

  static createMultiLevelCache(
    name: string, 
    redis: Redis, 
    defaultTTL: number = 3600
  ): CacheInterface {
    const l1Cache = new MemoryCacheAdapter(`${name}:l1`, 300); // L1缓存5分钟
    const l2Cache = new RedisCacheAdapter(`${name}:l2`, redis, defaultTTL);
    
    return new MultiLevelCache(name, l1Cache, l2Cache);
  }

  static createCache(
    name: string,
    redisConfig: RedisConfig,
    defaultTTL: number = 3600
  ): CacheInterface {
    if (!redisConfig.enabled) {
      // Redis未启用，只使用内存缓存
      return this.createMemoryCache(name, defaultTTL);
    }

    // 确保Redis连接已创建
    if (!this.redisInstance) {
      this.redisInstance = new Redis(redisConfig.url);
      
      // 配置Redis内存限制
      RedisConfigManager.configureRedis(this.redisInstance, redisConfig).catch(error => {
        console.error('配置Redis内存限制失败:', error);
      });
    }

    // 根据配置决定缓存类型
    if (redisConfig.useMultiLevel) {
      return this.createMultiLevelCache(name, this.redisInstance, defaultTTL);
    } else {
      return this.createRedisCache(name, this.redisInstance, defaultTTL);
    }
  }

  static async shutdown(): Promise<void> {
    if (this.redisInstance) {
      await this.redisInstance.quit();
      this.redisInstance = null;
    }
  }

  static getRedisInstance(): Redis | null {
    return this.redisInstance;
  }
}