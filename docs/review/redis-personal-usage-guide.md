# Redis个人使用方案指南

## 概述

本方案针对**个人开发者**使用场景，提供轻量级、低成本的Redis集成方案。相比原企业级方案，本方案更注重**简单性**和**资源效率**。

## 个人使用场景特点

- **单机部署**：无需集群配置
- **资源有限**：内存、CPU约束
- **重启频率低**：个人项目通常长时间运行
- **数据量小**：代码库规模有限
- **成本敏感**：倾向于免费/开源方案

## 精简后的Redis需求

### 🔴 必需功能（立即实施）

#### 1. 二级缓存（解决内存瓶颈）
- **目的**：缓解大代码库导致的内存压力
- **实现**：Redis作为L2缓存，内存作为L1缓存
- **配置**：单实例Redis，无需持久化

#### 2. 嵌入向量缓存
- **目的**：避免重复计算代码嵌入向量
- **数据量**：预估100MB-1GB（典型个人项目）
- **TTL**：24小时（平衡内存使用和计算成本）

### 🟡 可选功能（按需实施）

#### 3. 搜索结果缓存
- **目的**：加速重复搜索查询
- **适用场景**：频繁搜索相同关键词
- **配置**：TTL 1小时，最大条目1000

#### 4. 任务进度保存
- **目的**：防止长时间索引任务中断
- **适用场景**：大项目首次索引
- **配置**：每100个文件保存一次进度

### 🔴 可省略功能

- ❌ 实时事件同步（个人使用无需多实例）
- ❌ 集群配置（单机足够）
- ❌ 高可用性配置（个人项目可接受短暂中断）
- ❌ 复杂监控（日志足够）

## 实施方案

### 阶段1：最小可用配置（1天）

#### Docker Compose配置
```yaml
# docker-compose.yml
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

  codebase-index:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./workspace:/app/workspace

volumes:
  redis_data:
```

#### 环境配置
```bash
# .env.local（个人配置）
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
CACHE_TTL_EMBEDDING=86400    # 24小时
CACHE_TTL_SEARCH=3600        # 1小时
```

### 阶段2：优化配置（可选，1周）

#### 内存优化
```yaml
# 针对低内存环境
redis-server \
  --maxmemory 128mb \
  --maxmemory-policy allkeys-lru \
  --save "" \
  --appendonly no
```

#### 本地安装（无Docker）
```bash
# Windows
choco install redis

# macOS
brew install redis

# Linux
sudo apt install redis-server
```

## 资源需求评估

| 项目规模 | 预估内存 | Redis配置 | 说明 |
|---------|----------|-----------|------|
| 小型项目(<1000文件) | 50-100MB | 128MB maxmemory | 本地项目 |
| 中型项目(1000-10000文件) | 200-500MB | 256MB maxmemory | 中等规模 |
| 大型项目(>10000文件) | 500MB-1GB | 512MB maxmemory | 大项目 |

## 成本分析

### 免费方案
- **本地Redis**：0成本，占用本地内存
- **Docker Redis**：0成本，可限制内存使用

### 云端方案（不推荐）
- **Redis Cloud免费版**：30MB，太小
- **AWS ElastiCache**：约$15/月（t3.micro）
- **建议**：个人使用完全不需要云端Redis

## 配置模板

### 个人配置（推荐）
```typescript
// src/config/redis.config.ts
export const redisConfig = {
  personal: {
    enabled: true,
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxmemory: '256mb',
    ttl: {
      embedding: 24 * 3600,    // 24小时
      search: 3600,          // 1小时
      progress: 300          // 5分钟
    }
  }
};
```

### 最小配置（极简）
```typescript
// 仅启用嵌入缓存
export const minimalRedisConfig = {
  enabled: process.env.REDIS_URL !== undefined,
  url: process.env.REDIS_URL,
  cache: {
    embeddings: true,
    search: false,
    progress: false
  }
};
```

## 快速启动指南

### 1. 安装Redis
```bash
# 方式1：Docker（推荐）
docker run -d -p 6379:6379 redis:7-alpine redis-server --maxmemory 256mb

# 方式2：本地安装
# 根据操作系统选择安装方式
```

### 2. 启用Redis
```bash
# 设置环境变量
echo "REDIS_URL=redis://localhost:6379" > .env.local
echo "REDIS_ENABLED=true" >> .env.local

# 启动应用
npm run dev
```

### 3. 验证安装
```bash
# 检查Redis连接
redis-cli ping
# 应该返回: PONG
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查Redis是否运行：`redis-cli ping`
   - 检查端口是否占用：`netstat -an | grep 6379`

2. **内存不足**
   - 降低maxmemory设置
   - 减少缓存TTL时间
   - 禁用非必需缓存

3. **性能问题**
   - 监控Redis内存使用：`redis-cli info memory`
   - 检查缓存命中率：`redis-cli info stats`

### 监控命令
```bash
# 查看Redis信息
redis-cli info

# 查看内存使用
redis-cli info memory

# 查看键值统计
redis-cli dbsize

# 清空缓存（谨慎使用）
redis-cli FLUSHALL
```

## 与原方案对比

| 对比维度 | 个人方案 | 原企业方案 |
|----------|----------|------------|
| **部署复杂度** | 一键启动 | 需要集群配置 |
| **资源需求** | 128-512MB内存 | 2GB+内存 |
| **功能范围** | 核心缓存功能 | 全功能 |
| **维护成本** | 零维护 | 需要监控 |
| **适用场景** | 个人开发者 | 企业级部署 |

## 结论

对于个人使用场景，建议采用**最小可行方案**：
- ✅ **立即实施**：嵌入向量缓存 + 搜索结果缓存
- ⚠️ **按需实施**：任务进度保存（仅大项目需要）
- ❌ **无需实施**：实时同步、集群配置、复杂监控

通过Docker Compose一键部署，5分钟内即可启用Redis支持，显著提升大项目使用体验。