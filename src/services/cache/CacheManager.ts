import { injectable, inject } from 'inversify';
import Redis from 'ioredis';
import { CacheInterface } from './CacheInterface';
import { CacheFactory } from './CacheFactory';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { TYPES } from '../../types';

@injectable()
export class CacheManager {
  private caches = new Map<string, CacheInterface>();
  private logger: LoggerService;

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    this.logger = new LoggerService();
  }

  /**
   * 获取或创建缓存实例
   * @param name 缓存名称
   * @param defaultTTL 默认TTL（秒）
   * @returns 缓存实例
   */
  async getCache(name: string, defaultTTL?: number): Promise<CacheInterface> {
    if (this.caches.has(name)) {
      return this.caches.get(name)!;
    }

    const redisConfig = this.configService.get('redis');
    const ttl = defaultTTL || redisConfig.ttl.embedding;
    
    const cache = CacheFactory.createCache(name, redisConfig, ttl);
    this.caches.set(name, cache);
    
    this.logger.info(`创建缓存实例: ${name} (TTL: ${ttl}s, MultiLevel: ${redisConfig.useMultiLevel})`);
    return cache;
  }

  /**
   * 获取特定类型的缓存
   */
  async getEmbeddingCache(): Promise<CacheInterface> {
    const config = this.configService.get('redis');
    return this.getCache('embedding', config.ttl.embedding);
  }

  async getSearchCache(): Promise<CacheInterface> {
    const config = this.configService.get('redis');
    return this.getCache('search', config.ttl.search);
  }

  async getGraphCache(): Promise<CacheInterface> {
    const config = this.configService.get('redis');
    return this.getCache('graph', config.ttl.graph);
  }

  async getProgressCache(): Promise<CacheInterface> {
    const config = this.configService.get('redis');
    return this.getCache('progress', config.ttl.progress);
  }

  /**
   * 获取所有缓存的统计信息
   */
  async getAllStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    
    const entries = Array.from(this.caches.entries());
    for (const [name, cache] of entries) {
      try {
        stats[name] = await cache.getStats();
      } catch (error) {
        this.logger.error(`获取缓存统计失败: ${name}`, error);
        stats[name] = { error: (error as Error).message };
      }
    }
    
    return stats;
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<void> {
    this.logger.info('清空所有缓存...');
    
    const promises = Array.from(this.caches.values()).map(cache => 
      cache.clear().catch(error => 
        this.logger.error(`清空缓存失败: ${cache.getName()}`, error)
      )
    );
    
    await Promise.all(promises);
    this.logger.info('所有缓存已清空');
  }

  /**
   * 关闭所有缓存连接
   */
  async shutdown(): Promise<void> {
    this.logger.info('关闭所有缓存连接...');
    
    const promises = Array.from(this.caches.values()).map(cache => 
      cache.close().catch(error => 
        this.logger.error(`关闭缓存失败: ${cache.getName()}`, error)
      )
    );
    
    await Promise.all(promises);
    this.caches.clear();
    
    await CacheFactory.shutdown();
    this.logger.info('所有缓存连接已关闭');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ [name: string]: any }> {
    const stats: { [name: string]: any } = {};
    
    try {
      const redisConfig = this.configService.get('redis');
      if (!redisConfig || !redisConfig.enabled) {
        stats.redis = { status: 'disabled' };
        return stats;
      }

      // 检查Redis连接
      const redis = new Redis(redisConfig.url);
      await redis.ping();
      await redis.quit();
      
      stats.redis = { status: 'healthy' };
    } catch (error) {
      stats.redis = { error: (error as Error).message };
    }

    return stats;
  }
}