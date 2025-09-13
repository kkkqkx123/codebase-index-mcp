# Redis监控系统集成方案

## 项目背景

当前codebase-index项目已具备完善的缓存系统（EnhancedRedisCacheAdapter），但监控系统主要关注应用层指标，缺少Redis原生监控能力。通过集成Redis Exporter，可以实现从应用层到系统层的全面监控覆盖。

## 现状分析

### 1. 现有监控系统
- **Prometheus**: 已配置采集codebase-index、Qdrant、Nebula等服务
- **Grafana**: 已有codebase-index-dashboard.json提供系统级监控
- **监控范围**: 应用层缓存统计、数据库连接状态、系统资源
- **缺失**: Redis原生性能指标、内存使用、命令统计

### 2. Redis监控能力
- **应用层**: EnhancedRedisCacheAdapter已提供缓存命中率、操作统计
- **系统层**: Redis INFO命令提供内存、性能、连接等关键指标
- **集成需求**: 标准化Prometheus指标格式

## 集成价值评估

### ✅ 核心价值
1. **缓存性能优化**: 命中率、延迟、内存使用直接影响用户体验
2. **故障预警**: 内存不足、连接数超限等问题提前发现
3. **容量规划**: 基于内存使用趋势进行扩容决策
4. **运维简化**: 统一监控视图，减少排查时间

### 🎯 技术互补
- **应用层**: 业务逻辑相关的缓存指标
- **系统层**: Redis原生性能指标（内存、连接、命令统计）
- **标准化**: 遵循Prometheus生态标准

## 实施计划

### 阶段1: 基础监控集成（立即执行）
**目标**: 添加Redis Exporter和基础配置
**预计耗时**: 30分钟

#### 1.1 修改docker-compose.monitoring.yml
```yaml
# 添加Redis Exporter服务
redis-exporter:
  image: oliver006/redis_exporter:latest
  container_name: redis_exporter
  ports:
    - "9121:9121"
  environment:
    - REDIS_ADDR=redis://localhost:6379
    - REDIS_PASSWORD=${REDIS_PASSWORD:-}
  networks:
    - monitoring
  restart: unless-stopped
```

#### 1.2 更新prometheus.yml
```yaml
# 添加Redis监控任务
- job_name: 'redis'
  static_configs:
    - targets: ['redis_exporter:9121']
  scrape_interval: 30s
  scrape_timeout: 10s
```

### 阶段2: 告警规则配置（立即执行）
**目标**: 创建Redis专用告警规则
**预计耗时**: 20分钟

#### 2.1 创建alerts/redis-alerts.yml
```yaml
groups:
  - name: redis_alerts
    rules:
      - alert: RedisDown
        expr: redis_up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis instance down"
          description: "Redis instance {{ $labels.instance }} is down"

      - alert: RedisMemoryUsageHigh
        expr: (redis_memory_used_bytes / redis_memory_max_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage high"
          description: "Redis memory usage is above 90% on {{ $labels.instance }}"

      - alert: RedisConnectionCountHigh
        expr: redis_connected_clients > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis connection count high"
          description: "Redis has {{ $value }} active connections on {{ $labels.instance }}"

      - alert: RedisHitRateLow
        expr: redis_keyspace_hit_rate < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Redis hit rate low"
          description: "Redis hit rate is {{ $value }} on {{ $labels.instance }}"
```

### 阶段3: 监控面板增强（立即执行）
**目标**: 创建Redis专用Grafana面板
**预计耗时**: 45分钟

#### 3.1 创建grafana/dashboards/redis-dashboard.json
```json
{
  "dashboard": {
    "id": null,
    "title": "Redis监控面板",
    "tags": ["redis", "cache", "monitoring"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "type": "stat",
        "title": "Redis状态",
        "targets": [{"expr": "redis_up", "legendFormat": "状态"}],
        "fieldConfig": {"defaults": {"unit": "short"}}
      },
      {
        "id": 2,
        "type": "graph",
        "title": "内存使用",
        "targets": [
          {"expr": "redis_memory_used_bytes", "legendFormat": "已用内存"},
          {"expr": "redis_memory_max_bytes", "legendFormat": "最大内存"}
        ],
        "yAxes": [{"unit": "bytes"}]
      },
      {
        "id": 3,
        "type": "graph",
        "title": "命令统计",
        "targets": [
          {"expr": "rate(redis_commands_processed_total[5m])", "legendFormat": "命令/秒"}
        ]
      },
      {
        "id": 4,
        "type": "graph",
        "title": "连接数",
        "targets": [{"expr": "redis_connected_clients", "legendFormat": "连接数"}]
      },
      {
        "id": 5,
        "type": "graph",
        "title": "命中率",
        "targets": [{"expr": "redis_keyspace_hit_rate", "legendFormat": "命中率"}],
        "yAxes": [{"min": 0, "max": 1, "unit": "percentunit"}]
      }
    ]
  }
}
```

### 阶段4: 应用层集成优化（可选）
**目标**: 整合应用层和系统层监控
**预计耗时**: 60分钟

#### 4.1 增强EnhancedRedisCacheAdapter
```typescript
// 添加Prometheus指标导出
import { register, Counter, Gauge, Histogram } from 'prom-client';

class RedisMetricsExporter {
  private hitCounter = new Counter({
    name: 'redis_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_name']
  });

  private missCounter = new Counter({
    name: 'redis_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_name']
  });

  private latencyHistogram = new Histogram({
    name: 'redis_cache_operation_duration_seconds',
    help: 'Cache operation duration',
    labelNames: ['cache_name', 'operation']
  });
}
```

## 验证清单

### 部署验证
- [ ] Redis Exporter容器正常运行
- [ ] Prometheus能够抓取Redis指标
- [ ] Grafana面板正常显示Redis数据
- [ ] 告警规则正确触发

### 功能验证
- [ ] 内存使用监控准确
- [ ] 连接数监控实时
- [ ] 命中率计算正确
- [ ] 命令统计完整

## 维护计划

### 日常维护
- **监控检查**: 每日检查Redis面板关键指标
- **告警响应**: 及时处理Redis相关告警
- **容量评估**: 每周评估内存使用趋势

### 定期优化
- **规则调优**: 根据实际使用情况调整告警阈值
- **面板更新**: 每季度更新监控面板展示内容
- **性能分析**: 每月分析Redis性能瓶颈

## 风险评估

### 低风险项
- **性能影响**: Redis Exporter对Redis性能影响<1%
- **资源消耗**: 额外CPU/内存消耗<5%
- **配置复杂度**: 标准化配置，易于维护

### 缓解措施
- **监控冗余**: 保留应用层监控作为备份
- **配置备份**: 所有配置文件版本控制
- **回滚方案**: 快速回滚到原配置

## 预期收益

### 短期收益（1周内）
- ✅ 完整的Redis监控视图
- ✅ 基础告警能力
- ✅ 故障快速定位

### 长期收益（1个月内）
- ✅ 容量规划数据支持
- ✅ 性能优化指导
- ✅ 运维效率提升50%

## 执行命令

### 启动集成环境
```bash
# 1. 启动监控系统
cd docs/docker/codebase-index/monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# 2. 验证Redis Exporter
curl http://localhost:9121/metrics

# 3. 验证Prometheus配置
open http://localhost:9090/targets

# 4. 查看Grafana面板
open http://localhost:3100
```

## 下一步计划

1. **监控优化**: 根据实际使用情况调整面板和告警
2. **自动化**: 添加自动故障恢复机制
3. **扩展监控**: 集成更多Redis相关指标
4. **文档更新**: 更新运维手册和故障处理指南