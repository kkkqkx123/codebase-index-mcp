# NebulaGraph 运维手册

## 概述

本文档提供了NebulaGraph图数据库的日常运维、监控、故障处理和性能优化指南。

## 日常运维任务

### 1. 服务状态检查

#### 使用运维脚本检查
```powershell
# 检查NebulaGraph服务状态
.\scripts\check-nebula-status.ps1

# 输出示例:
# [INFO] Docker正在运行
# [INFO] NebulaGraph服务状态:
#   graphd: running
#   metad0: running  
#   storaged0: running
# [INFO] 端点可访问性:
#   Graphd (9669): ✓
#   Prometheus (9090): ✓
#   Grafana (3000): ✓
```

#### 手动检查命令
```bash
# 检查Docker服务状态
docker-compose -f docs/docker/codebase-index/nebula/docker-compose.nebula.yml ps

# 检查容器日志
docker-compose -f docs/docker/codebase-index/nebula/docker-compose.nebula.yml logs graphd

# 检查监控服务
docker-compose -f docs/docker/codebase-index/monitoring/docker-compose.monitoring.yml ps
```

### 2. 监控仪表板检查

每日检查以下监控指标：

1. **活跃会话数**: 确保在正常范围内 (通常 < 800)
2. **会话使用率**: 监控百分比，超过80%需要关注
3. **查询性能**: 检查平均查询响应时间
4. **资源使用**: 监控CPU、内存、磁盘使用情况
5. **告警状态**: 检查是否有活跃告警

### 3. 日志检查

#### 关键日志文件
```bash
# Graphd日志
tail -f /usr/local/nebula/logs/graphd.INFO

# 错误日志
tail -f /usr/local/nebula/logs/graphd.ERROR

# 监控日志
docker logs nebula-stats-exporter
```

#### 重要日志模式
- `Session created`: 会话创建记录
- `Session reclaimed`: 会话回收记录  
- `Query timeout`: 查询超时警告
- `Connection refused`: 连接拒绝错误
- `Out of memory`: 内存不足错误

## 监控与告警

### 关键监控指标

| 指标名称 | 描述 | 正常范围 | 告警阈值 |
|---------|------|----------|----------|
| `nebula_num_sessions` | 活跃会话数 | < 800 | > 800 (Warning) |
| `session_usage_percent` | 会话使用率 | < 80% | > 80% (Warning) |
| `query_duration_seconds` | 查询耗时 | < 1s | > 5s (Warning) |
| `memory_usage_bytes` | 内存使用 | < 2GB | > 1.8GB (Warning) |
| `cpu_usage_percent` | CPU使用率 | < 70% | > 85% (Warning) |

### 告警处理流程

#### 1. 会话使用率过高 (>80%)
```bash
# 查看当前会话
SHOW SESSIONS;

# 终止空闲会话
KILL SESSION <session_id>;

# 批量清理空闲超过1小时的会话
KILL SESSION (SELECT session_id FROM sessions WHERE idle_time > 3600);
```

#### 2. 连接数达到限制
```bash
# 紧急处理：增加最大会话数
ALTER HOST graphd CONFIG SET max_sessions_per_ip_per_user=2000;

# 检查连接来源
SHOW SESSIONS | WHERE user != 'root';
```

#### 3. 内存不足
```bash
# 检查内存使用
SHOW STATS | WHERE name LIKE '%memory%';

# 优化查询内存限制
ALTER HOST graphd CONFIG SET max_allowed_query_memory=2147483648;
```

## 备份与恢复

### 日常备份
```bash
# 创建数据备份
nebula-backup --meta_server=metad0:9559 \
              --storage_server=storaged0:9779 \
              --backup_name=daily_$(date +%Y%m%d) \
              --backup_dir=/backups/nebula

# 验证备份完整性
nebula-verify-backup --backup_dir=/backups/nebula/daily_20231201
```

### 恢复操作
```bash
# 停止服务
.\scripts\stop-nebula-monitoring.ps1

# 从备份恢复
nebula-restore --meta_server=metad0:9559 \
               --storage_server=storaged0:9779 \
               --backup_dir=/backups/nebula/daily_20231201 \
               --space_name=codebase_index

# 重启服务
.\scripts\start-nebula-monitoring.ps1
```

## 性能优化

### 查询优化

#### 1. 慢查询分析
```bash
# 启用慢查询日志
ALTER HOST graphd CONFIG SET slow_query_threshold_ms=1000;

# 查看慢查询
SHOW SLOW QUERIES;

# 分析查询计划
EXPLAIN <query>;
```

#### 2. 索引优化
```bash
# 查看现有索引
SHOW TAG INDEXES;
SHOW EDGE INDEXES;

# 创建新索引
CREATE TAG INDEX IF NOT EXISTS user_name_index ON user(user_name);
CREATE EDGE INDEX IF NOT EXISTS follows_index ON follows(degree);

# 重建索引
REBUILD TAG INDEX user_name_index;
```

### 配置调优

#### 会话配置优化
```bash
# 生产环境推荐配置
--max_sessions_per_ip_per_user=2000
--session_idle_timeout_secs=14400      # 4小时
--session_reclaim_interval_secs=30
--max_allowed_query_memory=2147483648   # 2GB
```

