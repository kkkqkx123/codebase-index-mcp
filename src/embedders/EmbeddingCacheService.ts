import { injectable } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { EmbeddingResult } from './BaseEmbedder';

interface CacheEntry {
  result: EmbeddingResult;
  timestamp: number;
  expiry: number;
}

@injectable()
export class EmbeddingCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private logger: LoggerService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    configService: ConfigService,
    logger: LoggerService
  ) {
    this.logger = logger;
    
    // Get cache configuration
    const cachingConfig = configService.get('caching');
    const cacheConfig = configService.get('cache');
    
    // Get configuration values from either config structure
    this.maxSize = cachingConfig?.maxSize || cacheConfig?.maxEntries || 1000;
    this.defaultTTL = (cachingConfig?.defaultTTL || cacheConfig?.ttl || 300) * 1000; // Convert to milliseconds
    
    // Start cleanup interval
    const cleanupInterval = cacheConfig?.cleanupInterval ? cacheConfig.cleanupInterval * 1000 : 60000; // Default to 1 minute
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupInterval);
    // Ensure interval doesn't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
 }

  /**
   * Generate a cache key for the given text and model
   */
  private generateKey(text: string, model: string): string {
    return `${model}:${text}`;
  }

  /**
   * Get cached embedding result
   */
  get(text: string, model: string): EmbeddingResult | null {
    const key = this.generateKey(text, model);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    this.logger.debug('Cache hit', { key });
    return entry.result;
  }

 /**
   * Set embedding result in cache
   */
  set(text: string, model: string, result: EmbeddingResult): void {
    // Check if cache is at maximum size
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    const key = this.generateKey(text, model);
    const timestamp = Date.now();
    const expiry = timestamp + this.defaultTTL;
    
    this.cache.set(key, {
      result,
      timestamp,
      expiry
    });
    
    this.logger.debug('Cache set', { key, expiry });
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.logger.debug(`Cache cleanup removed ${removedCount} expired entries`);
    }
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; defaultTTL: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL
    };
  }
}