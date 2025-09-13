import { CacheInterface, CacheStats, CacheOptions } from './CacheInterface';
import { LoggerService } from '../../core/LoggerService';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

export class MemoryCacheAdapter implements CacheInterface {
  private cache = new Map<string, CacheEntry<any>>();
  private name: string;
  private logger: LoggerService;
  private defaultTTL: number;
  private hitCount = 0;
  private missCount = 0;

  constructor(name: string, defaultTTL: number = 3600) {
    this.name = name;
    this.logger = new LoggerService();
    this.defaultTTL = defaultTTL;
    
    // 启动清理过期数据的定时器
    this.startCleanupTimer();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.missCount++;
        return null;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.missCount++;
        return null;
      }

      entry.accessedAt = Date.now();
      this.hitCount++;
      return entry.value as T;
    } catch (error) {
      this.logger.error(`内存缓存获取失败: ${key}`, error);
      this.missCount++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : Infinity;
      
      this.cache.set(key, {
        value,
        expiresAt,
        accessedAt: Date.now()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`内存缓存设置失败: ${key}`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const existed = this.cache.has(key);
      this.cache.delete(key);
      return existed;
    } catch (error) {
      this.logger.error(`内存缓存删除失败: ${key}`, error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      this.cache.clear();
      return true;
    } catch (error) {
      this.logger.error(`内存缓存清空失败: ${this.name}`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      if (!entry) return false;
      
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error(`内存缓存检查存在失败: ${key}`, error);
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      this.cleanupExpired();
      
      const total = this.cache.size;
      const hits = this.hitCount;
      const misses = this.missCount;
      const totalRequests = hits + misses;
      
      return {
        name: this.name,
        size: total,
        maxSize: 10000, // 内存缓存最大条目数限制
        hitCount: hits,
        missCount: misses,
        hitRate: totalRequests > 0 ? hits / totalRequests : 0
      };
    } catch (error) {
      this.logger.error(`内存缓存统计失败: ${this.name}`, error);
      return {
        name: this.name,
        size: 0,
        maxSize: 10000,
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
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private startCleanupTimer(): void {
    // 每60秒清理一次过期数据
    setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }
}