#### 内存配置优化
```bash
# JVM内存配置 (如果适用)
-XX:MaxHeapSize=2g
-XX:InitialHeapSize=1g
-XX:MaxMetaspaceSize=256m
```

## 故障处理

### 常见故障及解决方案

#### 1. 服务启动失败
```bash
# 检查Docker日志
docker logs nebula-graphd

# 检查端口冲突
netstat -an | grep 9669

# 清理旧容器
docker-compose -f docs/docker/codebase-index/nebula/docker-compose.nebula.yml down
```

#### 2. 连接超时
```bash
# 检查网络连接
ping graphd

# 检查防火墙规则
netsh advfirewall firewall show rule name=all

# 测试端口连通性
telnet graphd 9669
```

#### 3. 认证失败
```bash
# 检查用户权限
SHOW USERS;

# 重置密码
ALTER USER root WITH PASSWORD 'new_password';

# 检查认证配置
cat /usr/local/nebula/etc/nebula-graphd.conf | grep auth
```

#### 4. 磁盘空间不足
```bash
# 检查磁盘使用
df -h

# 清理日志文件
rm -f /usr/local/nebula/logs/*.INFO.*
rm -f /usr/local/nebula/logs/*.ERROR.*

# 清理备份文件
find /backups/nebula -name "*.backup" -mtime +30 -delete
```

### 紧急恢复程序

#### 1. 数据损坏恢复
```bash
# 停止服务
.\scripts\stop-nebula-monitoring.ps1 -RemoveVolumes

# 从最新备份恢复
nebula-restore --meta_server=metad0:9559 \
               --storage_server=storaged0:9779 \
               --backup_dir=/backups/nebula/latest

# 重启服务
.\scripts\start-nebula-monitoring.ps1
```

#### 2. 集群脑裂处理
```bash
# 检查集群状态
SHOW HOSTS;

# 强制重新选举
UPDATE CONFIG metad:leader_heartbeat_timeout_ms=10000;

# 重启Meta服务
docker restart nebula-metad0 nebula-metad1 nebula-metad2
```

## 容量规划

### 会话容量估算

```bash
# 当前配置容量
最大会话数: 1000
平均会话内存: 2MB
总内存需求: ~2GB

# 支持用户数估算
并发用户数 = 最大会话数 / 每个用户平均会话数
假设每个用户2个会话: 1000 / 2 = 500并发用户
```

### 性能基准测试

#### 1. 查询性能测试
```bash
# 执行基准查询
benchmark="MATCH (n) RETURN count(n) LIMIT 1"
for i in {1..100}; do
  echo "Query $i: $(time nebula-console -e "$benchmark")"
done
```

#### 2. 并发测试
```bash
# 使用ab进行并发测试
ab -n 1000 -c 100 http://localhost:9669/status
```

## 安全运维

### 访问控制
```bash
# 创建只读用户
CREATE USER reader WITH PASSWORD 'readonly123';
GRANT READ ON SPACE codebase_index TO reader;

# 创建运维用户
CREATE USER ops WITH PASSWORD 'ops123';
GRANT ALL ON SPACE codebase_index TO ops;
```

### 审计日志
```bash
# 启用审计日志
ALTER HOST graphd CONFIG SET audit_enabled=true;
ALTER HOST graphd CONFIG SET audit_log_dir=/usr/local/nebula/audit_logs;

# 查看审计日志
tail -f /usr/local/nebula/audit_logs/audit.log
```

### 网络安全
```bash
# 配置防火墙
netsh advfirewall firewall add rule name="NebulaGraph" dir=in action=allow protocol=TCP localport=9669

# 启用SSL/TLS
ALTER HOST graphd CONFIG SET ssl_cert_path=/path/to/cert.pem;
ALTER HOST graphd CONFIG SET ssl_key_path=/path/to/key.pem;
```

## 版本升级

### 升级流程

1. **准备阶段**
   ```bash
   # 备份数据
   .\scripts\stop-nebula-monitoring.ps1
   nebula-backup --backup_name=pre_upgrade_$(date +%Y%m%d)
   
   # 检查兼容性
   nebula-version-check
   ```

2. **升级执行**
   ```bash
   # 更新Docker镜像版本
   sed -i 's/v3.8.0/v3.9.0/g' docs/docker/codebase-index/nebula/docker-compose.nebula.yml
   
   # 重新部署
   .\scripts\start-nebula-monitoring.ps1 -Build
   ```

3. **验证测试**
   ```bash
   # 验证服务状态
   .\scripts\check-nebula-status.ps1
   
   # 测试查询功能
   nebula-console -e "SHOW HOSTS"
   
   # 验证数据完整性
   nebula-verify-data
   ```

## 文档维护

### 配置文档更新
当修改以下文件时，需要更新相应文档：

1. `docker-compose.nebula.yml` → 更新配置参考文档
2. `nebula-graphd.conf` → 更新配置参考文档  
3. `prometheus.yml` → 更新监控指南
4. 告警规则文件 → 更新运维手册

### 版本记录
保持文档版本与系统版本一致，记录重大变更。

---
*运维手册版本: 1.0*
*对应系统版本: NebulaGraph v3.8.0*
*最后更新: 2024年*