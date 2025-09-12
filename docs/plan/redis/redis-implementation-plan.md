# Redis集成实施规划文档

## 概述
本文档详细规划了将Redis集成到代码库索引系统中的具体实施步骤，专为**个人使用场景**设计，确保最小侵入性和最大实用性。

## 架构设计

### 缓存层级结构
```
┌─────────────────────────────────────────┐
│           应用层 (Application)          │
├─────────────────────────────────────────┤
│         缓存抽象层 (Cache Layer)        │
│  ┌─────────────────────────────────────┐ │
│  │  L1: 内存缓存 (Map/LRUCache)        │ │
│  │  L2: Redis缓存 (分布式)             │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│         存储层 (Storage)                │
│  ┌─────────────────────────────────────┐ │
│  │  Qdrant向量数据库                   │ │
│  │  Nebula图数据库                   │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 实施阶段规划

### 阶段1：基础设施准备 (1天)

#### 1.1 依赖安装
```bash
# 安装Redis客户端
npm install redis ioredis
npm install --save-dev @types/redis

# 安装缓存抽象库
npm install cache-manager cache-manager-ioredis
```

#### 1.2 环境配置更新

**新增配置文件：**
```typescript
// src/config/RedisConfig.ts
export interface RedisConfig {
  enabled: boolean;
  url: string;
  maxmemory: string;
  ttl: {
    embedding: number;    // 24小时
    search: number;       // 1小时
    graph: number;        // 30分钟
    progress: number;     // 5分钟
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
```

**更新ConfigService：**
```typescript
// 在ConfigService中添加Redis配置验证
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

### 阶段2：缓存抽象层实现 (2天)

#### 2.1 创建缓存接口
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
```

#### 2.2 实现多级缓存
```typescript
// src/services/cache/MultiLevelCache.ts
import { CacheInterface, CacheStats } from './CacheInterface';
import { Redis } from 'ioredis';

export class MultiLevelCache<T> implements CacheInterface<T> {
  private memoryCache: Map<string, { value: T; expiry: number }>;
  private redisClient?: Redis;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };

  constructor(
    private redisConfig: RedisConfig,
    private logger: LoggerService
  ) {
    this.memoryCache = new Map();
    if (redisConfig.enabled) {
      this.redisClient = new Redis(redisConfig.url);
    }
  }

  async get(key: string): Promise<T | null> {
    // L1: 内存缓存
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expiry > Date.now()) {
      this.stats.hits++;
      return memoryEntry.value;
    }

    // L2: Redis缓存
    if (this.redisClient) {
      try {
        const redisValue = await this.redisClient.get(key);
        if (redisValue) {
          const parsed = JSON.parse(redisValue);
          // 回填到L1缓存
          this.memoryCache.set(key, { 
            value: parsed, 
            expiry: Date.now() + 300000 // 5分钟
          });
          this.stats.hits++;
          return parsed;
        }
      } catch (error) {
        this.logger.warn('Redis get error', { key, error });
      }
    }

    this.stats.misses++;
    return null;
  }

  async set(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiry = Date.now() + (ttl * 1000);
    
    // L1: 内存缓存
    this.memoryCache.set(key, { value, expiry });
    
    // L2: Redis缓存
    if (this.redisClient) {
      try {
        await this.redisClient.setex(key, ttl, JSON.stringify(value));
      } catch (error) {
        this.logger.warn('Redis set error', { key, error });
      }
    }

    // 清理过期内存缓存
    this.cleanupMemoryCache();
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiry < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}
```

### 阶段3：现有缓存服务迁移 (3天)

#### 3.1 嵌入向量缓存迁移

**修改EmbeddingCacheService：**
```typescript
// src/services/cache/EmbeddingCacheService.ts
import { MultiLevelCache } from './MultiLevelCache';
import { EmbeddingResult } from '../../embedders/BaseEmbedder';

export class EmbeddingCacheService {
  private cache: MultiLevelCache<EmbeddingResult>;

