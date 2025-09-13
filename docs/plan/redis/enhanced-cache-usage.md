# 增强版Redis缓存使用指南

## 概述

本文档展示了如何使用增强版的Redis缓存系统，包括多级缓存、监控、错误处理和统计功能。

## 快速开始

### 1. 创建缓存工厂

```typescript
import { EnhancedCacheFactory } from '../src/services/cache/EnhancedCacheFactory';
import { RedisConfig } from '../src/services/cache/RedisConfig';

// 使用环境变量配置
const factory = EnhancedCacheFactory.getInstance(
  EnhancedCacheFactory.getConfigFromEnv()
);

// 或自定义配置
const customConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0
  },
  monitor: {
    enabled: true,
    metricsInterval: 30000, // 30秒
    logLevel: 'info'
  },
  memory: {
    maxSize: 1000,
    ttl: 300, // 5分钟
    cleanupInterval: 60
  }
};

const factory = EnhancedCacheFactory.getInstance(customConfig);
```

### 2. 创建多级缓存

```typescript
// 创建多级缓存（L1: 内存 + L2: Redis）
const cache = factory.createMultiLevelCache('my-app-cache', {
  host: 'localhost',
  port: 6379,
  db: 0
});

// 使用缓存
await cache.set('user:123', { id: 123, name: '张三' }, { ttl: 3600 });
const user = await cache.get('user:123');
```

### 3. 创建不同类型的缓存

```typescript
// 纯Redis缓存
const redisCache = factory.createRedisOnlyCache('redis-cache', redisConfig);

// 纯内存缓存
const memoryCache = factory.createMemoryOnlyCache('memory-cache', {
  maxSize: 500,
  ttl: 600
});
```

## 监控和统计

### 获取缓存统计

```typescript
// 获取单个缓存的统计
const stats = await cache.getStats();
console.log('缓存统计:', {
  name: stats.name,
  hitRate: (stats.combinedStats.hitRate * 100).toFixed(2) + '%',
  totalOperations: stats.combinedStats.totalOperations,
  l1HitRate: (stats.combinedStats.l1HitRate * 100).toFixed(2) + '%',
  l2HitRate: (stats.combinedStats.l2HitRate * 100).toFixed(2) + '%'
});

// 获取所有缓存的统计
const allStats = await factory.getAllCacheStats();
allStats.forEach((stats, name) => {
  console.log(`${name}:`, stats);
});
```

### 缓存层级分析

```typescript
// 获取缓存层级统计
const breakdown = cache.getCacheBreakdown();
console.log('缓存层级分析:', {
  L1命中率: breakdown.l1.hits / (breakdown.l1.hits + breakdown.l1.misses),
  L2命中率: breakdown.l2.hits / (breakdown.l2.hits + breakdown.l2.misses),
  总命中率: breakdown.total.hits / (breakdown.total.hits + breakdown.total.misses)
});
```

### 健康检查

```typescript
// 检查所有缓存的健康状态
const health = await factory.healthCheck();
console.log('健康状态:', health.healthy);

health.details.forEach((status, name) => {
  console.log(`${name}: ${status.healthy ? '健康' : '异常'} - ${status.message || ''}`);
});
```

## 高级功能

### 缓存预热

```typescript
// 预热常用数据到L1缓存
await cache.warmUp([
  'user:1',
  'user:2',
  'user:3',
  'config:app',
  'settings:global'
]);
```

### 内存管理

```typescript
// 只清空L1缓存（内存压力管理）
await cache.clearL1();

// 重置统计信息
cache.resetStats();
```

### 监控集成

```typescript
// 获取监控器
const monitor = factory.getMonitor();

// 监听缓存事件
monitor.on('cache:operation', (event) => {
  console.log('缓存操作:', event);
});

// 设置告警
monitor.on('cache:error', (error) => {
  console.error('缓存错误:', error);
  // 发送告警通知
});
```

## 错误处理

### 错误处理示例

```typescript
try {
  const value = await cache.get('some-key');
  if (value === null) {
    console.log('缓存未命中，从数据库获取...');
    // 从数据库获取数据
    const dbValue = await getFromDatabase('some-key');
    await cache.set('some-key', dbValue, { ttl: 300 });
    return dbValue;
  }
  return value;
} catch (error) {
  console.error('缓存操作失败:', error);
  // 降级到数据库查询
  return await getFromDatabase('some-key');
}
```

### 重试机制

```typescript
// 增强版Redis缓存已内置重试机制
// 可在RedisConfig中配置：
const redisConfig: RedisConfig = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true
};
```

## 配置示例

### 环境变量配置

```bash
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100

# 监控配置
CACHE_MONITOR_ENABLED=true
CACHE_METRICS_INTERVAL=30000
CACHE_LOG_LEVEL=info

# 内存缓存配置
CACHE_MEMORY_MAX_SIZE=1000
CACHE_MEMORY_TTL=300
CACHE_MEMORY_CLEANUP_INTERVAL=60
```

### TypeScript配置

```typescript
// 在应用中配置缓存
import { EnhancedCacheFactory } from '../services/cache/EnhancedCacheFactory';

export class CacheService {
  private static instance: CacheService;
  private factory: EnhancedCacheFactory;
  private userCache: EnhancedMultiLevelCache;
  
  private constructor() {
    this.factory = EnhancedCacheFactory.getInstance();
    
    this.userCache = this.factory.createMultiLevelCache('user-cache', {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT!),
      password: process.env.REDIS_PASSWORD,
      db: 0
    });
  }
  
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  async getUser(userId: string): Promise<User | null> {
    return await this.userCache.get(`user:${userId}`);
  }
  
  async setUser(user: User): Promise<boolean> {
    return await this.userCache.set(`user:${user.id}`, user, { ttl: 3600 });
  }
  
  async getStats() {
    return await this.userCache.getStats();
  }
}
```

## 最佳实践

1. **命名规范**: 使用冒号分隔的命名空间，如 `user:123:profile`
2. **TTL设置**: 根据数据更新频率设置合理的TTL
3. **错误处理**: 始终为缓存操作添加错误处理逻辑
4. **监控**: 定期检查缓存命中率和性能指标
5. **预热**: 在应用启动时预热常用数据
6. **内存管理**: 定期清理过期缓存，避免内存泄漏

## 故障排除

### 常见问题

1. **连接失败**: 检查Redis配置和网络连接
2. **内存溢出**: 调整内存缓存的最大大小
3. **性能下降**: 检查缓存命中率和Redis性能
4. **数据不一致**: 确保TTL设置合理，考虑使用缓存失效策略

### 调试技巧

```typescript
// 开启调试日志
const factory = EnhancedCacheFactory.getInstance({
  monitor: {
    enabled: true,
    logLevel: 'debug'
  }
});

// 查看详细操作日志
const monitor = factory.getMonitor();
const logs = monitor.getOperationLogs('your-cache-name', 100);
console.log('最近的操作日志:', logs);
```