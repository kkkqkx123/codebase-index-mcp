import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

export interface QueryRequest {
  query: string;
  projectId: string;
  options?: {
    limit?: number;
    threshold?: number;
    includeGraph?: boolean;
    filters?: {
      language?: string[];
      fileType?: string[];
      path?: string[];
    };
    searchType?: 'semantic' | 'hybrid' | 'graph';
  };
}

export interface QueryResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
}

export interface CacheEntry {
  key: string;
  results: QueryResult[];
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  metadata: {
    query: string;
    projectId: string;
    options: any;
    resultCount: number;
  };
}

@injectable()
export class QueryCache {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    this.startCleanupTask();
  }

  async get(request: QueryRequest): Promise<QueryResult[] | null> {
    const key = this.generateCacheKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.logger.debug('Cache entry expired', { key });
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.logger.debug('Cache hit', { 
      key, 
      accessCount: entry.accessCount,
      resultCount: entry.results.length 
    });

    return entry.results;
  }

  async set(request: QueryRequest, results: QueryResult[]): Promise<void> {
    const key = this.generateCacheKey(request);
    const config = this.configService.get('cache') || {};
    
    const ttl = config.ttl || 300000; // 5 minutes default
    const maxEntries = config.maxEntries || 1000;

    // Check cache size limit
    if (this.cache.size >= maxEntries) {
      await this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry = {
      key,
      results,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      metadata: {
        query: request.query,
        projectId: request.projectId,
        options: request.options,
        resultCount: results.length
      }
    };

    this.cache.set(key, entry);

    this.logger.debug('Cache entry created', { 
      key, 
      ttl,
      resultCount: results.length 
    });
  }

  async invalidate(request: QueryRequest): Promise<void> {
    const key = this.generateCacheKey(request);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.logger.debug('Cache entry invalidated', { key });
    }
  }

  async invalidateByProject(projectId: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.projectId === projectId) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    this.logger.info('Cache entries invalidated by project', { 
      projectId, 
      count: keysToDelete.length 
    });
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    
    this.logger.info('Cache cleared', { size });
  }

  async getStats(): Promise<{
    totalEntries: number;
    hitRate: number;
    missRate: number;
    averageTtl: number;
    memoryUsage: number;
    topQueries: Array<{
      query: string;
      accessCount: number;
      lastAccessed: number;
    }>;
  }> {
    const totalEntries = this.cache.size;
    const now = Date.now();
    
    let totalHits = 0;
    let totalMisses = 0;
    let totalTtl = 0;
    let memoryUsage = 0;

    const topQueries: Array<{
      query: string;
      accessCount: number;
      lastAccessed: number;
    }> = [];

    for (const entry of this.cache.values()) {
      totalHits += entry.accessCount - 1; // Subtract initial creation
      totalTtl += entry.ttl;
      
      // Estimate memory usage
      memoryUsage += JSON.stringify(entry).length;
      
      // Collect top queries
      if (entry.accessCount > 1) {
        topQueries.push({
          query: entry.metadata.query,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed
        });
      }
    }

    // Sort by access count and limit top 10
    topQueries.sort((a, b) => b.accessCount - a.accessCount);
    topQueries.splice(10);

    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const missRate = totalRequests > 0 ? totalMisses / totalRequests : 0;
    const averageTtl = totalEntries > 0 ? totalTtl / totalEntries : 0;

    return {
      totalEntries,
      hitRate,
      missRate,
      averageTtl,
      memoryUsage,
      topQueries
    };
  }

  async preloadCache(queries: QueryRequest[], results: QueryResult[][]): Promise<void> {
    this.logger.info('Preloading cache', { queryCount: queries.length });

    for (let i = 0; i < queries.length; i++) {
      try {
        await this.set(queries[i], results[i]);
      } catch (error) {
        this.logger.warn('Failed to preload cache entry', { 
          index: i, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    this.logger.info('Cache preloading completed', { 
      successCount: queries.length 
    });
  }

  private generateCacheKey(request: QueryRequest): string {
    const normalizedQuery = request.query.toLowerCase().trim();
    const optionsHash = this.hashOptions(request.options || {});
    return `${request.projectId}:${normalizedQuery}:${optionsHash}`;
  }

  private hashOptions(options: any): string {
    const sortedOptions = JSON.stringify(options, Object.keys(options).sort());
    let hash = 0;
    for (let i = 0; i < sortedOptions.length; i++) {
      const char = sortedOptions.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.logger.debug('Evicted LRU cache entry', { key: lruKey });
    }
  }

  private startCleanupTask(): void {
    const config = this.configService.get('cache') || {};
    const cleanupInterval = config.cleanupInterval || 60000; // 1 minute

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, cleanupInterval);

    this.logger.info('Cache cleanup task started', { interval: cleanupInterval });
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      this.logger.debug('Cleaned up expired cache entries', { 
        count: expiredKeys.length 
      });
    }
  }

  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Cache cleanup task stopped');
    }
  }

  async exportCache(): Promise<string> {
    const cacheData = {
      exportedAt: new Date().toISOString(),
      entries: Array.from(this.cache.entries()),
      stats: await this.getStats()
    };

    return JSON.stringify(cacheData, null, 2);
  }

  async importCache(cacheData: string): Promise<void> {
    try {
      const data = JSON.parse(cacheData);
      
      this.cache.clear();
      
      for (const [key, entry] of data.entries) {
        // Convert timestamp back to number if it was stringified
        const normalizedEntry: CacheEntry = {
          ...entry,
          timestamp: Number(entry.timestamp),
          ttl: Number(entry.ttl),
          accessCount: Number(entry.accessCount),
          lastAccessed: Number(entry.lastAccessed)
        };
        
        this.cache.set(key, normalizedEntry);
      }

      this.logger.info('Cache imported successfully', { 
        entryCount: data.entries.length 
      });

    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to import cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QueryCache', operation: 'importCache' }
      );
      throw error;
    }
  }
}