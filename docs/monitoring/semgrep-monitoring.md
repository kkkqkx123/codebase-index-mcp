# Semgrep 监控集成指南

## 概述

本文档详细说明了 semgrep 静态分析工具与 Prometheus 监控系统的集成方案。通过这种集成，您可以实时监控 semgrep 扫描的性能、错误率、规则使用情况等关键指标。

## 集成必要性

### 为什么需要监控 semgrep？

1. **性能优化**：监控扫描耗时和资源使用，识别性能瓶颈
2. **可靠性保障**：跟踪扫描成功率和错误类型，确保服务稳定性
3. **安全态势感知**：通过问题发现趋势了解代码库安全状况
4. **容量规划**：基于使用数据规划资源需求
5. **规则效果评估**：了解哪些规则最有效，优化规则库

### 监控指标分类

| 指标类别 | 具体指标 | 重要性 |
|---------|---------|--------|
| 性能指标 | 扫描耗时、文件处理速度 | 高 |
| 可靠性指标 | 成功率、错误率、超时次数 | 高 |
| 安全指标 | 发现问题数量、严重性分布 | 中 |
| 资源指标 | CPU使用、内存消耗、缓存命中率 | 中 |
| 业务指标 | 规则使用频率、扫描频率 | 低 |

## 技术架构

### 集成架构图

```
+----------------+     +---------------------+     +-------------------+
| SemgrepScan    |     | PrometheusMetrics   |     | Prometheus Server |
| Service        |---->| Service             |---->|                   |
+----------------+     +---------------------+     +-------------------+
        |                         |                         |
        | 指标数据                 | HTTP metrics endpoint  | 拉取指标
        v                         v                         v
+----------------+     +---------------------+     +-------------------+
| 扫描性能数据     |     | /metrics            |     | Grafana Dashboard |
| 错误统计        |     +---------------------+     +-------------------+
+----------------+
```

### 数据流

1. **指标收集**：SemgrepScanService 在执行扫描时收集指标数据
2. **指标暴露**：PrometheusMetricsService 通过 `/metrics` 端点暴露指标
3. **指标拉取**：Prometheus Server 定期拉取指标数据
4. **可视化**：Grafana 从 Prometheus 获取数据并展示

## 配置说明

### 1. Prometheus 配置

在 `monitoring/prometheus.yml` 中添加 semgrep 作业：

```yaml
scrape_configs:
  - job_name: 'codebase-index-semgrep'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
```

### 2. Grafana 仪表板配置

创建 `monitoring/grafana/provisioning/dashboards/semgrep.json`：

```json
{
  "dashboard": {
    "id": null,
    "title": "Semgrep 监控仪表板",
    "tags": ["semgrep", "static-analysis", "security"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "扫描性能",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(semgrep_scan_duration_seconds_sum[5m]) / rate(semgrep_scan_duration_seconds_count[5m])",
            "legendFormat": "平均扫描时间"
          }
        ]
      }
    ]
  }
}
```

### 3. 告警规则配置

在 `monitoring/alerts/semgrep-alerts.yml` 中添加：

```yaml
groups:
- name: semgrep-alerts
  rules:
  - alert: SemgrepHighErrorRate
    expr: semgrep_scan_errors_total / semgrep_scan_total > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Semgrep 扫描错误率过高"
      description: "Semgrep 扫描错误率超过 10%，当前值 {{ $value }}"

  - alert: SemgrepSlowScan
    expr: histogram_quantile(0.95, rate(semgrep_scan_duration_seconds_bucket[5m])) > 30
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Semgrep 扫描速度过慢"
      description: "95% 的扫描操作耗时超过 30 秒"
```

## 指标定义

### 核心指标

| 指标名称 | 类型 | 描述 | 标签 |
|---------|------|------|------|
| semgrep_scan_total | Counter | 总扫描次数 | result="success|error" |
| semgrep_scan_duration_seconds | Histogram | 扫描耗时分布 | 无 |
| semgrep_scan_errors_total | Counter | 扫描错误次数 | error_type="timeout|validation|execution" |
| semgrep_rules_executed_total | Counter | 规则执行次数 | rule_id, language |
| semgrep_findings_total | Counter | 发现问题数量 | severity, category |
| semgrep_cache_hits_total | Counter | 缓存命中次数 | cache_type="ast|rule" |
| semgrep_cache_misses_total | Counter | 缓存未命中次数 | cache_type="ast|rule" |

### 指标示例

```promql
# 扫描成功率
semgrep_scan_total{result="success"} / semgrep_scan_total

# 平均扫描时间
rate(semgrep_scan_duration_seconds_sum[5m]) / rate(semgrep_scan_duration_seconds_count[5m])

# 缓存命中率
semgrep_cache_hits_total / (semgrep_cache_hits_total + semgrep_cache_misses_total)
```

## 实现细节

### 1. 指标接口定义

在 `PrometheusMetricsService` 中添加：

