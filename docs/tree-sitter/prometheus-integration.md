# Tree-sitter 与 Prometheus 集成指南

## 概述

本文档详细说明了当前项目中 tree-sitter 解析器如何与 Prometheus 监控系统集成。通过这种集成，您可以监控 tree-sitter 解析器的性能、缓存命中率、错误率等关键指标。

## 当前集成状态

### 1. Tree-sitter 核心服务架构

当前项目中的 tree-sitter 实现主要包含以下组件：

- <mcfile name="TreeSitterCoreService.ts" path="src/services/parser/TreeSitterCoreService.ts"></mcfile> - 核心解析服务
- <mcfile name="TreeSitterService.ts" path="src/services/parser/TreeSitterService.ts"></mcfile> - 高级封装服务
- <mcfile name="PrometheusMetricsService.ts" path="src/services/monitoring/PrometheusMetricsService.ts"></mcfile> - 监控指标服务

### 2. 现有的监控指标

目前 PrometheusMetricsService 主要监控以下类别的指标：

- **数据库指标**: Qdrant 和 Nebula 数据库连接状态、操作计数
- **系统指标**: 内存使用、CPU 使用、磁盘空间、网络流量
- **服务指标**: 文件监视、语义分析、错误率等

**注意**: 当前版本中 tree-sitter 特定的指标尚未完全集成。

## 需要集成的 Tree-sitter 指标

### 1. 解析性能指标

```typescript
interface TreeSitterMetrics {
  parsing: {
    totalParses: number;           // 总解析次数
    averageParseTime: number;      // 平均解析时间(ms)
    parseSuccessRate: number;      // 解析成功率(%)
    cacheHitRate: number;          // 缓存命中率(%)
  };
  languages: {
    [language: string]: {
      parseCount: number;          // 各语言解析次数
      successCount: number;        // 成功次数
      averageTime: number;         // 平均解析时间
    };
  };
  cache: {
    astCacheSize: number;          // AST 缓存大小
    nodeCacheSize: number;         // 节点缓存大小
    hits: number;                  // 缓存命中次数
    misses: number;                // 缓存未命中次数
    evictions: number;            // 缓存淘汰次数
  };
}
```

### 2. Prometheus 指标定义

在 <mcfile name="PrometheusMetricsService.ts" path="src/services/monitoring/PrometheusMetricsService.ts"></mcfile> 中添加以下指标：

```typescript
private treeSitterMetrics: {
  parseCount: promClient.Counter;
  parseTime: promClient.Histogram;
  cacheHits: promClient.Counter;
  cacheMisses: promClient.Counter;
  cacheSize: promClient.Gauge;
  languageParseCount: promClient.Gauge;
  parseErrors: promClient.Counter;
};
```

## 集成实现步骤

### 步骤 1: 修改 TreeSitterCoreService

在 <mcfile name="TreeSitterCoreService.ts" path="src/services/parser/TreeSitterCoreService.ts"></mcfile> 中添加指标收集功能：

```typescript
export class TreeSitterCoreService {
  private metrics: {
    totalParses: number;
    successfulParses: number;
    totalParseTime: number;
    languageStats: Map<string, { count: number; totalTime: number }>;
  } = {
    totalParses: 0,
    successfulParses: 0,
    totalParseTime: 0,
    languageStats: new Map()
  };

  async parseCode(code: string, language: string): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      // ... 现有解析逻辑
      
      // 收集指标
      this.metrics.totalParses++;
      this.metrics.successfulParses++;
      this.metrics.totalParseTime += parseTime;
      
      // 更新语言特定指标
      const langStats = this.metrics.languageStats.get(language) || { count: 0, totalTime: 0 };
      langStats.count++;
      langStats.totalTime += parseTime;
      this.metrics.languageStats.set(language, langStats);
      
      return result;
    } catch (error) {
      // 记录解析失败
      this.metrics.totalParses++;
      throw error;
    }
  }

  getMetrics() {
    const total = this.metrics.totalParses;
    const successRate = total > 0 ? (this.metrics.successfulParses / total) * 100 : 0;
    const avgParseTime = total > 0 ? this.metrics.totalParseTime / total : 0;
    
    return {
      totalParses: this.metrics.totalParses,
      successfulParses: this.metrics.successfulParses,
      successRate,
      averageParseTime: avgParseTime,
      cacheStats: this.getCacheStats(),
      languageStats: Object.fromEntries(this.metrics.languageStats)
    };
  }
}
```

### 步骤 2: 在 PrometheusMetricsService 中添加 Tree-sitter 指标

