# 监控配置指南

本目录包含了完整的监控配置，用于监控代码库索引服务中的Semgrep静态分析和Tree-sitter解析功能。

## 📁 目录结构

```
monitoring/
├── 📊 prometheus.yml                 # Prometheus主配置文件
├── 🚨 alertmanager.yml               # Alertmanager告警配置
├── 🔔 alerts/                        # 告警规则
│   ├── semgrep-alerts.yml           # Semgrep监控告警
│   └── treesitter-alerts.yml        # Tree-sitter监控告警
├── 📈 grafana/                      # Grafana配置
│   ├── dashboards/                  # 仪表板配置
│   │   ├── semgrep-dashboard.json   # Semgrep监控仪表板
│   │   └── treesitter-dashboard.json # Tree-sitter监控仪表板
│   └── provisioning/               # 自动配置
│       ├── datasources/prometheus.yml # Prometheus数据源
│       └── dashboards/dashboards.yml  # 仪表板自动加载
├── 🐳 docker-compose.monitoring.yml   # Docker Compose配置
├── 🚀 deploy-monitoring.ps1         # 部署脚本
└── 📖 README.md                     # 本指南
```

## 🎯 功能特性

### Semgrep监控
- **扫描性能**: 监控扫描耗时、成功率、错误率
- **安全问题**: 跟踪发现的问题数量和严重性分布
- **规则使用**: 监控规则执行频率和缓存效率
- **告警**: 错误率过高、扫描速度过慢等告警

### Tree-sitter监控
- **解析性能**: 监控解析时间、成功率、缓存命中率
- **语言分析**: 按语言统计解析次数和性能
- **缓存效率**: 监控缓存大小、命中/未命中比例
- **内存使用**: 监控缓存内存占用情况

## 🚀 快速开始

### 1. 一键部署

```powershell
# 启动所有监控服务
.\deploy-monitoring.ps1 start

# 检查服务状态
.\deploy-monitoring.ps1 status

# 查看日志
.\deploy-monitoring.ps1 logs
```

### 2. 手动部署

#### 使用Docker Compose

```bash
# 启动监控服务
docker-compose -f docker-compose.monitoring.yml up -d

# 停止服务
docker-compose -f docker-compose.monitoring.yml down
```

#### 验证配置

```bash
# 验证Prometheus配置
docker run --rm -v "$(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus promtool check config /etc/prometheus/prometheus.yml

# 验证告警规则
docker run --rm -v "$(pwd)/alerts:/etc/prometheus/alerts" prom/prometheus promtool check rules /etc/prometheus/alerts/semgrep-alerts.yml
```

## 📊 访问地址

| 服务 | 地址 | 用户名/密码 |
|------|------|-------------|
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3001 | admin/admin123 |
| Alertmanager | http://localhost:9093 | - |

## 🔧 配置说明

### Prometheus配置

- **scrape_interval**: 30秒
- **evaluation_interval**: 15秒
- **数据保留**: 15天

### 告警规则

#### Semgrep告警
- **高错误率**: 错误率 > 10%，持续5分钟
- **扫描速度慢**: P95耗时 > 30秒，持续10分钟
- **缓存效率低**: 命中率 < 30%，持续15分钟

#### Tree-sitter告警
- **高错误率**: 错误率 > 10%，持续5分钟
- **解析速度慢**: P95耗时 > 1秒，持续10分钟
- **内存使用高**: 缓存 > 100MB，持续10分钟

### Grafana仪表板

#### Semgrep仪表板
- **扫描总览**: 总扫描次数、成功/失败统计
- **性能指标**: 扫描耗时分布
- **安全指标**: 发现问题统计
- **缓存指标**: 缓存命中率

#### Tree-sitter仪表板
- **解析总览**: 总解析次数、成功/失败统计
- **性能指标**: 解析耗时分布
- **语言分析**: 按语言统计
- **缓存指标**: 缓存命中率、内存使用

## 📈 常用查询

### Semgrep查询

```promql
# 扫描成功率
(semgrep_scans_successful_total / semgrep_scans_total) * 100

# 平均扫描时间
rate(semgrep_scan_duration_seconds_sum[5m]) / rate(semgrep_scan_duration_seconds_count[5m])

# 缓存命中率
semgrep_cache_hits_total / (semgrep_cache_hits_total + semgrep_cache_misses_total)
```

### Tree-sitter查询

```promql
# 解析成功率
((treesitter_parse_count_total - treesitter_parse_errors_total) / treesitter_parse_count_total) * 100

# 平均解析时间
rate(treesitter_parse_time_ms_sum[5m]) / rate(treesitter_parse_time_ms_count[5m])

# 缓存命中率
treesitter_cache_hits_total / (treesitter_cache_hits_total + treesitter_cache_misses_total)
```

## 🛠️ 故障排除

### 常见问题

1. **服务无法启动**
   - 检查端口是否被占用
   - 验证配置文件格式
   - 查看服务日志

2. **指标未显示**
   - 确认应用服务已启动
   - 检查指标端点是否可访问
   - 验证Prometheus目标状态

3. **告警不触发**
   - 检查告警规则配置
   - 确认阈值设置
   - 查看Alertmanager日志

### 调试命令

```bash
# 检查服务状态
docker-compose -f docker-compose.monitoring.yml ps

# 查看服务日志
docker-compose -f docker-compose.monitoring.yml logs -f prometheus
docker-compose -f docker-compose.monitoring.yml logs -f grafana
docker-compose -f docker-compose.monitoring.yml logs -f alertmanager

# 测试指标端点
curl http://localhost:3000/metrics | grep -E "(semgrep|treesitter)"
```

## 🔧 自定义配置

### 修改告警阈值

编辑对应的告警规则文件：
- `alerts/semgrep-alerts.yml`
- `alerts/treesitter-alerts.yml`

### 添加新指标

1. 在应用代码中添加指标收集
2. 更新Prometheus配置
3. 在Grafana中添加新的面板

### 配置通知

编辑 `alertmanager.yml` 配置邮件、Slack或其他通知渠道。

## 📚 相关文档

- [Semgrep监控集成指南](../docs/monitoring/semgrep-monitoring.md)
- [Tree-sitter监控集成指南](../docs/monitoring/tree-sitter-monitoring.md)
- [Prometheus官方文档](https://prometheus.io/docs/)
- [Grafana官方文档](https://grafana.com/docs/)

## 🤝 贡献

欢迎提交Issue和Pull Request来改进监控配置！