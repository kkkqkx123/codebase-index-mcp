import { CacheInterface, CacheStats, CacheOptions } from './CacheInterface';
import { LoggerService } from '../../core/LoggerService';

export class MultiLevelCache implements CacheInterface {
  private name: string;
  private level1: CacheInterface; // 内存缓存
  private level2: CacheInterface; // Redis缓存
  private logger: LoggerService;

  constructor(name: string, level1: CacheInterface, level2: CacheInterface) {
    this.name = name;
    this.level1 = level1;
    this.level2 = level2;
    this.logger = LoggerService.getInstance();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // 先尝试L1缓存
      const l1Value = await this.level1.get<T>(key);
      if (l1Value !== null) {
        this.logger.debug(`L1缓存命中: ${key}`);
        return l1Value;
      }

      // L1未命中，尝试L2缓存
      const l2Value = await this.level2.get<T>(key);
      if (l2Value !== null) {
        this.logger.debug(`L2缓存命中，回填L1: ${key}`);
        // 回填到L1缓存
        await this.level1.set(key, l2Value, { ttl: 300 }); // L1缓存5分钟
        return l2Value;
      }

      this.logger.debug(`缓存未命中: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`多级缓存获取失败: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || 3600;
      
      // 同时设置到两个缓存层
      const l1Result = await this.level1.set(key, value, { ttl: Math.min(ttl, 300) }); // L1最多5分钟
      const l2Result = await this.level2.set(key, value, { ttl });
      
      return l1Result && l2Result;
    } catch (error) {
      this.logger.error(`多级缓存设置失败: ${key}`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      // 从两个缓存层都删除
      const l1Result = await this.level1.del(key);
      const l2Result = await this.level2.del(key);
      
      return l1Result || l2Result;
    } catch (error) {
      this.logger.error(`多级缓存删除失败: ${key}`, error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const l1Result = await this.level1.clear();
      const l2Result = await this.level2.clear();
      
      return l1Result && l2Result;
    } catch (error) {
      this.logger.error(`多级缓存清空失败: ${this.name}`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      // 优先检查L1缓存
      const l1Exists = await this.level1.exists(key);
      if (l1Exists) {
        return true;
      }
      
      return await this.level2.exists(key);
    } catch (error) {
      this.logger.error(`多级缓存检查存在失败: ${key}`, error);
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const l1Stats = await this.level1.getStats();
      const l2Stats = await this.level2.getStats();
      
      return {
        name: this.name,
        size: l1Stats.size + l2Stats.size,
        maxSize: l1Stats.maxSize + l2Stats.maxSize,
        hitCount: l1Stats.hitCount + l2Stats.hitCount,
        missCount: l1Stats.missCount + l2Stats.missCount,
        hitRate: (l1Stats.hitCount + l2Stats.hitCount) / 
                (l1Stats.hitCount + l2Stats.hitCount + l1Stats.missCount + l2Stats.missCount) || 0
      };
    } catch (error) {
      this.logger.error(`多级缓存统计失败: ${this.name}`, error);
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
      await Promise.all([
        this.level1.close(),
        this.level2.close()
      ]);
    } catch (error) {
      this.logger.error(`多级缓存关闭失败: ${this.name}`, error);
    }
  }

  // 额外的方法：只清除L1缓存（用于内存压力管理）
  async clearL1(): Promise<boolean> {
    try {
      return await this.level1.clear();
    } catch (error) {
      this.logger.error(`L1缓存清空失败: ${this.name}`, error);
      return false;
    }
  }

  // 额外的方法：预热L1缓存
  async warmUp(keys: string[]): Promise<void> {
    try {
      for (const key of keys) {
        const value = await this.level2.get(key);
        if (value !== null) {
          await this.level1.set(key, value, { ttl: 300 });
        }
      }
    } catch (error) {
      this.logger.error(`缓存预热失败: ${this.name}`, error);
    }
  }
}