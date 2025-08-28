# Neo4j Docker 部署指南

## Docker Run 命令

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -v /home/share/neo4j_storage:/data \
  -v /home/share/neo4j_logs:/logs \
  -e NEO4J_AUTH=neo4j/1234567kk \
  -e NEO4J_PLUGINS='["apoc"]' \
  neo4j:latest
```

## 参数说明

### 端口映射
- `7474:7474` - HTTP 浏览器界面端口
- `7687:7687` - Bolt 协议端口（用于应用程序连接）

### 卷挂载
- `/home/share/neo4j_storage:/data` - 数据存储目录
  - 主机路径: `/home/share/neo4j_storage`
  - 容器路径: `/data`
- `/home/share/neo4j_logs:/logs` - 日志目录（可选）
  - 主机路径: `/home/share/neo4j_logs`
  - 容器路径: `/logs`

### 环境变量
- `NEO4J_AUTH=neo4j/your_password` - 设置初始用户名和密码
  - 格式: `username/password`
  - 默认用户: `neo4j`
  - 请将 `your_password` 替换为您的实际密码
- `NEO4J_PLUGINS='["apoc"]'` - 安装 APOC 插件（可选）
  - 其他可用插件: `graph-data-science`, `bloom` 等

### 其他参数
- `-d` - 后台运行
- `--name neo4j` - 容器名称
- `neo4j:latest` - 使用最新版本镜像

## 验证部署

```bash
# 检查容器状态
docker ps | grep neo4j

# 访问 Neo4j Browser
# 打开浏览器访问: http://localhost:7474
# 用户名: neo4j
# 密码: your_password (您设置的密码)

# 查看日志
docker logs neo4j
```

## 配置文件（可选）

如需自定义配置，可以创建配置文件并挂载：

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -v /home/share/neo4j_storage:/data \
  -v /home/share/neo4j_logs:/logs \
  -v /home/share/neo4j_conf:/conf \
  -e NEO4J_AUTH=neo4j/your_password \
  neo4j:latest
```

## 常用管理命令

```bash
# 停止容器
docker stop neo4j

# 启动容器
docker start neo4j

# 重启容器
docker restart neo4j

# 删除容器
docker rm neo4j

# 进入容器
docker exec -it neo4j /bin/bash

# 重置密码（如果忘记密码）
docker exec neo4j neo4j-admin dbms set-initial-password new_password
```

## 数据备份

```bash
# 创建备份
docker exec neo4j neo4j-admin database backup neo4j /backups/neo4j-backup-$(date +%Y%m%d)

# 恢复备份
docker exec neo4j neo4j-admin database restore neo4j /backups/neo4j-backup-20231201
```

## 性能优化建议

1. **内存设置**：根据系统资源调整 JVM 堆内存
   ```bash
   -e NEO4J_dbms_memory_heap_initial__size=512m \
   -e NEO4J_dbms_memory_heap_max__size=2G \
   ```

2. **并发连接**：调整最大连接数
   ```bash
   -e NEO4J_dbms_connector_bolt_thread__pool__max__size=200 \
   ```

3. **页面缓存**：配置页面缓存大小
   ```bash
   -e NEO4J_dbms_memory_pagecache_size=1G \
   ```