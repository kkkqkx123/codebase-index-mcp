# NebulaGraph 单机模式 Docker 部署指南

相比完整的集群部署，NebulaGraph 单机模式将 Meta、Storage 和 Graph 服务集成在一个进程中运行，大大简化了部署和管理的复杂性，特别适合开发测试环境。

## 单机模式部署

使用以下命令即可启动 NebulaGraph 单机模式：

```bash
# 启动 NebulaGraph 单机模式
# 注意：需要将命令中的 nightly 替换为您要使用的 NebulaGraph 版本
# 同时需要将 /path/to/nebula/data 替换为您想存储数据的本地目录
mkdir -p /path/to/nebula/data  # 创建数据目录

docker run -d \
  --name nebula-standalone \
  -p 9669:9669 \
  -p 19669:19669 \
  -p 19779:19779 \
  -v /home/share/nebula/data:/data \
  -e TZ=Asia/Shanghai \
  vesoft/nebula-graphd:nightly
```

## 参数说明

- `-d`：后台运行容器
- `--name nebula-standalone`：指定容器名称
- `-p 9669:9669`：映射客户端连接端口
- `-p 19669:19669`：映射 HTTP 监控端口
- `-p 19779:19779`：映射 Storage HTTP 监控端口
- `-v /path/to/nebula/data:/data`：挂载数据卷，确保数据持久化
- `-e TZ=Asia/Shanghai`：设置时区
- `vesoft/nebula-graphd:nightly`：使用 NebulaGraph 官方 graphd 镜像

## 验证部署

```bash
# 检查容器状态
docker ps

# 连接到 NebulaGraph
# 使用 Nebula Console 连接
docker run --rm -it vesoft/nebula-console:v3.8.0 \
  -addr 127.0.0.1 \
  -port 9669 \
  -user root \
  -password nebula
```

## 常用管理命令

```bash
# 停止 NebulaGraph 单机模式
docker stop nebula-standalone

# 启动 NebulaGraph 单机模式
docker start nebula-standalone

# 重启 NebulaGraph 单机模式
docker restart nebula-standalone

# 删除 NebulaGraph 单机模式
docker rm nebula-standalone

# 查看日志
docker logs nebula-standalone
```

## 注意事项

1. 单机模式适用于开发测试环境，不建议在生产环境中使用
2. 请确保指定的数据目录有足够的存储空间
3. 如果需要访问 Web Dashboard，请确保 19669 和 19779 端口未被占用
4. 如需升级版本，请先备份数据，然后使用新版本镜像重新部署