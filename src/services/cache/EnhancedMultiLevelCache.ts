import { CacheInterface, CacheStats, CacheOptions } from './CacheInterface';
import { LoggerService } from '../../core/LoggerService';
import { EnhancedCacheMonitor } from './EnhancedCacheMonitor';

export interface MultiLevelCacheStats {
  name: string;
  l1Stats: CacheStats;
  l2Stats: CacheStats;
  combinedStats: {
    totalHits: number;
    totalMisses: number;
    totalOperations: number;
    hitRate: number;
    l1HitRate: number;
    l2HitRate: number;
  };
  memoryUsage: {
    l1Size: number;
    l2Size: number;
  };
}

export class EnhancedMultiLevelCache implements CacheInterface {
  private name: string;
  private level1: CacheInterface; // 内存缓存
  private level2: CacheInterface; // Redis缓存
  private logger: LoggerService;
  private monitor: EnhancedCacheMonitor;
  private l1HitCount: number = 0;
  private l2HitCount: number = 0;
  private missCount: number = 0;
  private defaultTTL: number = 3600;

  constructor(
    name: string,
    level1: CacheInterface,
    level2: CacheInterface,
    monitor?: EnhancedCacheMonitor
  ) {
    this.name = name;
    this.level1 = level1;
    this.level2 = level2;
    this.logger = new LoggerService();
    this.monitor = monitor || new EnhancedCacheMonitor();
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // L1: 内存缓存
      const l1Value = await this.monitor.monitorOperation(
        `${this.name}:l1`,
        'get',
        key,
        () => this.level1.get<T>(key)
      );

      if (l1Value !== null) {
        this.l1HitCount++;
        this.monitor.updateHitMiss(`${this.name}:l1`, true);
        
        this.logger.debug(`L1缓存命中: ${key}`, {
          cache: this.name,
          level: 'L1',
          key,
          duration: Date.now() - startTime
        });

        return l1Value;
      }

      // L2: Redis缓存
      const l2Value = await this.monitor.monitorOperation(
        `${this.name}:l2`,
        'get',
        key,
        () => this.level2.get<T>(key)
      );

      if (l2Value !== null) {
        this.l2HitCount++;
        this.monitor.updateHitMiss(`${this.name}:l2`, true);
        
        // 回填到L1缓存（带较短TTL）
        try {
          await this.level1.set(key, l2Value, { ttl: 300 }); // 5分钟
          this.logger.debug(`L2缓存命中，回填L1: ${key}`, {
            cache: this.name,
            level: 'L2',
            key,
            duration: Date.now() - startTime
          });
        } catch (error) {
          this.logger.warn(`回填L1缓存失败: ${key}`, {
            cache: this.name,
            key,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        return l2Value;
      }

      // 缓存未命中
      this.missCount++;
      this.monitor.updateHitMiss(`${this.name}:l1`, false);
      this.monitor.updateHitMiss(`${this.name}:l2`, false);

      this.logger.debug(`缓存未命中: ${key}`, {
        cache: this.name,
        key,
        duration: Date.now() - startTime
      });

      return null;
    } catch (error) {
      this.logger.error(`多级缓存获取失败: ${key}`, {
        cache: this.name,
        key,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const ttl = options?.ttl || this.defaultTTL;
      
      // 设置到两个缓存层
      const l1TTL = Math.min(ttl, 300); // L1最多5分钟
      
      const [l1Result, l2Result] = await Promise.all([
        this.monitor.monitorOperation(
          `${this.name}:l1`,
          'set',
          key,
          () => this.level1.set(key, value, { ttl: l1TTL })
        ),
        this.monitor.monitorOperation(
          `${this.name}:l2`,
          'set',
          key,
          () => this.level2.set(key, value, { ttl })
        )
      ]);

      const success = l1Result && l2Result;
      
      this.logger.debug(`多级缓存设置完成: ${key}`, {
        cache: this.name,
        key,
        ttl,
        l1TTL,
        success,
        duration: Date.now() - startTime
      });

      return success;
    } catch (error) {
      this.logger.error(`多级缓存设置失败: ${key}`, {
        cache: this.name,
        key,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const [l1Result, l2Result] = await Promise.all([
        this.monitor.monitorOperation(
          `${this.name}:l1`,
          'del',
          key,
          () => this.level1.del(key)
        ),
        this.monitor.monitorOperation(
          `${this.name}:l2`,
          'del',
          key,
          () => this.level2.del(key)
        )
      ]);

      const success = l1Result || l2Result;

      this.logger.debug(`多级缓存删除完成: ${key}`, {
        cache: this.name,
        key,
        l1Deleted: l1Result,
        l2Deleted: l2Result,
        duration: Date.now() - startTime
      });

      return success;
    } catch (error) {
      this.logger.error(`多级缓存删除失败: ${key}`, {
        cache: this.name,
        key,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async clear(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const [l1Result, l2Result] = await Promise.all([
        this.monitor.monitorOperation(
          `${this.name}:l1`,
          'clear',
          undefined,
          () => this.level1.clear()
        ),
        this.monitor.monitorOperation(
          `${this.name}:l2`,
          'clear',
          undefined,
          () => this.level2.clear()
        )
      ]);

      const success = l1Result && l2Result;

      this.logger.info(`多级缓存清空完成: ${this.name}`, {
        cache: this.name,
        l1Cleared: l1Result,
        l2Cleared: l2Result,
        success,
        duration: Date.now() - startTime
      });

      return success;
    } catch (error) {
      this.logger.error(`多级缓存清空失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // 优先检查L1缓存
      const l1Exists = await this.monitor.monitorOperation(
        `${this.name}:l1`,
        'exists',
        key,
        () => this.level1.exists(key)
      );

      if (l1Exists) {
        this.logger.debug(`L1缓存存在: ${key}`, {
          cache: this.name,
          level: 'L1',
          key,
          duration: Date.now() - startTime
        });
        return true;
      }

      // 检查L2缓存
      const l2Exists = await this.monitor.monitorOperation(
        `${this.name}:l2`,
        'exists',
        key,
        () => this.level2.exists(key)
      );

      this.logger.debug(`L2缓存检查: ${key}`, {
        cache: this.name,
        level: 'L2',
        key,
        exists: l2Exists,
        duration: Date.now() - startTime
      });

      return l2Exists;
    } catch (error) {
      this.logger.error(`多级缓存存在检查失败: ${key}`, {
        cache: this.name,
        key,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const [l1Stats, l2Stats] = await Promise.all([
        this.level1.getStats(),
        this.level2.getStats()
      ]);

      const totalHits = this.l1HitCount + this.l2HitCount;
      const totalOperations = totalHits + this.missCount;
      const hitRate = totalOperations > 0 ? totalHits / totalOperations : 0;

      return {
        name: this.name,
        size: l1Stats.size + l2Stats.size,
        maxSize: l1Stats.maxSize + l2Stats.maxSize,
        hitCount: totalHits,
        missCount: this.missCount,
        hitRate: hitRate,
        memoryUsage: (l1Stats.memoryUsage || 0) + (l2Stats.memoryUsage || 0)
      };
    } catch (error) {
      this.logger.error(`多级缓存统计获取失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        name: this.name,
        size: 0,
        maxSize: 0,
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * 获取多级缓存的详细统计信息
   */
  async getMultiLevelStats(): Promise<MultiLevelCacheStats> {
    try {
      const [l1Stats, l2Stats] = await Promise.all([
        this.level1.getStats(),
        this.level2.getStats()
      ]);

      const totalHits = this.l1HitCount + this.l2HitCount;
      const totalOperations = totalHits + this.missCount;
      const hitRate = totalOperations > 0 ? totalHits / totalOperations : 0;
      const l1HitRate = totalOperations > 0 ? this.l1HitCount / totalOperations : 0;
      const l2HitRate = totalOperations > 0 ? this.l2HitCount / totalOperations : 0;

      return {
        name: this.name,
        l1Stats,
        l2Stats,
        combinedStats: {
          totalHits,
          totalMisses: this.missCount,
          totalOperations,
          hitRate,
          l1HitRate,
          l2HitRate
        },
        memoryUsage: {
          l1Size: l1Stats.size,
          l2Size: l2Stats.size
        }
      };
    } catch (error) {
      this.logger.error(`多级缓存详细统计获取失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        name: this.name,
        l1Stats: {
          name: `${this.name}:l1`,
          size: 0,
          maxSize: 0,
          hitCount: 0,
          missCount: 0,
          hitRate: 0
        },
        l2Stats: {
          name: `${this.name}:l2`,
          size: 0,
          maxSize: 0,
          hitCount: 0,
          missCount: 0,
          hitRate: 0
        },
        combinedStats: {
          totalHits: 0,
          totalMisses: 0,
          totalOperations: 0,
          hitRate: 0,
          l1HitRate: 0,
          l2HitRate: 0
        },
        memoryUsage: {
          l1Size: 0,
          l2Size: 0
        }
      };
    }
  }

  getName(): string {
    return this.name;
  }

  async close(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await Promise.all([
        this.level1.close(),
        this.level2.close()
      ]);

      this.logger.info(`多级缓存关闭完成: ${this.name}`, {
        cache: this.name,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.logger.error(`多级缓存关闭失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * 获取监控器
   */
  getMonitor(): EnhancedCacheMonitor {
    return this.monitor;
  }

  /**
   * 获取缓存层级统计
   */
  getCacheBreakdown(): {
    l1: { hits: number; misses: number };
    l2: { hits: number; misses: number };
    total: { hits: number; misses: number };
  } {
    return {
      l1: { hits: this.l1HitCount, misses: this.missCount },
      l2: { hits: this.l2HitCount, misses: this.missCount },
      total: { 
        hits: this.l1HitCount + this.l2HitCount, 
        misses: this.missCount 
      }
    };
  }

  /**
   * 只清空L1缓存（用于内存压力管理）
   */
  async clearL1(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const result = await this.monitor.monitorOperation(
        `${this.name}:l1`,
        'clear',
        undefined,
        () => this.level1.clear()
      );

      this.logger.info(`L1缓存清空完成: ${this.name}`, {
        cache: this.name,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.logger.error(`L1缓存清空失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return false;
    }
  }

  /**
   * 预热L1缓存
   */
  async warmUp(keys: string[]): Promise<void> {
    const startTime = Date.now();
    let warmedCount = 0;
    
    try {
      for (const key of keys) {
        const value = await this.level2.get(key);
        if (value !== null) {
          await this.monitor.monitorOperation(
            `${this.name}:l1`,
            'set',
            key,
            () => this.level1.set(key, value, { ttl: 300 })
          );
          warmedCount++;
        }
      }

      this.logger.info(`缓存预热完成: ${this.name}`, {
        cache: this.name,
        keys: keys.length,
        warmedCount,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.logger.error(`缓存预热失败: ${this.name}`, {
        cache: this.name,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.l1HitCount = 0;
    this.l2HitCount = 0;
    this.missCount = 0;
    this.monitor.resetStats(`${this.name}:l1`);
    this.monitor.resetStats(`${this.name}:l2`);
    
    this.logger.info(`缓存统计重置完成: ${this.name}`, {
      cache: this.name
    });
  }
}