```typescript
export interface SemgrepMetrics {
  scans: {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  };
  findings: {
    total: number;
    bySeverity: {
      error: number;
      warning: number;
      info: number;
    };
    byCategory: {
      [category: string]: number;
    };
  };
  rules: {
    totalExecuted: number;
    mostFrequent: Array<{ruleId: string; count: number}>;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}
```

### 2. 指标收集实现

在 `SemgrepScanService` 中添加指标收集：

```typescript
private metrics = {
  scanCount: {success: 0, error: 0},
  scanDurations: [] as number[],
  ruleExecutions: new Map<string, number>(),
  cacheStats: {hits: 0, misses: 0}
};

async scanProject(projectPath: string, options: SemgrepScanOptions = {}): Promise<SemgrepScanResult> {
  const startTime = Date.now();
  
  try {
    // ... 扫描逻辑
    
    // 记录成功指标
    this.metrics.scanCount.success++;
    this.metrics.scanDurations.push(Date.now() - startTime);
    
    // 记录规则执行
    if (options.rules) {
      options.rules.forEach(rule => {
        const count = this.metrics.ruleExecutions.get(rule) || 0;
        this.metrics.ruleExecutions.set(rule, count + 1);
      });
    }
    
    return result;
  } catch (error) {
    // 记录错误指标
    this.metrics.scanCount.error++;
    throw error;
  }
}
```

### 3. Prometheus 指标注册

在 `PrometheusMetricsService` 构造函数中添加：

```typescript
this.semgrepMetrics = {
  scanCount: new promClient.Counter({
    name: 'semgrep_scan_total',
    help: 'Total number of Semgrep scans',
    registers: [this.registry],
    labelNames: ['result']
  }),
  scanDuration: new promClient.Histogram({
    name: 'semgrep_scan_duration_seconds',
    help: 'Semgrep scan duration in seconds',
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
    registers: [this.registry]
  }),
  // ... 其他指标
};
```

## 部署和验证

### 1. 部署步骤

```bash
# 1. 更新配置
cp monitoring/prometheus.yml monitoring/prometheus.yml.backup
# 添加 semgrep 作业配置

# 2. 重启服务
npm run build
npm start

# 3. 验证指标端点
curl http://localhost:3000/metrics | grep semgrep
```

### 2. 验证命令

```bash
# 检查指标是否正常暴露
curl -s http://localhost:3000/metrics | grep "semgrep_"

# 测试扫描功能
npm test -- test/services/semgrep/SemgrepScanService.test.ts

# 检查 Prometheus 目标状态
curl -s http://localhost:9090/api/v1/targets | grep semgrep
```

### 3. 监控验证

1. **指标可用性**：确认 `/metrics` 端点包含 semgrep 指标
2. **数据准确性**：执行扫描后确认指标值正确更新
3. **告警测试**：模拟错误场景验证告警触发
4. **仪表板功能**：确认 Grafana 仪表板正常显示数据

## 故障排除

### 常见问题

1. **指标未显示**
   - 检查 PrometheusMetricsService 是否正确初始化
   - 验证 SemgrepScanService 的指标收集代码

2. **数据不准确**
   - 确认指标标签使用正确
   - 检查时间戳记录逻辑

3. **性能影响**
   - 监控指标收集本身的资源消耗
   - 考虑异步指标更新

### 调试命令

```bash
# 查看实时指标
node -e "console.log(require('prom-client').register.metrics())"

# 检查服务状态
ps aux | grep node

# 查看日志
tail -f logs/app.log | grep -i semgrep
```

## 性能考虑

### 优化建议

1. **异步指标更新**：避免阻塞主扫描流程
2. **批量指标更新**：减少 Prometheus 推送频率
3. **采样策略**：对高频指标进行采样
4. **缓存优化**：使用内存缓存减少磁盘IO

### 资源预估

| 指标类型 | 内存消耗 | CPU影响 | 存储需求 |
|---------|---------|---------|----------|
| 基础计数器 | 低 (<1MB) | 可忽略 | 低 |
| 直方图指标 | 中 (2-5MB) | 低 | 中 |
| 高频指标 | 高 (>10MB) | 中 | 高 |

## 扩展性设计

### 未来扩展

1. **分布式追踪**：集成 OpenTelemetry 追踪
2. **自定义指标**：支持用户自定义监控维度
3. **预测分析**：基于历史数据预测扫描性能
4. **自动优化**：根据监控数据自动调整配置

### 插件架构

```typescript
interface MetricsPlugin {
  name: string;
  collectMetrics(): Promise<MetricData>;
  shouldEnable(config: Config): boolean;
}

class SemgrepMetricsPlugin implements MetricsPlugin {
  // 实现具体的指标收集逻辑
}
```

## 总结

通过 semgrep 与监控系统的集成，您可以：

1. **实时监控**扫描性能和错误率
2. **自动告警**检测异常情况
3. **数据驱动优化**基于实际使用数据调整配置
4. **趋势分析**了解代码库安全状况的变化
5. **容量规划**基于历史数据规划资源需求

这种集成为静态分析管道的可靠性、性能和安全性提供了全面的可观测性保障。