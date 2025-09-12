# NebulaGraph 会话监控系统指南

## 概述

本文档详细介绍了为NebulaGraph数据库实现的会话监控系统，包括监控配置、告警规则、仪表板和运维脚本。

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
+-------------------+     +---------------------+     +-------------------+
```

## 关键配置

### 1. NebulaGraph 会话配置

配置文件: `docs/docker/codebase-index/nebula/nebula-graphd.conf`

```conf
--max_sessions_per_ip_per_user=1000
--session_idle_timeout_secs=28800  # 8小时
--session_reclaim_interval_secs=60
```

### 2. 监控指标

Nebula Stats Exporter 提供以下关键指标：

- `nebula_num_sessions`: 当前活跃会话数
- `nebula_max_sessions`: 最大允许会话数
- `nebula_session_idle_timeouts_total`: 会话空闲超时总数
- `nebula_session_reclaims_total`: 会话回收总数

## 监控仪表板

### Grafana Dashboard

位置: `docs/docker/codebase-index/monitoring/grafana/dashboards/nebula-sessions.json`

包含以下面板：

1. **活跃会话监控**
   - 当前活跃会话数
   - 会话使用率 (%)  
   - 最大会话限制

2. **会话趋势分析**
   - 会话数量变化趋势
   - 会话创建/销毁速率

3. **性能指标**
   - 会话空闲超时统计
   - 会话回收频率

4. **告警状态**
   - 当前告警状态
   - 历史告警记录

## 告警规则

配置文件: `docs/docker/codebase-index/monitoring/alerts/nebula-sessions.yml`

### 告警级别

1. **Warning (警告)**
   - 会话使用率 > 80% 持续5分钟
   - 会话空闲超时频繁（5分钟内 > 10次）
   - 会话回收率过高（> 5次/分钟）

2. **Critical (严重)**
   - 会话使用率 > 90% 持续2分钟

3. **Emergency (紧急)**
   - 会话数达到最大限制持续1分钟

## 运维脚本

### 启动服务

```powershell
# 启动NebulaGraph和监控服务
.\scripts\start-nebula-monitoring.ps1

# 后台启动
.\scripts\start-nebula-monitoring.ps1 -Detach

# 重新构建并启动
.\scripts\start-nebula-monitoring.ps1 -Build
```

### 停止服务

```powershell
# 停止服务
.\scripts\stop-nebula-monitoring.ps1

# 停止并删除数据卷
.\scripts\stop-nebula-monitoring.ps1 -RemoveVolumes
```

### 检查状态

```powershell
# 检查服务状态
.\scripts\check-nebula-status.ps1
```

## 访问地址

| 服务 | 地址 | 默认凭据 |
|------|------|----------|
| NebulaGraph Graphd | http://localhost:9669 | root/nebula |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |
| Alertmanager | http://localhost:9093 | - |
| Stats Exporter | http://localhost:9100/metrics | - |

## 故障排除

### 常见问题

1. **Docker网络问题**
   ```powershell
   # 检查监控网络
   docker network ls --filter "name=monitoring"
   
   # 创建网络（如果不存在）
   docker network create monitoring
   ```

2. **服务启动失败**
   ```powershell
   # 查看日志
   docker-compose -f docs/docker/codebase-index/nebula/docker-compose.nebula.yml logs
   docker-compose -f docs/docker/codebase-index/monitoring/docker-compose.monitoring.yml logs
   ```

3. **指标收集问题**
   ```powershell
   # 检查Stats Exporter
   curl http://localhost:9100/metrics
   
   # 检查Prometheus目标
   curl http://localhost:9090/api/v1/targets | jq .
   ```

### 性能调优

1. **调整会话参数**
   - 修改 `session_idle_timeout_secs` 减少空闲会话占用
   - 调整 `session_reclaim_interval_secs` 优化回收频率

2. **监控间隔调整**
   - Prometheus: 修改 `scrape_interval`
   - Grafana: 调整面板刷新频率

## 扩展功能

### 自定义监控

1. **添加新的监控指标**
   - 修改 `nebula-stats-exporter-config.yaml`
   - 更新Prometheus配置
   - 创建新的Grafana面板

2. **集成其他监控系统**
   - 支持Datadog、New Relic等APM工具
   - 配置Webhook告警通知

### 自动化运维

1. **自动扩缩容**
   - 基于会话使用率自动调整资源
   - 集成Kubernetes HPA

2. **备份恢复**
   - 会话状态备份机制
   - 灾难恢复流程

## 版本信息

- NebulaGraph: v3.8.0
- Nebula Stats Exporter: v3.3.0
- Prometheus: latest
- Grafana: latest
- Alertmanager: latest

## 支持与维护

如有问题，请参考：

1. [NebulaGraph官方文档](https://docs.nebula-graph.io/)
2. [Prometheus文档](https://prometheus.io/docs/)
3. [Grafana文档](https://grafana.com/docs/)

或联系运维团队。