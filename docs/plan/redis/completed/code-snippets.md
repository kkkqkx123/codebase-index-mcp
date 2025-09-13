# Redis集成代码片段

## 1. 缓存接口定义

### CacheInterface.ts
```typescript
// src/services/cache/CacheInterface.ts
export interface CacheInterface<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  getStats(): Promise<CacheStats>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryUsage?: number;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  compression?: boolean;
}
```

## 2. 多级缓存实现

### MultiLevelCache.ts
```typescript
// src/services/cache/MultiLevelCache.ts
import { Redis } from 'ioredis';
import { CacheInterface, CacheStats } from './CacheInterface';
import { LoggerService } from '../logger/LoggerService';

export class MultiLevelCache<T> implements CacheInterface<T> {
  private memoryCache = new Map<string, { value: T; expiry: number }>();
  private redis?: Redis;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private readonly memoryTTL = 300000; // 5分钟

  constructor(
    private config: { enabled: boolean; url: string },
    private logger: LoggerService,
    private prefix = 'cache'
  ) {
    if (config.enabled) {
      this.redis = new Redis(config.url, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error', { error: error.message });
      });

      this.redis.on('connect', () => {
        this.logger.info('Redis connected successfully');
      });
    }
  }

  async get(key: string): Promise<T | null> {
    const fullKey = `${this.prefix}:${key}`;
    
    // L1: 内存缓存
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && memoryEntry.expiry > Date.now()) {
      this.stats.hits++;
      return memoryEntry.value;
    }

    // L2: Redis缓存
    if (this.redis) {
      try {
        const redisValue = await this.redis.get(fullKey);
        if (redisValue) {
          const parsed = JSON.parse(redisValue);
          // 回填到L1缓存
          this.memoryCache.set(fullKey, { 
            value: parsed, 
            expiry: Date.now() + this.memoryTTL
          });
          this.stats.hits++;
          return parsed;
        }
      } catch (error) {
        this.logger.warn('Redis get error', { key: fullKey, error });
      }
    }

    this.stats.misses++;
    return null;
  }

  async set(key: string, value: T, ttl: number = 3600): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    const expiry = Date.now() + (ttl * 1000);
    
    // L1: 内存缓存
    this.memoryCache.set(fullKey, { value, expiry });
    
    // L2: Redis缓存
    if (this.redis) {
      try {
        await this.redis.setex(fullKey, ttl, JSON.stringify(value));
      } catch (error) {
        this.logger.warn('Redis set error', { key: fullKey, error });
      }
    }

    this.cleanupMemoryCache();
  }

  async del(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    this.memoryCache.delete(fullKey);
    
    if (this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch (error) {
        this.logger.warn('Redis del error', { key: fullKey, error });
      }
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        this.logger.warn('Redis clear error', { error });
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = `${this.prefix}:${key}`;
    
    // 检查内存缓存
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && memoryEntry.expiry > Date.now()) {
      return true;
    }

    // 检查Redis
    if (this.redis) {
      try {
        const exists = await this.redis.exists(fullKey);
        return exists === 1;
      } catch (error) {
        this.logger.warn('Redis exists error', { key: fullKey, error });
        return false;
      }
    }

    return false;
  }

  async getStats(): Promise<CacheStats> {
    const redisSize = await this.getRedisSize();
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.memoryCache.size + redisSize,
      memoryUsage: this.memoryCache.size * 100 // 估算内存使用
    };
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry < now) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async getRedisSize(): Promise<number> {
    if (!this.redis) return 0;
    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      return keys.length;
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
```

## 3. 嵌入缓存服务迁移

