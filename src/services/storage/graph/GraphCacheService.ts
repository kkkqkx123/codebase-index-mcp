import { CacheEntry } from './GraphPersistenceService';
import { LoggerService } from '../../../core/LoggerService';
import { injectable } from 'inversify';

export interface GraphCacheConfig {
  maxCacheSize: number;
  defaultCacheTTL: number;
  cleanupInterval: number;
}

@injectable()
export class GraphCacheService {
  private queryCache: Map<string, CacheEntry<any>> = new Map();
  private nodeExistenceCache: Map<string, CacheEntry<boolean>> = new Map();
  private graphStatsCache: CacheEntry<{
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  }> | null = null;

  private logger: LoggerService;
  private config: GraphCacheConfig;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor(logger: LoggerService, config: Partial<GraphCacheConfig> = {}) {
    this.logger = logger;
    this.config = {
      maxCacheSize: 1000,
      defaultCacheTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      ...config
    };

    this.startCacheCleanup();
  }

  getFromCache<T>(key: string): T | null {
    const entry = this.queryCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  setCache<T>(key: string, data: T, ttl?: number): void {
    if (this.queryCache.size >= this.config.maxCacheSize) {
      this.cleanupCache();
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultCacheTTL
    });
  }

  hasNodeInCache(nodeId: string): boolean {
    const entry = this.nodeExistenceCache.get(nodeId);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.nodeExistenceCache.delete(nodeId);
      return false;
    }

    return entry.data;
  }

  cacheNodeExistence(nodeId: string, exists: boolean, ttl?: number): void {
    if (this.nodeExistenceCache.size >= this.config.maxCacheSize) {
      this.cleanupNodeExistenceCache();
    }

    this.nodeExistenceCache.set(nodeId, {
      data: exists,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultCacheTTL
    });
  }

  getGraphStatsCache() {
    if (!this.graphStatsCache) return null;

    if (Date.now() - this.graphStatsCache.timestamp > this.graphStatsCache.ttl) {
      this.graphStatsCache = null;
      return null;
    }

    return this.graphStatsCache.data;
  }

  setGraphStatsCache(stats: any, ttl?: number): void {
    this.graphStatsCache = {
      data: stats,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultCacheTTL
    };
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries from query cache`);
    }
  }

  private cleanupNodeExistenceCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.nodeExistenceCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.nodeExistenceCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries from node existence cache`);
    }
  }

  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
      this.cleanupNodeExistenceCache();
    }, this.config.cleanupInterval);
  }

  getCacheStats() {
    return {
      queryCacheSize: this.queryCache.size,
      nodeExistenceCacheSize: this.nodeExistenceCache.size,
      graphStatsCache: this.graphStatsCache !== null,
      totalEntries: this.queryCache.size + this.nodeExistenceCache.size
    };
  }

  clearAllCache(): void {
    this.queryCache.clear();
    this.nodeExistenceCache.clear();
    this.graphStatsCache = null;
    this.logger.info('All graph caches cleared');
  }

  stop(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.logger.info('Graph cache service stopped');
  }
}