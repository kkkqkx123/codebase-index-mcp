# Redis迁移检查清单

## 迁移前准备

### 环境检查
- [x] 安装Redis 7.x
- [x] 验证Redis连接：`redis-cli ping`
- [ ] 确认Redis配置：maxmemory=256mb, policy=allkeys-lru
- [ ] 备份当前内存缓存数据（可选）

### 依赖安装
```bash
npm install redis ioredis cache-manager cache-manager-ioredis
npm install --save-dev @types/redis @types/cache-manager
```

### 配置验证
- [ ] 创建`.env.local`文件
- [ ] 添加Redis配置参数
- [ ] 验证配置文件格式

## 分步迁移指南

### 第1步：基础配置 (30分钟)

#### 添加Redis配置
```typescript
// 在ConfigService中添加
redis: Joi.object({
  enabled: Joi.boolean().default(false),
  url: Joi.string().uri().default('redis://localhost:6379'),
  maxmemory: Joi.string().default('256mb'),
  ttl: Joi.object({
    embedding: Joi.number().default(86400),
    search: Joi.number().default(3600),
    graph: Joi.number().default(1800),
    progress: Joi.number().default(300)
  })
})
```

#### 环境变量配置
```bash
# .env.local
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
REDIS_TTL_EMBEDDING=86400
REDIS_TTL_SEARCH=3600
REDIS_TTL_GRAPH=1800
REDIS_TTL_PROGRESS=300
```

### 第2步：缓存接口实现 (1小时)

#### 创建缓存抽象层
```typescript
// 创建文件：src/services/cache/CacheInterface.ts
export interface CacheInterface<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  getStats(): Promise<CacheStats>;
}
```

#### 实现多级缓存
```typescript
// 创建文件：src/services/cache/MultiLevelCache.ts
export class MultiLevelCache<T> implements CacheInterface<T> {
  private memoryCache = new Map<string, { value: T; expiry: number }>();
  private redis?: Redis;
  
  constructor(private config: RedisConfig, private logger: LoggerService) {
    if (config.enabled) {
      this.redis = new Redis(config.url);
    }
  }
  
  async get(key: string): Promise<T | null> {
    // 内存缓存优先
    const memory = this.memoryCache.get(key);
    if (memory && memory.expiry > Date.now()) {
      return memory.value;
    }
    
    // Redis作为后备
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          const parsed = JSON.parse(value);
          // 回填内存缓存
          this.memoryCache.set(key, { value: parsed, expiry: Date.now() + 300000 });
          return parsed;
        }
      } catch (error) {
        this.logger.warn('Redis get failed', { key, error });
      }
    }
    
    return null;
  }
}
```

### 第3步：现有服务迁移 (2小时)

#### 嵌入缓存迁移
```typescript
// 修改：src/embedders/EmbeddingCacheService.ts
export class EmbeddingCacheService {
  private cache: MultiLevelCache<EmbeddingResult>;
  
  constructor(configService: ConfigService, logger: LoggerService) {
    const redisConfig = configService.get('redis');
    this.cache = new MultiLevelCache<EmbeddingResult>(redisConfig, logger);
  }
  
  async get(text: string, model: string): Promise<EmbeddingResult | null> {
    const key = `embedding:${model}:${crypto.createHash('md5').update(text).digest('hex')}`;
    return await this.cache.get(key);
  }
  
  async set(text: string, model: string, result: EmbeddingResult): Promise<void> {
    const key = `embedding:${model}:${crypto.createHash('md5').update(text).digest('hex')}`;
    const ttl = this.configService.get('redis.ttl.embedding');
    await this.cache.set(key, result, ttl);
  }
}
```

#### 图缓存迁移
```typescript
// 修改：src/services/storage/graph/GraphCacheService.ts
export class GraphCacheService {
  private queryCache: MultiLevelCache<any>;
  private nodeCache: MultiLevelCache<boolean>;
  
  constructor(configService: ConfigService, logger: LoggerService) {
    const redisConfig = configService.get('redis');
    this.queryCache = new MultiLevelCache<any>(redisConfig, logger);
    this.nodeCache = new MultiLevelCache<boolean>(redisConfig, logger);
  }
}
```

### 第4步：任务状态持久化 (1小时)

