# NebulaGraph 配置参考指南

## 概述

本文档提供了NebulaGraph在codebase-index项目中的所有配置详细信息，包括Docker配置、服务配置、监控配置和客户端配置。

## Docker Compose 配置

### 主配置文件
**文件**: `docs/docker/codebase-index/nebula/docker-compose.nebula.yml`

#### Graph服务配置
```yaml
services:
  graphd:
    image: vesoft/nebula-graphd:v3.8.0
    ports:
      - "9669:9669"     # 客户端连接端口
      - "19669:19669"   # HTTP监控端口
      - "19670:19670"   # WebSocket端口
    volumes:
      - ./nebula-graphd.conf:/usr/local/nebula/etc/nebula-graphd.conf
      - ./logs:/usr/local/nebula/logs
    environment:
      - "enable_authorize=true"
    networks:
      - nebula
      - monitoring
    healthcheck:
      test: ["CMD", "nebula-console", "-u", "root", "-p", "nebula", "-addr", "graphd", "-port", "9669", "-e", "SHOW HOSTS"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

#### Meta服务配置
```yaml
services:
  metad0:
    image: vesoft/nebula-metad:v3.8.0
    volumes:
      - ./nebula-metad.conf:/usr/local/nebula/etc/nebula-metad.conf
      - ./data/meta0:/usr/local/nebula/data/meta
      - ./logs:/usr/local/nebula/logs
    networks:
      - nebula
    restart: unless-stopped
```

#### Storage服务配置
```yaml
services:
  storaged0:
    image: vesoft/nebula-storaged:v3.8.0
    volumes:
      - ./nebula-storaged.conf:/usr/local/nebula/etc/nebula-storaged.conf
      - ./data/storage0:/usr/local/nebula/data/storage
      - ./logs:/usr/local/nebula/logs
    networks:
      - nebula
    restart: unless-stopped
```

#### Stats Exporter配置
```yaml
services:
  nebula-stats-exporter:
    image: vesoft/nebula-stats-exporter:v3.3.0
    ports:
      - "9100:9100"
    volumes:
      - ./nebula-stats-exporter-config.yaml:/etc/nebula-stats-exporter/nebula-stats-exporter-config.yaml
    networks:
      - monitoring
    depends_on:
      - graphd
      - metad0
      - metad1
      - metad2
      - storaged0
      - storaged1
      - storaged2
    restart: unless-stopped
```

## NebulaGraph 服务配置

### Graphd配置 (`nebula-graphd.conf`)
**文件**: `docs/docker/codebase-index/nebula/nebula-graphd.conf`

```bash
########## 网络配置 ##########
--local_ip=0.0.0.0
--port=9669
--ws_http_port=19669
--ws_h2_port=19670

########## 会话管理 ##########
--max_sessions_per_ip_per_user=1000
--session_idle_timeout_secs=28800
--session_reclaim_interval_secs=60

########## 性能配置 ##########
--max_allowed_query_memory=1073741824
--max_allowed_connections=10000
--client_idle_timeout_secs=28800

########## 监控配置 ##########
--enable_metric=true
--enable_space_level_metrics=true
--metric_interval_secs=60

########## 日志配置 ##########
--log_dir=./logs
--minloglevel=0
--v=0

########## 认证配置 ##########
--enable_authorize=true
--auth_type=password
```

### Stats Exporter配置 (`nebula-stats-exporter-config.yaml`)
**文件**: `docs/docker/codebase-index/nebula/nebula-stats-exporter-config.yaml`

```yaml
clusters:
  - name: codebase-index
    instances:
      - instanceName: graphd
        endpointIP: graphd
        endpointPort: 9669
        componentType: graphd

      - instanceName: metad0
        endpointIP: metad0
        endpointPort: 9559
        componentType: metad

      - instanceName: metad1
        endpointIP: metad1
        endpointPort: 9559
        componentType: metad

      - instanceName: metad2
        endpointIP: metad2
        endpointPort: 9559
        componentType: metad

      - instanceName: storaged0
        endpointIP: storaged0
        endpointPort: 9779
        componentType: storaged

      - instanceName: storaged1
        endpointIP: storaged1
        endpointPort: 9779
        componentType: storaged

      - instanceName: storaged2
        endpointIP: storaged2
        endpointPort: 9779
        componentType: storaged