  constructor(configService: ConfigService, logger: LoggerService) {
    const redisConfig = configService.get('redis');
    this.cache = new MultiLevelCache<EmbeddingResult>(redisConfig, logger);
  }

  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    const key = `${model}:${text}`;
    return await this.cache.get(key);
  }

  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    const key = `${model}:${text}`;
    const ttl = this.configService.get('redis.ttl.embedding');
    await this.cache.set(key, result, ttl);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }
}
```

#### 3.2 图缓存迁移

**修改GraphCacheService：**
```typescript
// src/services/cache/GraphCacheService.ts
export class GraphCacheService {
  private queryCache: MultiLevelCache<any>;
  private nodeExistenceCache: MultiLevelCache<boolean>;
  private graphStatsCache: MultiLevelCache<any>;

  constructor(logger: LoggerService, config: RedisConfig) {
    this.queryCache = new MultiLevelCache<any>(config, logger);
    this.nodeExistenceCache = new MultiLevelCache<boolean>(config, logger);
    this.graphStatsCache = new MultiLevelCache<any>(config, logger);
  }

  async getFromCache<T>(key: string): Promise<T | null> {
    return await this.queryCache.get(key);
  }

  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheTTL = ttl || this.configService.get('redis.ttl.graph');
    await this.queryCache.set(key, data, cacheTTL);
  }
}
```

#### 3.3 查询缓存迁移

**修改QueryCache：**
```typescript
// src/services/cache/QueryCache.ts
export class QueryCache {
  private cache: MultiLevelCache<QueryResult[]>;

  constructor(configService: ConfigService, logger: LoggerService) {
    const redisConfig = configService.get('redis');
    this.cache = new MultiLevelCache<QueryResult[]>(redisConfig, logger);
  }

  async get(request: QueryRequest): Promise<QueryResult[] | null> {
    const key = this.generateCacheKey(request);
    return await this.cache.get(key);
  }

  async set(request: QueryRequest, results: QueryResult[]): Promise<void> {
    const key = this.generateCacheKey(request);
    const ttl = this.configService.get('redis.ttl.search');
    await this.cache.set(key, results, ttl);
  }
}
```

### 阶段4：任务状态持久化 (2天)

#### 4.1 创建任务状态管理器
```typescript
// src/services/processing/TaskStateManager.ts
export interface TaskState {
  taskId: string;
  projectId: string;
  type: 'indexing' | 'analysis' | 'search';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
    startTime: Date;
    lastUpdate: Date;
  };
  metadata: Record<string, any>;
}

export class TaskStateManager {
  private redis: Redis;
  private logger: LoggerService;

  constructor(redisConfig: RedisConfig, logger: LoggerService) {
    if (redisConfig.enabled) {
      this.redis = new Redis(redisConfig.url);
    }
  }

  async saveTaskState(state: TaskState): Promise<void> {
    if (!this.redis) return;
    
    const key = `task:${state.projectId}:${state.taskId}`;
    await this.redis.setex(key, 86400, JSON.stringify(state)); // 24小时TTL
  }

