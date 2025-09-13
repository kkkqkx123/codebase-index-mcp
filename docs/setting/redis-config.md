# Redis配置指南

## 概述
本项目使用Redis作为缓存后端，支持内存限制配置，确保不会占用过多系统资源。

## 环境变量配置

### 基本Redis配置
在 `.env` 文件中配置以下参数：

```bash
# Redis启用开关
REDIS_ENABLED=true

# Redis连接URL
REDIS_URL=redis://localhost:6379

# 内存限制配置
REDIS_MAXMEMORY=128mb

# 多级缓存开关
REDIS_USE_MULTI_LEVEL=true

# TTL配置（秒）
REDIS_TTL_EMBEDDING=86400    # 24小时
REDIS_TTL_SEARCH=3600        # 1小时
REDIS_TTL_GRAPH=1800         # 30分钟
REDIS_TTL_PROGRESS=300       # 5分钟

# 重试配置
REDIS_RETRY_ATTEMPTS=3
REDIS_RETRY_DELAY=1000

# 连接池配置
REDIS_POOL_MIN=1
REDIS_POOL_MAX=5
```

### 内存限制选项
- `64mb` - 适合小型项目
- `128mb` - 推荐默认值
- `256mb` - 适合中型项目
- `512mb` - 适合大型项目

## 内存管理

### 自动配置
项目启动时会自动配置Redis：
- 设置内存限制（由REDIS_MAXMEMORY指定）
- 设置内存淘汰策略为`allkeys-lru`（最近最少使用）
- 记录配置信息到日志

### 内存淘汰策略
当内存达到限制时，Redis会自动删除最近最少使用的键。

## 监控工具

### 查看Redis信息
```bash
node scripts/redis-info.js
```

### 测试Redis配置
```bash
node scripts/test-redis-memory.js
```

### 简单缓存测试
```bash
node scripts/test-cache-simple.js
```

## 使用场景

### 开发环境
```bash
REDIS_ENABLED=true
REDIS_MAXMEMORY=64mb
REDIS_USE_MULTI_LEVEL=true
```

### 生产环境
```bash
REDIS_ENABLED=true
REDIS_MAXMEMORY=256mb
REDIS_USE_MULTI_LEVEL=true
```

### 禁用Redis
```bash
REDIS_ENABLED=false
```

## 故障排除

### 常见问题

1. **连接失败**
   - 确保Redis服务已启动
   - 检查连接URL是否正确
   - 验证防火墙设置

2. **内存配置不生效**
   - 检查Redis是否有CONFIG权限
   - 验证配置文件格式

3. **内存使用过高**
   - 降低REDIS_MAXMEMORY值
   - 调整TTL设置
   - 考虑使用多级缓存

### 查看当前配置
```bash
# 连接到Redis
redis-cli

# 查看内存配置
CONFIG GET maxmemory
CONFIG GET maxmemory-policy

# 查看内存使用
INFO memory
```

## 最佳实践

1. **合理设置内存限制**
   - 根据项目规模选择适当的内存限制
   - 监控实际使用情况并调整

2. **使用多级缓存**
   - 启用REDIS_USE_MULTI_LEVEL减少Redis压力
   - 内存缓存作为L1，Redis作为L2

3. **合理设置TTL**
   - 嵌入向量缓存：24小时
   - 搜索结果缓存：1小时
   - 图数据缓存：30分钟
   - 任务进度：5分钟

4. **监控和调优**
   - 定期检查内存使用情况
   - 根据实际需求调整配置
   - 使用提供的监控工具