scrapeInterval: 30s
listenAddress: ":9100"
logLevel: "info"
```

## Prometheus 监控配置

**文件**: `docs/docker/codebase-index/monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'nebula-sessions'
    static_configs:
      - targets: ['nebula-stats-exporter:9100']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nebula-graph'
    static_configs:
      - targets: ['graphd:19669']
    metrics_path: '/stats'
    scrape_interval: 30s

  - job_name: 'nebula-projects'
    file_sd_configs:
      - files:
          - '/etc/prometheus/targets/nebula-projects*.json'
    metrics_path: '/metrics'
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## 告警规则配置

**文件**: `docs/docker/codebase-index/monitoring/alerts/nebula-sessions.yml`

```yaml
groups:
- name: nebula-sessions
  rules:
  - alert: HighSessionUsage
    expr: nebula_num_sessions / nebula_max_sessions * 100 > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "NebulaGraph会话使用率过高"
      description: "会话使用率已达到 {{ $value }}%，当前 {{ $labels.instance }} 有 {{ $value }} 个活跃会话"

  - alert: CriticalSessionUsage
    expr: nebula_num_sessions / nebula_max_sessions * 100 > 90
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "NebulaGraph会话使用率严重"
      description: "会话使用率已达到 {{ $value }}%，接近最大限制"

  - alert: SessionLimitReached
    expr: nebula_num_sessions >= nebula_max_sessions
    for: 1m
    labels:
      severity: emergency
    annotations:
      summary: "NebulaGraph会话数达到最大限制"
      description: "会话数已达到最大限制 {{ $value }}，新连接将被拒绝"

  - alert: FrequentSessionIdleTimeouts
    expr: rate(nebula_session_idle_timeouts_total[5m]) > 10
    labels:
      severity: warning
    annotations:
      summary: "会话空闲超时频繁"
      description: "5分钟内会话空闲超时次数超过10次"

  - alert: HighSessionReclaimRate
    expr: rate(nebula_session_reclaims_total[1m]) > 5
    labels:
      severity: warning
    annotations:
      summary: "会话回收率过高"
      description: "每分钟会话回收次数超过5次"
```

## Node.js 客户端配置

### 基本连接配置
```typescript
import { createClient } from '@nebula-contrib/nebula-nodejs'

const nebulaClient = createClient({
  servers: ['localhost:9669'],
  userName: 'root',
  password: 'nebula',
  space: 'codebase_index',
  poolSize: 10,                    // 连接池大小
  bufferSize: 2000,                // 命令缓冲区大小
  executeTimeout: 15000,           // 执行超时(毫秒)
  pingInterval: 60000             // 心跳间隔(毫秒)
})
```

### 连接池优化配置
```typescript
const optimizedClient = createClient({
  servers: ['graphd:9669'],
  userName: process.env.NEBULA_USER || 'root',
  password: process.env.NEBULA_PASSWORD || 'nebula',
  space: process.env.NEBULA_SPACE || 'default',
  
  // 连接池配置
  poolSize: 20,                    // 增大连接池
  bufferSize: 5000,                // 增大缓冲区
  
  // 超时配置
  executeTimeout: 30000,           // 延长执行超时
  connectionTimeout: 10000,        // 连接超时
  
  // 重试配置
  maxRetries: 3,                   // 最大重试次数
  retryDelay: 1000,                // 重试延迟
  
  // 心跳配置
  pingInterval: 30000,             // 更频繁的心跳
  
  // 日志配置
  logLevel: 'info'
})
```

