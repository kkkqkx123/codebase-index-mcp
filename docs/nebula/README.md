# NebulaGraph 文档索引

## 概述

本文档集提供了NebulaGraph图数据库在codebase-index项目中的完整配置、监控和运维指南。

## 核心文档

### 1. 会话管理与监控
- [会话监控系统指南](./SESSION-MONITORING-GUIDE.md) - 完整的监控系统架构和使用指南
- [会话控制配置报告](./session-control-report.md) - 当前配置状态和优化建议

### 2. 客户端集成
- [Node.js客户端指南](./nebula-node.md) - Node.js客户端使用和开发指南
- [编程语言调用参考](./编程语言调用.txt) - 各语言客户端链接

### 3. 官方资源
- [官方文档链接](./官方文档.txt) - NebulaGraph官方文档
- [迁移提示词](./提示词.txt) - Neo4j迁移到NebulaGraph的提示

## 监控配置

### Prometheus配置
- **位置**: `../docker/codebase-index/monitoring/prometheus.yml`
- **内容**: NebulaGraph监控任务配置

### 告警规则
- **位置**: `../docker/codebase-index/monitoring/alerts/nebula-sessions.yml`
- **内容**: 会话相关的告警规则

### Grafana仪表板
- **位置**: `../docker/codebase-index/monitoring/grafana/dashboards/nebula-sessions.json`
- **内容**: 会话监控仪表板

## 运维脚本

### 启动脚本
- **位置**: `../../scripts/start-nebula-monitoring.ps1`
- **功能**: 启动NebulaGraph和监控服务

### 停止脚本
- **位置**: `../../scripts/stop-nebula-monitoring.ps1`
- **功能**: 停止服务并清理资源

### 状态检查
- **位置**: `../../scripts/check-nebula-status.ps1`
- **功能**: 检查服务状态和连接性

## 系统架构

```
+-------------------+     +---------------------+     +-------------------+
|                   |     |                     |     |                   |
|  NebulaGraph      |---->|  Stats Exporter     |---->|   Prometheus      |
|  (graphd:9669)    |     |  (:9100/metrics)    |     |   (:9090)         |
|                   |     |                     |     |                   |
+-------------------+     +---------------------+     +-------------------+
                                                          |
                                                          v
+-------------------+     +---------------------+     +-------------------+
|                   |     |                     |     |                   |
|   Alertmanager    |<----|   Grafana           |<----|   Dashboard       |
|   (:9093)         |     |   (:3000)           |     |   (nebula-sessions)|
|                   |     |                     |     |                   |
+-------------------+     +-------------------+--+     +-------------------+
```

## 关键配置参数

### NebulaGraph配置 (`nebula-graphd.conf`)
```bash
--max_sessions_per_ip_per_user=1000     # 每个IP每个用户最大会话数
--session_idle_timeout_secs=28800      # 会话空闲超时时间 (8小时)
--session_reclaim_interval_secs=60    # 会话回收检查间隔 (60秒)
--enable_space_level_metrics=true     # 启用空间级别指标
--enable_metric=true                  # 启用指标收集
```

### 监控指标
- `nebula_num_sessions`: 当前活跃会话数
- `nebula_max_sessions`: 最大允许会话数
- `nebula_session_idle_timeouts_total`: 会话空闲超时总数
- `nebula_session_reclaims_total`: 会话回收总数

## 访问地址

| 服务 | 地址 | 默认凭据 |
|------|------|----------|
| NebulaGraph Graphd | http://localhost:9669 | root/nebula |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |
| Alertmanager | http://localhost:9093 | - |
| Stats Exporter | http://localhost:9100/metrics | - |

## 版本信息

- **NebulaGraph**: v3.8.0
- **Nebula Stats Exporter**: v3.3.0
- **Node.js客户端**: @nebula-contrib/nebula-nodejs v3.0.3
- **Prometheus**: latest
- **Grafana**: latest
- **Alertmanager**: latest

## 快速开始

### 启动所有服务
```powershell
cd d:\ide\tool\codebase-index
.\scripts\start-nebula-monitoring.ps1
```

### 检查服务状态
```powershell
.\scripts\check-nebula-status.ps1
```

### 停止服务
```powershell
.\scripts\stop-nebula-monitoring.ps1
```

## 支持与维护

如有问题，请参考：

1. [NebulaGraph官方文档](https://docs.nebula-graph.io/)
2. [Prometheus文档](https://prometheus.io/docs/)
3. [Grafana文档](https://grafana.com/docs/)

或联系运维团队。

---
*最后更新: 2024年*