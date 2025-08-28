# NebulaGraph Docker 部署指南

## Docker Compose 部署（推荐）

创建 `docker-compose.yml` 文件：

```yaml
version: '3.4'
services:
  metad0:
    image: vesoft/nebula-metad:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=metad0
      - --ws_ip=metad0
      - --port=9559
      - --data_path=/data/meta
    volumes:
      - ./data/meta0:/data/meta
    ports:
      - 9559:9559
      - 19559:19559
    restart: unless-stopped

  metad1:
    image: vesoft/nebula-metad:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=metad1
      - --ws_ip=metad1
      - --port=9559
      - --data_path=/data/meta
    volumes:
      - ./data/meta1:/data/meta
    ports:
      - 9560:9559
      - 19560:19559
    restart: unless-stopped

  metad2:
    image: vesoft/nebula-metad:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=metad2
      - --ws_ip=metad2
      - --port=9559
      - --data_path=/data/meta
    volumes:
      - ./data/meta2:/data/meta
    ports:
      - 9561:9559
      - 19561:19559
    restart: unless-stopped

  storaged0:
    image: vesoft/nebula-storaged:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=storaged0
      - --ws_ip=storaged0
      - --port=9779
      - --data_path=/data/storage
    depends_on:
      - metad0
      - metad1
      - metad2
    volumes:
      - ./data/storage0:/data/storage
    ports:
      - 9779:9779
      - 19779:19779
    restart: unless-stopped

  storaged1:
    image: vesoft/nebula-storaged:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=storaged1
      - --ws_ip=storaged1
      - --port=9779
      - --data_path=/data/storage
    depends_on:
      - metad0
      - metad1
      - metad2
    volumes:
      - ./data/storage1:/data/storage
    ports:
      - 9780:9779
      - 19780:19779
    restart: unless-stopped

  storaged2:
    image: vesoft/nebula-storaged:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --local_ip=storaged2
      - --ws_ip=storaged2
      - --port=9779
      - --data_path=/data/storage
    depends_on:
      - metad0
      - metad1
      - metad2
    volumes:
      - ./data/storage2:/data/storage
    ports:
      - 9781:9779
      - 19781:19779
    restart: unless-stopped

  graphd:
    image: vesoft/nebula-graphd:v3.8.0
    environment:
      TZ: "Asia/Shanghai"
    command:
      - --meta_server_addrs=metad0:9559,metad1:9559,metad2:9559
      - --port=9669
      - --local_ip=graphd
      - --ws_ip=graphd
      - --enable_authorize=true
    depends_on:
      - storaged0
      - storaged1
      - storaged2
    ports:
      - 9669:9669
      - 19669:19669
    restart: unless-stopped
```

## 启动 NebulaGraph 集群

```bash
# 创建数据目录
mkdir -p data/meta0 data/meta1 data/meta2 data/storage0 data/storage1 data/storage2

# 启动 NebulaGraph 集群
docker-compose up -d
```

## 参数说明

### 端口映射
- `9669:9669` - NebulaGraph 客户端连接端口
- `19669:19669` - NebulaGraph HTTP 监控端口
- `9559:9559` - Meta 服务端口
- `9779:9779` - Storage 服务端口
- `19559:19559` - Meta HTTP 监控端口
- `19779:19779` - Storage HTTP 监控端口

### 卷挂载
- `./data/meta*:/data/meta` - Meta 服务数据存储目录
- `./data/storage*:/data/storage` - Storage 服务数据存储目录

### 环境变量
- `TZ=Asia/Shanghai` - 设置时区

## 验证部署

```bash
# 检查容器状态
docker-compose ps

# 连接到 NebulaGraph
# 使用 Nebula Console 连接
docker run --rm -it vesoft/nebula-console:v3.8.0 \
  -addr graphd \
  -port 9669 \
  -user root \
  -password nebula

# 或者使用 IP 地址连接
docker run --rm -it vesoft/nebula-console:v3.8.0 \
  -addr 127.0.0.1 \
  -port 9669 \
  -user root \
  -password nebula
```

## 常用管理命令

```bash
# 停止 NebulaGraph 集群
docker-compose stop

# 启动 NebulaGraph 集群
docker-compose start

# 重启 NebulaGraph 集群
docker-compose restart

# 删除 NebulaGraph 集群
docker-compose down

# 查看日志
docker-compose logs graphd
docker-compose logs storaged0
docker-compose logs metad0
```

## 数据备份与恢复

```bash
# 备份数据（需要在容器内执行）
docker exec -it graphd bash
nebula> CREATE SNAPSHOT;

# 恢复数据（需要在容器内执行）
docker exec -it graphd bash
nebula> DROP SPACE IF EXISTS your_space;
nebula> RESTORE SNAPSHOT your_snapshot;
```

## 性能优化建议

1. **资源配置**：根据系统资源调整容器资源限制
   ```yaml
   deploy:
     resources:
       limits:
         memory: 2G
         cpus: '1.0'
   ```

2. **存储优化**：使用高性能存储卷
   ```yaml
   volumes:
     - type: volume
       source: nebula-meta0
       target: /data/meta
       volume:
         nocopy: true
   ```