#### 创建任务管理器
```typescript
// 创建文件：src/services/processing/TaskStateManager.ts
export class TaskStateManager {
  private redis?: Redis;
  
  constructor(private config: RedisConfig) {
    if (config.enabled) {
      this.redis = new Redis(config.url);
    }
  }
  
  async saveTask(taskId: string, state: TaskState): Promise<void> {
    if (!this.redis) return;
    
    await this.redis.setex(`task:${taskId}`, 86400, JSON.stringify(state));
  }
  
  async getTask(taskId: string): Promise<TaskState | null> {
    if (!this.redis) return null;
    
    const data = await this.redis.get(`task:${taskId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

### 第5步：依赖注入配置 (30分钟)

#### 更新容器配置
```typescript
// 修改：src/inversify.config.ts
container.bind<MultiLevelCache>(TYPES.MultiLevelCache)
  .toDynamicValue((context) => {
    const config = context.container.get<ConfigService>(TYPES.ConfigService);
    const logger = context.container.get<LoggerService>(TYPES.LoggerService);
    return new MultiLevelCache(config.get('redis'), logger);
  })
  .inSingletonScope();
```

## 测试验证

### 单元测试
```typescript
// 创建测试：src/services/cache/__tests__/MultiLevelCache.test.ts
describe('MultiLevelCache', () => {
  let cache: MultiLevelCache<string>;
  
  beforeEach(() => {
    cache = new MultiLevelCache({ enabled: true, url: 'redis://localhost:6379' }, mockLogger);
  });
  
  test('should store and retrieve values', async () => {
    await cache.set('test-key', 'test-value');
    const value = await cache.get('test-key');
    expect(value).toBe('test-value');
  });
  
  test('should fallback to memory when Redis fails', async () => {
    // 模拟Redis连接失败
    cache['redis'] = undefined;
    await cache.set('test-key', 'test-value');
    const value = await cache.get('test-key');
    expect(value).toBe('test-value');
  });
});
```

### 集成测试
```bash
# 启动Redis
docker-compose -f docker-compose.redis.yml up -d

# 运行测试
npm test src/services/cache/__tests__/

# 验证缓存功能
redis-cli keys "*" | wc -l  # 应该显示缓存键数量
```

## 性能对比测试

### 测试场景
1. **嵌入向量缓存**：测试100个不同文本的嵌入缓存
2. **图查询缓存**：测试重复图查询的响应时间
3. **任务状态**：测试任务进度保存和恢复

### 基准测试脚本
```typescript
// 创建：scripts/benchmark-redis.ts
import { performance } from 'perf_hooks';

async function benchmarkCache() {
  const start = performance.now();
  
  // 测试嵌入缓存
  for (let i = 0; i < 100; i++) {
    await embeddingCache.set(`text-${i}`, `model-${i % 3}`, mockEmbedding);
  }
  
  // 测试读取性能
  for (let i = 0; i < 100; i++) {
    await embeddingCache.get(`text-${i}`, `model-${i % 3}`);
  }
  
  const end = performance.now();
  console.log(`Redis缓存测试耗时: ${end - start}ms`);
}

benchmarkCache();
```

## 故障排查

### 常见问题

#### 1. Redis连接失败
```bash
# 检查Redis状态
redis-cli ping

# 检查端口占用
netstat -an | grep 6379

# 重启Redis
docker-compose -f docker-compose.redis.yml restart
```

#### 2. 缓存不生效
```bash
# 检查Redis键值
redis-cli keys "*"
redis-cli get "embedding:model:text-hash"

# 检查配置
node -e "console.log(require('./src/config').get('redis'))"
```

#### 3. 内存使用过高
```bash
# 检查Redis内存
redis-cli info memory

# 调整maxmemory
redis-cli config set maxmemory 128mb
```

#### 4. 缓存穿透
```typescript
// 添加空值缓存
if (result === null) {
  await this.cache.set(key, 'NULL', 60); // 缓存空值1分钟
}
```

## 回滚方案

### 快速回滚
```bash
# 1. 禁用Redis
echo "REDIS_ENABLED=false" >> .env.local

# 2. 重启应用
npm run dev

# 3. 清理Redis（可选）
redis-cli FLUSHALL
```

### 渐进回滚
1. **配置回滚**：逐步减少Redis使用
2. **数据迁移**：导出Redis缓存数据
3. **功能降级**：回退到纯内存缓存

## 验证清单

### 功能验证
- [ ] 嵌入向量缓存正常工作
- [ ] 图查询缓存正常工作
- [ ] 任务状态持久化正常工作
- [ ] 缓存命中率统计正常
- [ ] 内存使用在预期范围内

### 性能验证
- [ ] 重复查询响应时间 < 100ms
- [ ] 嵌入向量缓存命中率 > 80%
- [ ] Redis内存使用 < 256MB
- [ ] 应用启动时间无明显增加

### 稳定性验证
- [ ] Redis重启后缓存自动恢复
- [ ] 网络中断时自动降级
- [ ] 内存不足时自动清理
- [ ] 配置错误时优雅降级

完成所有验证后，Redis迁移即可视为成功完成。