import { Redis } from 'ioredis';
import { CacheInterface, CacheStats, CacheOptions } from './CacheInterface';
import { LoggerService } from '../../core/LoggerService';

export class RedisCacheAdapter implements CacheInterface {
  private redis: Redis;
  private logger: LoggerService;
  private name: string;
  private defaultTTL: number;

  constructor(name: string, redis: Redis, defaultTTL: number = 3600) {
    this.name = name;
    this.redis = redis;
    this.logger = new LoggerService();
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Redis缓存获取失败: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Redis缓存设置失败: ${key}`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Redis缓存删除失败: ${key}`, error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const pattern = `${this.name}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Redis缓存清空失败: ${this.name}`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Redis缓存检查存在失败: ${key}`, error);
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const lines = info.split('\r\n');
      
      let usedMemory = 0;
      let maxMemory = 0;
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedMemory = parseInt(line.split(':')[1]) || 0;
        }
        if (line.startsWith('maxmemory:')) {
          maxMemory = parseInt(line.split(':')[1]) || 0;
        }
      }
      
      return {
        name: this.name,
        size: usedMemory,
        maxSize: maxMemory,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
    } catch (error) {
      this.logger.error(`Redis缓存统计失败: ${this.name}`, error);
      return {
        name: this.name,
        size: 0,
        maxSize: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0
      };
    }
  }

  getName(): string {
    return this.name;
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.error(`Redis连接关闭失败`, error);
    }
  }
}