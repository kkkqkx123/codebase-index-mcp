import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { CacheManager } from '../services/cache/CacheManager';
import { CacheInterface } from '../services/cache/CacheInterface';

export interface CacheStatsResponse {
  name: string;
  stats: any;
  timestamp: Date;
}

export interface CacheHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    redis?: any;
    memory?: any;
  };
  timestamp: Date;
}

@injectable()
export class CacheController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private cacheManager: CacheManager;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.CacheManager) cacheManager: CacheManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.cacheManager = cacheManager;
  }

  /**
   * Get cache statistics for all cache instances
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Getting cache statistics');

      const stats = await this.cacheManager.getAllStats();
      const response: CacheStatsResponse[] = Object.entries(stats).map(([name, stat]) => ({
        name,
        stats: stat,
        timestamp: new Date()
      }));

      res.json({
        success: true,
        data: response,
        timestamp: new Date()
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get cache stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'getStats' }
      );
      next(error);
    }
  }

  /**
   * Get health status of cache system
   */
  async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Getting cache health status');

      const healthData = await this.cacheManager.healthCheck();
      const overallStatus = Object.values(healthData).some(
        (component: any) => component.error || component.status === 'disabled'
      ) ? 'degraded' : 'healthy';

      const response: CacheHealthResponse = {
        status: overallStatus,
        components: healthData,
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date()
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get cache health: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'getHealth' }
      );
      next(error);
    }
  }

  /**
   * Clear specific cache instance
   */
  async clearCache(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cacheName } = req.params;

      if (!cacheName) {
        res.status(400).json({
          success: false,
          error: 'Cache name is required'
        });
        return;
      }

      this.logger.info(`Clearing cache: ${cacheName}`);

      // Get the specific cache instance
      const cache = await this.cacheManager.getCache(cacheName);
      await cache.clear();

      res.json({
        success: true,
        message: `Cache '${cacheName}' cleared successfully`,
        timestamp: new Date()
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'clearCache' }
      );
      next(error);
    }
  }

  /**
   * Clear all cache instances
   */
  async clearAllCaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Clearing all caches');

      await this.cacheManager.clearAll();

      res.json({
        success: true,
        message: 'All caches cleared successfully',
        timestamp: new Date()
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to clear all caches: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'clearAllCaches' }
      );
      next(error);
    }
  }

  /**
   * Get value from specific cache
   */
  async getValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cacheName } = req.params;
      const { key } = req.query;

      if (!cacheName || !key) {
        res.status(400).json({
          success: false,
          error: 'Cache name and key are required'
        });
        return;
      }

      this.logger.info(`Getting value from cache: ${cacheName}, key: ${key}`);

      const cache = await this.cacheManager.getCache(cacheName);
      const value = await cache.get(key as string);

      res.json({
        success: true,
        data: {
          key,
          value,
          found: value !== null,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get cache value: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'getValue' }
      );
      next(error);
    }
  }

  /**
   * Set value in specific cache
   */
  async setValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cacheName } = req.params;
      const { key, value, ttl } = req.body;

      if (!cacheName || !key || value === undefined) {
        res.status(400).json({
          success: false,
          error: 'Cache name, key, and value are required'
        });
        return;
      }

      this.logger.info(`Setting value in cache: ${cacheName}, key: ${key}`);

      const cache = await this.cacheManager.getCache(cacheName);
      const options = ttl ? { ttl: Number(ttl) } : undefined;
      const result = await cache.set(key, value, options);

      res.json({
        success: result,
        message: result ? 'Value set successfully' : 'Failed to set value',
        data: {
          key,
          ttl: ttl || 'default',
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to set cache value: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'setValue' }
      );
      next(error);
    }
  }

  /**
   * Delete key from specific cache
   */
  async deleteKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cacheName } = req.params;
      const { key } = req.query;

      if (!cacheName || !key) {
        res.status(400).json({
          success: false,
          error: 'Cache name and key are required'
        });
        return;
      }

      this.logger.info(`Deleting key from cache: ${cacheName}, key: ${key}`);

      const cache = await this.cacheManager.getCache(cacheName);
      const result = await cache.del(key as string);

      res.json({
        success: result,
        message: result ? 'Key deleted successfully' : 'Key not found or deletion failed',
        data: {
          key,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to delete cache key: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'deleteKey' }
      );
      next(error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async keyExists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cacheName } = req.params;
      const { key } = req.query;

      if (!cacheName || !key) {
        res.status(400).json({
          success: false,
          error: 'Cache name and key are required'
        });
        return;
      }

      this.logger.info(`Checking key existence: ${cacheName}, key: ${key}`);

      const cache = await this.cacheManager.getCache(cacheName);
      const exists = await cache.exists(key as string);

      res.json({
        success: true,
        data: {
          key,
          exists,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check key existence: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'keyExists' }
      );
      next(error);
    }
  }

  /**
   * List available cache instances
   */
  async listCaches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Listing available caches');

      // This is a bit of a hack since CacheManager doesn't expose the cache instances directly
      // We'll return the known cache types
      const knownCaches = [
        { name: 'embedding', description: 'Cache for embedding vectors' },
        { name: 'search', description: 'Cache for search results' },
        { name: 'graph', description: 'Cache for graph operations' },
        { name: 'progress', description: 'Cache for indexing progress' }
      ];

      res.json({
        success: true,
        data: {
          caches: knownCaches,
          count: knownCaches.length,
          timestamp: new Date()
        }
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to list caches: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'CacheController', operation: 'listCaches' }
      );
      next(error);
    }
  }
}