### EmbeddingCacheService.ts
```typescript
// src/embedders/EmbeddingCacheService.ts
import { inject, injectable } from 'inversify';
import { TYPES } from '../di/TYPES';
import { MultiLevelCache } from '../services/cache/MultiLevelCache';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../services/logger/LoggerService';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  text: string;
  dimension: number;
  timestamp: number;
}

@injectable()
export class EmbeddingCacheService {
  private cache: MultiLevelCache<EmbeddingResult>;

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    const redisConfig = this.configService.get('redis');
    this.cache = new MultiLevelCache<EmbeddingResult>(
      redisConfig,
      logger,
      'embedding'
    );
  }

  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    const key = this.generateCacheKey(text, model);
    return await this.cache.get(key);
  }

  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    const key = this.generateCacheKey(text, model);
    const ttl = this.configService.get('redis.ttl.embedding');
    await this.cache.set(key, result, ttl);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }

  async getStats(): Promise<any> {
    return await this.cache.getStats();
  }

  private generateCacheKey(text: string, model: string): string {
    const hash = require('crypto').createHash('md5').update(text).digest('hex');
    return `${model}:${hash}`;
  }
}
```

## 4. 图缓存服务迁移

### GraphCacheService.ts
```typescript
// src/services/storage/graph/GraphCacheService.ts
import { MultiLevelCache } from '../../cache/MultiLevelCache';

export interface GraphQueryResult {
  nodes: any[];
  edges: any[];
  metadata: any;
}

export class GraphCacheService {
  private queryCache: MultiLevelCache<GraphQueryResult>;
  private nodeExistenceCache: MultiLevelCache<boolean>;
  private graphStatsCache: MultiLevelCache<any>;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService
  ) {
    const redisConfig = this.configService.get('redis');
    
    this.queryCache = new MultiLevelCache<GraphQueryResult>(
      redisConfig,
      logger,
      'graph:query'
    );
    
    this.nodeExistenceCache = new MultiLevelCache<boolean>(
      redisConfig,
      logger,
      'graph:node'
    );
    
    this.graphStatsCache = new MultiLevelCache<any>(
      redisConfig,
      logger,
      'graph:stats'
    );
  }

  async cacheQuery(query: string, result: GraphQueryResult): Promise<void> {
    const key = this.hashQuery(query);
    const ttl = this.configService.get('redis.ttl.graph');
    await this.queryCache.set(key, result, ttl);
  }

  async getCachedQuery(query: string): Promise<GraphQueryResult | null> {
    const key = this.hashQuery(query);
    return await this.queryCache.get(key);
  }

  async cacheNodeExistence(nodeId: string, exists: boolean): Promise<void> {
    const ttl = this.configService.get('redis.ttl.graph');
    await this.nodeExistenceCache.set(nodeId, exists, ttl);
  }

  async checkNodeExistence(nodeId: string): Promise<boolean | null> {
    const result = await this.nodeExistenceCache.get(nodeId);
    return result !== null ? result : null;
  }

  async cacheGraphStats(projectId: string, stats: any): Promise<void> {
    const ttl = this.configService.get('redis.ttl.graph');
    await this.graphStatsCache.set(projectId, stats, ttl);
  }

  async getGraphStats(projectId: string): Promise<any | null> {
    return await this.graphStatsCache.get(projectId);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.queryCache.clear(),
      this.nodeExistenceCache.clear(),
      this.graphStatsCache.clear()
    ]);
  }

  private hashQuery(query: string): string {
    return require('crypto').createHash('sha256').update(query).digest('hex');
  }
}
```

## 5. 任务状态管理器

