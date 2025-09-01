# Qdrant Docker 部署指南

## Docker Compose 部署（推荐）

使用 Docker Compose 部署 Qdrant，可以更好地与监控系统集成：

```bash
# 使用 docker-compose 部署
docker-compose -f docker-compose.qdrant.yml up -d
```

## Docker Run 命令

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /home/share/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

## 参数说明

### 端口映射
- `6333:6333` - HTTP API 端口
- `6334:6334` - gRPC 端口

### 卷挂载
- `/home/share/qdrant_storage:/qdrant/storage` - 持久化存储目录
  - 主机路径: `/home/share/qdrant_storage`
  - 容器路径: `/qdrant/storage`

### 其他参数
- `-d` - 后台运行
- `--name qdrant` - 容器名称
- `qdrant/qdrant:latest` - 使用最新版本镜像

## 验证部署

```bash
# 检查容器状态
docker ps | grep qdrant

# 查看 Qdrant 健康状态
curl http://localhost:6333/

# 查看日志
docker logs qdrant
```

## 配置文件（可选）

如需自定义配置，可以创建配置文件并挂载：

```bash
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /home/share/qdrant_storage:/qdrant/storage \
  -v /home/share/qdrant_config.yaml:/qdrant/config/production.yaml \
  qdrant/qdrant:latest
```

## 常用管理命令

```bash
# 停止容器
docker stop qdrant

# 启动容器
docker start qdrant

# 删除容器
docker rm qdrant

# 进入容器
docker exec -it qdrant /bin/bash