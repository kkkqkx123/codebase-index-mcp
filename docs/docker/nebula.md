# NebulaGraph Docker 部署指南

## Docker Compose 部署（推荐）
在 `/home/docker-compose/nebula` 目录下创建 `docker-compose.yml` 文件：

创建 `docker-compose.yml` 文件：
见`./docker-compose.yml`

## 启动 NebulaGraph 集群

```bash
# 创建数据目录
cd /home/share
mkdir nebula && cd nebula
touch docker-compose.yml
vi docker-compose.yml

# 启动 NebulaGraph 集群
# 创建目录
mkdir -p data/meta{0,1,2}
mkdir -p data/storage{0,1,2}
mkdir -p logs/{metad0,metad1,metad2,storaged0,storaged1,storaged2,graphd,console}
# 启动
# 清除现有实例
docker-compose down
docker-compose up -d

# 查看状态
docker-compose ps

# 查看 storaged 日志
docker-compose logs storaged0

# 进入 CLI
docker exec -it graphd /usr/local/nebula/bin/nebula-console -u root -p nebula


# 重写docker-compose.yml
cd /home/share/nebula
rm docker-compose.yml
touch docker-compose.yml
vi docker-compose.yml
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

# 使用 docker-compose 中的 console 服务连接
docker-compose exec console /bin/sh
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