  async getTaskState(projectId: string, taskId: string): Promise<TaskState | null> {
    if (!this.redis) return null;
    
    const key = `task:${projectId}:${taskId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async listActiveTasks(projectId: string): Promise<TaskState[]> {
    if (!this.redis) return [];
    
    const pattern = `task:${projectId}:*`;
    const keys = await this.redis.keys(pattern);
    const tasks: TaskState[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        tasks.push(JSON.parse(data));
      }
    }
    
    return tasks.filter(task => task.status === 'running');
  }
}
```

#### 4.2 集成到现有服务
```typescript
// 在IndexingService中集成
export class IndexingService {
  private taskManager: TaskStateManager;

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
      // 处理文件...
      for (let i = 0; i < files.length; i++) {
        // 更新进度
        await this.updateTaskProgress(taskId, projectId, i + 1);
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
          startTime: new Date(),
          lastUpdate: new Date()
        },
        metadata: { files }
      });
    } catch (error) {
      // 标记失败
      await this.taskManager.saveTaskState({
        taskId,
        projectId,
        type: 'indexing',
        status: 'failed',
        progress: {
          total: files.length,
          processed: 0,
          failed: files.length,
          startTime: new Date(),
          lastUpdate: new Date()
        },
        metadata: { error: error.message }
      });
      throw error;
    }
  }
}
```

### 阶段5：配置和部署 (1天)

#### 5.1 Docker配置
```yaml
# docker-compose.redis.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

#### 5.2 配置文件更新
```typescript
// .env.example 添加
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_MAXMEMORY=256mb
REDIS_TTL_EMBEDDING=86400
REDIS_TTL_SEARCH=3600
REDIS_TTL_GRAPH=1800
REDIS_TTL_PROGRESS=300
```

#### 5.3 启动脚本
```bash
#!/bin/bash
# scripts/start-with-redis.sh

echo "启动Redis服务..."
docker-compose -f docker-compose.redis.yml up -d

echo "等待Redis启动..."
sleep 3

echo "测试Redis连接..."
redis-cli ping

echo "启动应用..."
npm run dev
```

## 代码修改清单

### 新增文件
1. `src/services/cache/CacheInterface.ts` - 缓存接口定义
2. `src/services/cache/MultiLevelCache.ts` - 多级缓存实现
3. `src/services/cache/RedisCache.ts` - Redis缓存实现
4. `src/services/processing/TaskStateManager.ts` - 任务状态管理
5. `src/config/RedisConfig.ts` - Redis配置类型
6. `docker-compose.redis.yml` - Docker配置

### 修改文件
1. `src/config/ConfigService.ts` - 添加Redis配置验证
2. `src/config/ConfigTypes.ts` - 添加Redis配置类型
3. `src/embedders/EmbeddingCacheService.ts` - 迁移到多级缓存
4. `src/services/storage/graph/GraphCacheService.ts` - 迁移到多级缓存
5. `src/services/query/QueryCache.ts` - 迁移到多级缓存
6. `src/inversify.config.ts` - 更新依赖注入配置
7. `.env.example` - 添加Redis环境变量
8. `package.json` - 添加Redis依赖

### 测试文件
1. `src/services/cache/__tests__/MultiLevelCache.test.ts`
2. `src/services/cache/__tests__/RedisCache.test.ts`
3. `src/services/processing/__tests__/TaskStateManager.test.ts`

## 回滚策略

### 紧急回滚
```bash
# 1. 停止Redis服务
docker-compose -f docker-compose.redis.yml down

# 2. 禁用Redis配置
echo "REDIS_ENABLED=false" >> .env.local

# 3. 重启应用
npm run dev
```

### 渐进回滚
1. **配置回滚**：将`REDIS_ENABLED=false`设置为环境变量
2. **功能回滚**：逐步禁用Redis缓存，回退到内存缓存
3. **代码回滚**：使用Git回退到Redis集成前的版本

## 监控和验证

### 验证步骤
1. **连接测试**：`redis-cli ping` 应返回 `PONG`
2. **缓存测试**：检查嵌入向量缓存是否工作
3. **性能测试**：对比启用Redis前后的响应时间
4. **内存测试**：监控Redis内存使用情况

### 监控命令
```bash
# 查看Redis信息
redis-cli info

# 查看内存使用
redis-cli info memory

# 查看键值统计
redis-cli dbsize

# 清空缓存（测试用）
redis-cli FLUSHALL
```

## 时间线

| 阶段 | 任务 | 预估时间 | 状态 |
|------|------|----------|------|
| 阶段1 | 基础设施准备 | 1天 | 待开始 |
| 阶段2 | 缓存抽象层实现 | 2天 | 待开始 |
| 阶段3 | 现有缓存迁移 | 3天 | 待开始 |
| 阶段4 | 任务状态持久化 | 2天 | 待开始 |
| 阶段5 | 配置和部署 | 1天 | 待开始 |
| **总计** | **完整实施** | **9天** | **待开始** |

## 风险评估

### 低风险
- Redis连接失败：自动降级到内存缓存
- 性能下降：可快速禁用Redis
- 配置错误：有完整的配置验证

### 中风险
- 数据迁移：需要仔细测试缓存一致性
- 内存溢出：需要设置合理的内存限制

### 缓解措施
- 全面的单元测试和集成测试
- 渐进式部署和回滚机制
- 详细的监控和日志记录

## 后续优化

### 性能优化
1. **缓存预热**：启动时加载常用数据
2. **缓存分片**：按项目ID分片存储
3. **压缩存储**：使用MessagePack压缩大对象

### 功能扩展
1. **缓存分析**：提供缓存命中率分析
2. **智能TTL**：根据访问频率动态调整TTL
3. **分布式锁**：防止并发写入冲突

本规划文档为Redis集成提供了完整的技术路径，确保个人使用场景下的简单性和可靠性。