```typescript
export class PrometheusMetricsService {
  // 在构造函数中添加 tree-sitter 指标初始化
  constructor() {
    // ... 现有初始化代码
    
    // 初始化 tree-sitter 指标
    this.treeSitterMetrics = {
      parseCount: new promClient.Counter({
        name: 'treesitter_parse_count_total',
        help: 'Total number of tree-sitter parse operations',
        registers: [this.registry],
        labelNames: ['language', 'success']
      }),
      parseTime: new promClient.Histogram({
        name: 'treesitter_parse_time_ms',
        help: 'Tree-sitter parse time in milliseconds',
        buckets: [1, 5, 10, 50, 100, 500, 1000],
        registers: [this.registry],
        labelNames: ['language']
      }),
      cacheHits: new promClient.Counter({
        name: 'treesitter_cache_hits_total',
        help: 'Total number of tree-sitter cache hits',
        registers: [this.registry]
      }),
      cacheMisses: new promClient.Counter({
        name: 'treesitter_cache_misses_total',
        help: 'Total number of tree-sitter cache misses',
        registers: [this.registry]
      }),
      cacheSize: new promClient.Gauge({
        name: 'treesitter_cache_size',
        help: 'Current size of tree-sitter cache',
        registers: [this.registry]
      }),
      languageParseCount: new promClient.Gauge({
        name: 'treesitter_language_parse_count',
        help: 'Parse count by language',
        registers: [this.registry],
        labelNames: ['language']
      }),
      parseErrors: new promClient.Counter({
        name: 'treesitter_parse_errors_total',
        help: 'Total number of tree-sitter parse errors',
        registers: [this.registry],
        labelNames: ['language', 'error_type']
      })
    };
  }

  async collectTreeSitterMetrics(): Promise<TreeSitterMetrics> {
    try {
      const treeSitterService = container.get<TreeSitterCoreService>(TYPES.TreeSitterCoreService);
      const metrics = treeSitterService.getMetrics();
      
      // 更新 Prometheus 指标
      this.treeSitterMetrics.parseCount.inc({ language: 'all', success: 'true' }, metrics.successfulParses);
      this.treeSitterMetrics.parseCount.inc({ language: 'all', success: 'false' }, metrics.totalParses - metrics.successfulParses);
      
      this.treeSitterMetrics.parseTime.observe(metrics.averageParseTime);
      
      this.treeSitterMetrics.cacheHits.inc(metrics.cacheStats.hits);
      this.treeSitterMetrics.cacheMisses.inc(metrics.cacheStats.misses);
      this.treeSitterMetrics.cacheSize.set(metrics.cacheStats.astCacheSize + metrics.cacheStats.nodeCacheSize);
      
      // 更新语言特定指标
      for (const [language, stats] of Object.entries(metrics.languageStats)) {
        this.treeSitterMetrics.languageParseCount.set({ language }, stats.count);
      }
      
      return metrics;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to collect tree-sitter metrics: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'PrometheusMetricsService', operation: 'collectTreeSitterMetrics' }
      );
      throw error;
    }
  }
}
```

### 步骤 3: 更新 collectAllMetrics 方法

```typescript
async collectAllMetrics(): Promise<{
  database: DatabaseMetrics;
  system: SystemMetrics;
  service: ServiceMetrics;
  treeSitter: TreeSitterMetrics;
}> {
  try {
    const [database, system, service, treeSitter] = await Promise.all([
      this.collectDatabaseMetrics(),
      this.collectSystemMetrics(),
      this.collectServiceMetrics(),
      this.collectTreeSitterMetrics()
    ]);

    return { database, system, service, treeSitter };
  } catch (error) {
    this.errorHandler.handleError(
      new Error(`Failed to collect all metrics: ${error instanceof Error ? error.message : String(error)}`),
      { component: 'PrometheusMetricsService', operation: 'collectAllMetrics' }
    );
    throw error;
  }
}
```

## Grafana 仪表板配置

### 推荐的面板

1. **解析性能面板**
   - 总解析次数时序图
   - 平均解析时间时序图
   - 解析成功率仪表盘

2. **缓存效率面板**
   - 缓存命中率
   - 缓存大小变化
   - 缓存命中/未命中比率

3. **语言分析面板**
   - 各语言解析次数饼图
   - 语言解析时间对比
   - 语言错误率统计

### 示例查询

```promql
# 解析成功率
treesitter_parse_count_total{success="true"} / ignoring(success) treesitter_parse_count_total

# 平均解析时间
rate(treesitter_parse_time_ms_sum[5m]) / rate(treesitter_parse_time_ms_count[5m])

# 缓存命中率
treesitter_cache_hits_total / (treesitter_cache_hits_total + treesitter_cache_misses_total)
```

## 告警规则配置

### 关键告警

