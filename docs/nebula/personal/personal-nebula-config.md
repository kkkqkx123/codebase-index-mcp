# 个人使用NebulaGraph优化配置指南

## 当前配置分析

### 集群规模
- **Meta节点**: 3个（metad0, metad1, metad2）
- **Storage节点**: 3个（storaged0, storaged1, storaged2）
- **Graph节点**: 1个（graphd）
- **总计**: 7个容器服务

### 当前并发参数
```yaml
# Graph服务配置
--max_sessions_per_ip_per_user=1000    # 每用户每IP最大会话数
--session_idle_timeout_secs=28800      # 会话空闲超时：8小时
--session_reclaim_interval_secs=60       # 会话回收间隔：1分钟
--enable_metric=true                     # 启用指标收集
```

## 个人使用优化建议

### 1. 集群规模精简

#### 推荐配置：单节点模式
```yaml
# 个人使用docker-compose.yml
version: '3.8'
services:
  nebula-personal:
    image: vesoft/nebula-graph:v3.8.0
    container_name: nebula-personal
    ports:
      - "9669:9669"
      - "19669:19669"
      - "19670:19670"
    environment:
      - TZ=Asia/Shanghai
    volumes:
      - ./nebula-data:/data
      - ./nebula-logs:/logs
      - ./personal-nebula.conf:/usr/local/nebula/etc/nebula-graphd.conf
    restart: unless-stopped
    networks:
      - monitoring
```

### 2. 并发参数优化

#### 个人使用配置文件（personal-nebula.conf）
```bash
# 个人使用NebulaGraph配置
--max_sessions_per_ip_per_user=50      # 降低至50个会话（个人足够）
--session_idle_timeout_secs=3600         # 缩短至1小时（节省资源）
--session_reclaim_interval_secs=30       # 加快回收至30秒
--enable_metric=true
--ws_http_port=19670

# 内存优化
--system_memory_high_watermark_ratio=0.8  # 内存使用上限80%
--storage_client_timeout_ms=60000         # 存储客户端超时1分钟
--client_idle_timeout_secs=600            # 客户端空闲超时10分钟

# 查询优化
--max_allowed_connections=100             # 最大连接数降至100
--num_worker_threads=4                    # 工作线程数4个（适合个人）
--max_concurrent_requests=20              # 最大并发请求20个
```

### 3. 资源使用对比

| 配置类型 | 容器数量 | 内存占用 | CPU使用 | 适用场景 |
|---------|----------|----------|---------|----------|
| 当前集群 | 7个 | 4-8GB | 4-8核 | 企业级/多项目 |
| 个人精简 | 1个 | 512MB-2GB | 1-2核 | 个人/单项目 |

### 4. Node.js客户端配置优化

#### 个人使用连接池配置
```javascript
// 个人使用的Nebula客户端配置
const config = {
  servers: [
    {
      host: 'localhost',
      port: 9669,
      username: 'root',
      password: 'nebula'
    }
  ],
  pools: {
    maxConnections: 10,        // 最大连接数降至10
    minConnections: 2,         // 最小连接数2
    acquireTimeoutMillis: 5000, // 获取连接超时5秒
    idleTimeoutMillis: 30000,   // 空闲连接超时30秒
    evictionRunIntervalMillis: 10000, // 清理间隔10秒
    softIdleTimeoutMillis: 10000 // 软空闲超时10秒
  },
  retryPolicy: {
    maxRetries: 2,             // 重试次数降至2次
    retryDelay: 1000           // 重试延迟1秒
  }
};
```

### 5. 启动脚本优化

#### 个人使用启动脚本
```bash
#!/bin/bash
# personal-nebula-start.sh

echo "启动个人NebulaGraph..."

# 创建必要的目录
mkdir -p nebula-data nebula-logs

# 启动单节点NebulaGraph
docker-compose -f docker-compose.personal.yml up -d

# 等待服务启动
echo "等待NebulaGraph启动..."
sleep 10

# 检查状态
docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW HOSTS;"

echo "NebulaGraph个人版已启动！"
echo "访问地址: localhost:9669"
```

### 6. 资源监控配置

#### 个人使用监控简化
```yaml
# 个人使用prometheus.yml片段
- job_name: 'nebula-personal'
  static_configs:
    - targets: ['localhost:19669']
  metrics_path: '/stats'
  scrape_interval: 60s    # 降低采集频率
```

### 7. 数据备份策略

#### 个人使用备份脚本
```bash
#!/bin/bash
# backup-personal-nebula.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./nebula-backups"

mkdir -p $BACKUP_DIR

# 停止服务
docker-compose -f docker-compose.personal.yml stop

# 备份数据
tar -czf $BACKUP_DIR/nebula-data-$DATE.tar.gz nebula-data/

# 重启服务
docker-compose -f docker-compose.personal.yml start

echo "备份完成: $BACKUP_DIR/nebula-data-$DATE.tar.gz"
```

## 快速开始（个人版）

### 1. 下载配置文件
```bash
# 创建个人配置目录
mkdir nebula-personal
cd nebula-personal

# 下载配置文件
curl -O [配置文件地址]/docker-compose.personal.yml
curl -O [配置文件地址]/personal-nebula.conf
```

### 2. 一键启动
```bash
# 启动服务
./personal-nebula-start.sh

# 验证连接
nebula-console -u root -p nebula --address=localhost --port=9669
```

### 3. 创建个人使用空间
```sql
-- 创建个人代码库索引空间
CREATE SPACE IF NOT EXISTS code_index(partition_num=1, replica_factor=1, vid_type=FIXED_STRING(128));
USE code_index;

-- 创建必要的标签
CREATE TAG IF NOT EXISTS file(path string, size int, last_modified timestamp);
CREATE TAG IF NOT EXISTS function(name string, signature string, start_line int, end_line int);
CREATE TAG IF NOT EXISTS class(name string, type string, methods int);
CREATE EDGE IF NOT EXISTS calls(from_line int, to_line int);
```

## 性能预期

- **启动时间**: 10-15秒（vs 集群版60-90秒）
- **内存占用**: 512MB-1GB（vs 集群版4-8GB）
- **磁盘使用**: 100MB-500MB（根据代码库大小）
- **查询延迟**: <100ms（个人使用场景）

这个配置专为个人开发者优化，在保持功能完整性的同时大幅降低了资源消耗。