### 事件监听配置
```typescript
nebulaClient.on('ready', ({ sender }) => {
  console.log('Nebula客户端准备就绪')
})

nebulaClient.on('error', ({ sender, error }) => {
  console.error('Nebula客户端错误:', error)
})

nebulaClient.on('connected', ({ sender }) => {
  console.log('连接到NebulaGraph服务器')
})

nebulaClient.on('authorized', ({ sender }) => {
  console.log('授权成功')
})

nebulaClient.on('reconnecting', ({ sender, retryInfo }) => {
  console.log(`正在重连，尝试次数: ${retryInfo.retryCount}`)
})

nebulaClient.on('close', ({ sender }) => {
  console.log('连接关闭')
})
```

## 环境变量配置

### Docker环境变量
```bash
# NebulaGraph连接配置
NEBULA_SERVERS=graphd:9669
NEBULA_USER=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=codebase_index

# 连接池配置
NEBULA_POOL_SIZE=10
NEBULA_BUFFER_SIZE=2000
NEBULA_TIMEOUT=15000

# 监控配置
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
```

### 开发环境配置 (`.env`)
```bash
# NebulaGraph开发环境配置
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USER=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=test

# 连接配置
NEBULA_POOL_SIZE=5
NEBULA_TIMEOUT=10000
NEBULA_LOG_LEVEL=debug

# 监控配置
MONITORING_ENABLED=true
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

## 性能调优参数

### 生产环境推荐配置
```bash
# 会话管理
--max_sessions_per_ip_per_user=2000
--session_idle_timeout_secs=14400      # 4小时
--session_reclaim_interval_secs=30

# 内存配置
--max_allowed_query_memory=2147483648   # 2GB
--max_allowed_connections=20000

# 线程池
--num_worker_threads=16
--num_io_threads=8

# 查询优化
--query_concurrently=true
--optimize_query_structure=true
```

### 监控间隔配置
```yaml
# Prometheus抓取间隔
scrape_interval: 15s

# 指标收集间隔
metric_interval_secs: 30

# 告警评估间隔
evaluation_interval: 30s
```

## 安全配置

### SSL/TLS配置
```bash
# Graphd SSL配置
--ssl_cert_path=/path/to/cert.pem
--ssl_key_path=/path/to/key.pem
--ssl_ca_path=/path/to/ca.pem
--ssl_require_client_auth=false

# 客户端SSL配置
const sslClient = createClient({
  servers: ['graphd:9669'],
  ssl: {
    cert: fs.readFileSync('/path/to/client.crt'),
    key: fs.readFileSync('/path/to/client.key'),
    ca: fs.readFileSync('/path/to/ca.crt'),
    rejectUnauthorized: true
  }
})
```

### 认证配置
```bash
# LDAP认证
--auth_type=ldap
--ldap_server=ldap://ldap.example.com:389
--ldap_bind_dn=cn=admin,dc=example,dc=com
--ldap_bind_password=password

# OAuth2认证
--auth_type=oauth2
--oauth2_issuer_url=https://auth.example.com
--oauth2_client_id=nebula-client
--oauth2_client_secret=secret
```

## 备份与恢复配置

### 数据备份配置
```yaml
# 备份计划配置
backup:
  enabled: true
  schedule: "0 2 * * *"        # 每天凌晨2点
  retention_days: 30
  storage:
    type: s3
    bucket: nebula-backups
    region: us-east-1

# 本地备份配置
local_backup:
  enabled: true
  path: /backups/nebula
  retention_count: 7
```

### 恢复配置
```bash
# 从备份恢复
nebula-restore --meta_server=metad0:9559 \
               --storage_server=storaged0:9779 \
               --backup_dir=/backups/nebula/latest \
               --space_name=codebase_index
```

## 故障排除配置

### 日志级别配置
```bash
# 详细日志配置
--minloglevel=0
--v=2
--stderrthreshold=0

# 组件特定日志
--graphd_vmodule=session=2,connection=1
--storaged_vmodule=raft=2,storage=1
```

### 调试配置
```bash
# 性能分析
--enable_profiling=true
--profiling_port=10086

# 跟踪配置
--enable_tracing=true
--tracing_sample_rate=0.1
```

---
*配置参考版本: 1.0*
*最后更新: 2024年*