### TaskStateManager.ts
```typescript
// src/services/processing/TaskStateManager.ts
import { Redis } from 'ioredis';

export interface TaskProgress {
  total: number;
  processed: number;
  failed: number;
  startTime: Date;
  lastUpdate: Date;
  estimatedCompletion?: Date;
}

export interface TaskState {
  taskId: string;
  projectId: string;
  type: 'indexing' | 'analysis' | 'embedding' | 'search';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: TaskProgress;
  metadata: Record<string, any>;
  error?: string;
}

export class TaskStateManager {
  private redis?: Redis;
  private readonly prefix = 'task';

  constructor(
    private config: { enabled: boolean; url: string },
    private logger: LoggerService
  ) {
    if (config.enabled) {
      this.redis = new Redis(config.url, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (error) => {
        this.logger.error('Task Redis connection error', { error: error.message });
      });
    }
  }

  async saveTaskState(state: TaskState): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${this.prefix}:${state.projectId}:${state.taskId}`;
      const ttl = this.getTTLForTaskType(state.type);
      
      await this.redis.setex(key, ttl, JSON.stringify({
        ...state,
        progress: {
          ...state.progress,
          startTime: state.progress.startTime.toISOString(),
          lastUpdate: state.progress.lastUpdate.toISOString(),
          estimatedCompletion: state.progress.estimatedCompletion?.toISOString()
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to save task state', { error, taskId: state.taskId });
    }
  }

  async getTaskState(projectId: string, taskId: string): Promise<TaskState | null> {
    if (!this.redis) return null;

    try {
      const key = `${this.prefix}:${projectId}:${taskId}`;
      const data = await this.redis.get(key);
      
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        progress: {
          ...parsed.progress,
          startTime: new Date(parsed.progress.startTime),
          lastUpdate: new Date(parsed.progress.lastUpdate),
          estimatedCompletion: parsed.progress.estimatedCompletion ? 
            new Date(parsed.progress.estimatedCompletion) : undefined
        }
      };
    } catch (error) {
      this.logger.warn('Failed to get task state', { error, taskId });
      return null;
    }
  }

  async listActiveTasks(projectId: string): Promise<TaskState[]> {
    if (!this.redis) return [];

    try {
      const pattern = `${this.prefix}:${projectId}:*`;
      const keys = await this.redis.keys(pattern);
      const tasks: TaskState[] = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const task = JSON.parse(data);
          if (['running', 'pending'].includes(task.status)) {
            tasks.push({
              ...task,
              progress: {
                ...task.progress,
                startTime: new Date(task.progress.startTime),
                lastUpdate: new Date(task.progress.lastUpdate)
              }
            });
          }
        }
      }
      
      return tasks.sort((a, b) => 
        new Date(b.progress.startTime).getTime() - new Date(a.progress.startTime).getTime()
      );
    } catch (error) {
      this.logger.warn('Failed to list active tasks', { error, projectId });
      return [];
    }
  }

  async deleteTaskState(projectId: string, taskId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${this.prefix}:${projectId}:${taskId}`;
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn('Failed to delete task state', { error, taskId });
    }
  }

  async cleanupCompletedTasks(projectId: string, olderThanHours: number = 24): Promise<number> {
    if (!this.redis) return 0;

    try {
      const pattern = `${this.prefix}:${projectId}:*`;
      const keys = await this.redis.keys(pattern);
      let deleted = 0;
      
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const task = JSON.parse(data);
          if (['completed', 'failed', 'cancelled'].includes(task.status)) {
            const taskTime = new Date(task.progress.lastUpdate).getTime();
            if (taskTime < cutoffTime) {
              await this.redis.del(key);
              deleted++;
            }
          }
        }
      }
      
      return deleted;
    } catch (error) {
      this.logger.warn('Failed to cleanup completed tasks', { error, projectId });
      return 0;
    }
  }

  private getTTLForTaskType(type: string): number {
    const ttlMap = {
      indexing: 86400,    // 24小时
      analysis: 3600,     // 1小时
      embedding: 7200,    // 2小时
      search: 1800        // 30分钟
    };
    return ttlMap[type] || 3600;
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
```

## 6. 配置更新

### RedisConfig.ts
```typescript
// src/config/RedisConfig.ts
export interface RedisConfig {
  enabled: boolean;
  url: string;
  maxmemory?: string;
  ttl: {
    embedding: number;    // 嵌入向量缓存TTL（秒）
    search: number;       // 搜索结果缓存TTL
    graph: number;        // 图数据缓存TTL
    progress: number;     // 任务进度TTL
  };
  retry: {
    attempts: number;
    delay: number;
  };
  pool: {
    min: number;
    max: number;
  };
}

export const defaultRedisConfig: RedisConfig = {
  enabled: false,
  url: 'redis://localhost:6379',
  maxmemory: '256mb',
  ttl: {
    embedding: 86400,  // 24小时
    search: 3600,      // 1小时
    graph: 1800,       // 30分钟
    progress: 300      // 5分钟
  },
  retry: {
    attempts: 3,
    delay: 1000
  },
  pool: {
    min: 1,
    max: 10
  }
};
```

### ConfigService.ts 更新
```typescript
// 添加到ConfigService的schema中
redis: Joi.object({
  enabled: Joi.boolean().default(false),
  url: Joi.string().uri().default('redis://localhost:6379'),
  maxmemory: Joi.string().default('256mb'),
  ttl: Joi.object({
    embedding: Joi.number().default(86400),
    search: Joi.number().default(3600),
    graph: Joi.number().default(1800),
    progress: Joi.number().default(300)
  }),
  retry: Joi.object({
    attempts: Joi.number().default(3),
    delay: Joi.number().default(1000)
  }),
  pool: Joi.object({
    min: Joi.number().default(1),
    max: Joi.number().default(10)
  })
})
```

## 7. Docker配置

### docker-compose.redis.yml
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: codebase-index-redis
    ports:
      - "6379:6379"
    command: >
      redis-server 
      --maxmemory 256mb 
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
      --appendonly yes
      --appendfsync everysec
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
    driver: local
```

## 8. 使用示例

### 在Embedder中使用
```typescript
// 在OpenAIEmbedder中使用缓存
export class OpenAIEmbedder extends BaseEmbedder {
  constructor(
    private cacheService: EmbeddingCacheService,
    private config: ConfigService
  ) {
    super();
  }

  async embed(text: string): Promise<number[]> {
    const model = this.config.get('embedding.model');
    
    // 检查缓存
    const cached = await this.cacheService.get(text, model);
    if (cached) {
      return cached.embedding;
    }

    // 生成新的嵌入
    const embedding = await this.generateEmbedding(text);
    
    // 保存到缓存
    await this.cacheService.set(text, model, {
      embedding,
      model,
      text,
      dimension: embedding.length,
      timestamp: Date.now()
    });

    return embedding;
  }
}
```

### 在IndexingService中使用任务状态
```typescript
export class IndexingService {
  constructor(private taskManager: TaskStateManager) {}

  async indexProject(projectId: string, files: string[]): Promise<void> {
    const taskId = `index_${projectId}_${Date.now()}`;
    
    // 保存初始状态
    await this.taskManager.saveTaskState({
      taskId,
      projectId,
      type: 'indexing',
      status: 'running',
      progress: {
        total: files.length,
        processed: 0,
        failed: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      },
      metadata: { files }
    });

    try {
      for (let i = 0; i < files.length; i++) {
        await this.processFile(files[i]);
        
        // 更新进度
        await this.taskManager.saveTaskState({
          taskId,
          projectId,
          type: 'indexing',
          status: 'running',
          progress: {
            total: files.length,
            processed: i + 1,
            failed: 0,
            startTime: new Date(files[0].startTime), // 保持原始时间
            lastUpdate: new Date()
          },
          metadata: { files }
        });
      }

      // 标记完成
      await this.taskManager.saveTaskState({
        taskId,
        projectId,
        type: 'indexing',
        status: 'completed',
        progress: {
          total: files.length,
          processed: files.length,
          failed: 0,
          startTime: new Date(files[0].startTime),
          lastUpdate: new Date()
        },
        metadata: { files }
      });
    } catch (error) {
      await this.taskManager.saveTaskState({
        taskId,
        projectId,
        type: 'indexing',
        status: 'failed',
        progress: {
          total: files.length,
          processed: 0,
          failed: files.length,
          startTime: new Date(files[0].startTime),
          lastUpdate: new Date()
        },
        error: error.message,
        metadata: { files }
      });
      throw error;
    }
  }
}
```

这些代码片段可以直接复制使用，提供了Redis集成的完整实现方案。每个片段都包含了错误处理、性能优化和回退机制，确保在个人使用场景下的稳定性和可靠性。