```yaml
groups:
- name: tree-sitter-alerts
  rules:
  - alert: TreeSitterHighErrorRate
    expr: (treesitter_parse_count_total{success="false"} / treesitter_parse_count_total) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Tree-sitter 解析错误率过高"
      description: "Tree-sitter 解析错误率超过 10%，当前值为 {{ $value }}"

  - alert: TreeSitterSlowParse
    expr: histogram_quantile(0.95, rate(treesitter_parse_time_ms_bucket[5m])) > 1000
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Tree-sitter 解析速度过慢"
      description: "95% 的解析操作耗时超过 1 秒"

  - alert: TreeSitterCacheInefficient
    expr: treesitter_cache_hits_total / (treesitter_cache_hits_total + treesitter_cache_misses_total) < 0.3
    for: 15m
    labels:
      severity: info
    annotations:
      summary: "Tree-sitter 缓存效率低下"
      description: "缓存命中率低于 30%，建议调整缓存策略"
```

## 性能优化建议

### 1. 缓存策略优化

```typescript
// 根据监控数据动态调整缓存大小
const optimizeCache = (metrics: TreeSitterMetrics) => {
  const hitRate = metrics.cacheStats.hits / (metrics.cacheStats.hits + metrics.cacheStats.misses);
  
  if (hitRate < 0.3) {
    // 缓存命中率低，增加缓存大小
    this.astCache.resize(1000);
    this.nodeCache.resize(2000);
  } else if (hitRate > 0.8) {
    // 缓存命中率高，可适当减小缓存
    this.astCache.resize(300);
    this.nodeCache.resize(600);
  }
};
```

### 2. 并行处理优化

根据解析时间监控数据动态调整并发数：

```typescript
const optimalConcurrency = (avgParseTime: number) => {
  if (avgParseTime < 10) {
    return 8; // 快速操作，高并发
  } else if (avgParseTime < 100) {
    return 4; // 中等速度，中等并发
  } else {
    return 2;  // 慢速操作，低并发
  }
};
```

## 测试策略

### 单元测试

```typescript
describe('TreeSitterMetrics', () => {
  it('should collect parse metrics correctly', async () => {
    const service = new TreeSitterCoreService();
    
    // 执行多次解析
    await service.parseCode('function test() {}', 'javascript');
    await service.parseCode('class Test {}', 'javascript');
    
    const metrics = service.getMetrics();
    expect(metrics.totalParses).toBe(2);
    expect(metrics.successfulParses).toBe(2);
    expect(metrics.successRate).toBe(100);
  });
});
```

### 集成测试

```typescript
describe('PrometheusTreeSitterIntegration', () => {
  it('should expose tree-sitter metrics via Prometheus', async () => {
    const metricsService = container.get<PrometheusMetricsService>(TYPES.PrometheusMetricsService);
    
    // 触发指标收集
    await metricsService.collectTreeSitterMetrics();
    
    // 验证指标已注册
    const metrics = await promClient.register.metrics();
    expect(metrics).toContain('treesitter_parse_count_total');
    expect(metrics).toContain('treesitter_parse_time_ms');
  });
});
```

## 部署说明

### 1. 依赖安装

确保已安装必要的依赖：

```bash
npm install prom-client
npm install tree-sitter
npm install tree-sitter-typescript tree-sitter-javascript tree-sitter-python
```

### 2. 配置更新

在 <mcfile name="inversify.config.ts" path="src/inversify.config.ts"></mcfile> 中确保正确绑定服务：

```typescript
container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
container.bind<PrometheusMetricsService>(TYPES.PrometheusMetricsService).to(PrometheusMetricsService).inSingletonScope();
```

### 3. 监控端点

Tree-sitter 指标将通过现有的 `/metrics` 端点暴露：

```http
GET /metrics

# 响应包含:
treesitter_parse_count_total{language="javascript",success="true"} 42
treesitter_parse_time_ms_bucket{le="10"} 15
treesitter_cache_hits_total 123
```

## 故障排除

### 常见问题

1. **指标未显示**：检查服务绑定和指标初始化顺序
2. **性能下降**：监控缓存命中率，调整缓存大小
3. **内存泄漏**：监控 AST 缓存大小，定期清理

### 调试命令

```bash
# 检查指标端点
curl http://localhost:3000/metrics | grep treesitter

# 查看实时指标
node -e "console.log(require('prom-client').register.metrics())"
```

## 总结

通过将 tree-sitter 与 Prometheus 集成，您可以：

1. **实时监控**解析性能和缓存效率
2. **自动告警**检测性能问题和错误
3. **数据驱动优化**基于实际使用数据调整配置
4. **趋势分析**了解代码库解析模式的变化

这种集成将为代码分析管道的性能和可靠性提供宝贵的洞察力。