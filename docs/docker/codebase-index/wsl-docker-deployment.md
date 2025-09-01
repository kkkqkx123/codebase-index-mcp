# WSL Docker 综合部署指南

本文档介绍如何在 Windows Subsystem for Linux (WSL) 环境中部署完整的代码库索引系统，包含三个核心模块：
- **Monitoring Stack**：Prometheus + Alertmanager + Grafana
- **NebulaGraph**：分布式图数据库
- **Qdrant**：向量数据库

**注意：整个codebase-index目录将移动到linux子系统中的/home/docker-compose/codebase-index目录。在wsl中的绝对路径为/home/docker-compose/codebase-index**

## 先决条件

1. **WSL2 环境**：已安装 WSL2 和 Linux 发行版（推荐 Ubuntu）
2. **Docker Desktop**：已安装并启用 WSL2 集成
3. **Docker Compose**：已安装最新版本

## 目录结构准备

### 自动化脚本创建目录

使用提供的自动化脚本创建完整的目录结构：

```bash
# 进入项目目录
cd /home/docker-compose/codebase-index

# 运行目录创建脚本
chmod +x setup-config-files.sh
bash setup-config-files.sh
```
这个脚本会自动：
1. 创建完整的目录结构（monitoring、nebula、qdrant）
2. 将现有的配置文件移动到正确的目录位置
3. 设置适当的文件权限
4. 验证目录结构的完整性

**注意：确保以下配置文件已准备好：**
- `prometheus.yml` - Prometheus监控配置
- `alertmanager.yml` - 告警管理配置
- `docker-compose.monitoring.yml` - 监控服务编排
- `docker-compose.nebula.yml` - NebulaGraph服务编排
- `nebula-graphd.conf` - NebulaGraph图服务配置
- `docker-compose.qdrant.yml` - Qdrant服务编排


### 目录结构

执行docker命令前，确保以下目录结构完整(codebase-index即实际操作时的当前文件夹)：

```
/home/docker-compose/codebase-index
├── codebase-index
├── monitoring/
│   ├── alerts/
│   ├── grafana/
│   │   ├── dashboards/
│   │   └── provisioning/
│   │       ├── dashboards/
│   │       └── datasources/
│   ├── prometheus.yml
│   ├── alertmanager.yml
│   └── docker-compose.monitoring.yml
├── nebula/
│   ├── data/
│   │   ├── meta0/ meta1/ meta2/
│   │   └── storage0/ storage1/ storage2/
│   ├── logs/
│   │   ├── metad0/ metad1/ metad2/
│   │   ├── storaged0/ storaged1/ storaged2/
│   │   └── graphd/ console/
│   ├── docker-compose.yml
│   └── nebula-graphd.conf
└── qdrant/
    ├── storage/
    └── docker-compose.qdrant.yml
```


## 网络配置

所有服务使用统一的 `monitoring` 网络，确保服务间可以互相通信：

```bash
# 创建共享网络（如果尚未存在）
docker network create monitoring
```

## 服务部署顺序

### 1. 首先启动 NebulaGraph 服务

```bash
cd /home/docker-compose/codebase-index/nebula
docker-compose -f docker-compose.nebula.yml up -d
```

**等待 NebulaGraph 初始化**（约1-2分钟）：
```bash
# 检查服务状态
docker-compose -f docker-compose.nebula.yml ps
```

增加hosts配置
在Windows PowerShell中执行以下命令来添加存储节点到NebulaGraph集群：
```powershell
# 在宿主机执行nebula-console命令
nebula-console -u root -p nebula --address=127.0.0.1 --port=9669
```

```nebula console
ADD HOSTS "storaged0":9779,"storaged1":9779,"storaged2":9779;
```

**说明**：
- 该命令在宿主机（Windows）上执行，而不是在WSL中
- 添加三个存储节点(storaged0, storaged1, storaged2)到NebulaGraph集群(视实际情况修改)
- 每个存储节点监听端口9779

# 验证连接
```powershell
nebula-console -u root -p nebula --address=127.0.0.1 --port=9669 -e "SHOW HOSTS"
```

# 查看存储节点日志
```bash
docker-compose -f docker-compose.nebula.yml logs storaged0
```
现在看不到，因为存储节点的日志没有发送到stdout。自己到wsl的logs目录里看

### 2. 然后启动 Qdrant 服务

```bash
cd /home/docker-compose/codebase-index/qdrant
docker-compose -f docker-compose.qdrant.yml up -d
```

**验证 Qdrant 服务**：
宿主机：
```powershell
curl http://127.0.0.1:6333/healthz
curl http://127.0.0.1:6333/metrics
```

### 3. 最后启动监控服务

```bash
cd /home/docker-compose/codebase-index/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

**验证监控服务**：
```bash
docker ps | grep -E "(prometheus|alertmanager|grafana)"
curl http://localhost:9090/status  # Prometheus
curl http://localhost:9093         # Alertmanager
curl http://localhost:3000         # Grafana
```

## 服务访问信息

| 服务 | 访问地址 | 默认端口 | 备注 |
|------|---------|---------|------|
| Prometheus | http://localhost:9090 | 9090 | 监控数据收集 |
| Alertmanager | http://localhost:9093 | 9093 | 告警管理 |
| Grafana | http://localhost:3000 | 3000 | 监控仪表板 |
| NebulaGraph | nebula://localhost:9669 | 9669 | 图数据库服务 |
| Nebula HTTP | http://localhost:19669 | 19669 | 图数据库监控 |
| Qdrant HTTP | http://localhost:6333 | 6333 | 向量数据库API |
| Qdrant gRPC | localhost:6334 | 6334 | 向量数据库gRPC |

## 服务管理命令

### 查看所有服务状态

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(prometheus|alertmanager|grafana|nebula|qdrant)"
```

### 停止所有服务

```bash
# 按启动顺序逆序停止
cd /home/docker-compose/codebase-index/monitoring && docker-compose -f docker-compose.monitoring.yml down
cd /home/docker-compose/codebase-index/qdrant && docker-compose down
cd /home/docker-compose/codebase-index/nebula && docker-compose down
```

### 重启特定服务

```bash
# 重启NebulaGraph
cd /home/docker-compose/codebase-index/nebula
docker-compose restart

# 重启监控服务
cd /home/docker-compose/codebase-index/monitoring
docker-compose -f docker-compose.monitoring.yml restart
```

## 故障排除

### 常见问题

1. **端口冲突**：
   ```bash
   # 检查端口占用
   netstat -tulpn | grep -E "(9090|9093|3000|9669|6333)"
   
   # 修改docker-compose文件中的端口映射
   ```

2. **权限问题**：
   ```bash
   # 确保Docker服务运行
   sudo service docker start
   
   # 将用户添加到docker组
   sudo usermod -aG docker $USER
   ```

3. **网络问题**：
   ```bash
   # 检查网络是否存在
   docker network ls | grep monitoring
   
   # 创建网络（如果不存在）
   docker network create monitoring
   ```

4. **WSL特定问题**：
   ```bash
   # 重启WSL
   wsl --shutdown
   
   # 重启Docker Desktop
   ```

### 日志查看

```bash
# 查看所有服务日志
cd /home/docker-compose/codebase-index/monitoring && docker-compose logs
cd /home/docker-compose/codebase-index/nebula && docker-compose logs
cd /home/docker-compose/codebase-index/qdrant && docker-compose logs

# 查看特定服务日志
docker logs prometheus
docker logs graphd
docker logs qdrant
```

## 数据持久化

所有数据都配置了持久化存储：
- **监控数据**：存储在Docker volumes中
- **NebulaGraph数据**：存储在本地目录 `/home/docker-compose/codebase-index/nebula/data/`
- **Qdrant数据**：存储在本地目录 `/home/docker-compose/codebase-index/qdrant/storage/`

## 备份和恢复

### 备份数据

```bash
# 备份NebulaGraph数据（在容器内执行）
docker exec -it graphd bash
nebula> CREATE SNAPSHOT;

# 备份Qdrant数据（复制存储目录）
cp -r /home/docker-compose/codebase-index/qdrant/storage/ /backup/qdrant-backup/
```

### 恢复数据

```bash
# 恢复NebulaGraph数据
docker exec -it graphd bash
nebula> RESTORE SNAPSHOT your_snapshot;

# 恢复Qdrant数据
cp -r /backup/qdrant-backup/ /home/docker-compose/codebase-index/qdrant/storage/
```

## 性能优化建议

1. **资源配置**：根据系统资源调整容器资源限制
2. **存储优化**：使用SSD存储提高IO性能
3. **网络优化**：确保WSL2网络性能良好
4. **内存分配**：为每个服务分配适当的内存限制

## 安全注意事项

1. **修改默认凭证**：Grafana使用默认的admin/admin，生产环境应立即修改
2. **网络隔离**：服务运行在独立的监控网络中
3. **文件权限**：确保配置文件具有适当的权限
4. **定期更新**：保持Docker镜像和系统更新到最新版本



## 附录
### 手动设置目录结构（可选）

如果您希望手动操作，可以按以下步骤执行：

```bash
# 进入codebase-index目录
cd /home/docker-compose/codebase-index

# 创建目录结构
mkdir -p monitoring/{alerts,grafana/{dashboards,provisioning/{dashboards,datasources}}}
mkdir -p nebula/{data/{meta0,meta1,meta2,storage0,storage1,storage2},logs/{metad0,metad1,metad2,storaged0,storaged1,storaged2,graphd,console}}
mkdir -p qdrant/storage

# 移动现有的配置文件到正确位置
# 监控配置文件
mv prometheus.yml monitoring/ 2>/dev/null || echo "prometheus.yml 不存在"
mv alertmanager.yml monitoring/ 2>/dev/null || echo "alertmanager.yml 不存在"
mv docker-compose.monitoring.yml monitoring/ 2>/dev/null || echo "docker-compose.monitoring.yml 不存在"

# 如果存在grafana目录，移动其内容
if [ -d "grafana" ]; then
    mv grafana/* monitoring/grafana/
    rmdir grafana
fi

# NebulaGraph配置文件
mv docker-compose.nebula.yml nebula/ 2>/dev/null || echo "docker-compose.nebula.yml 不存在"
mv nebula-graphd.conf nebula/ 2>/dev/null || echo "nebula-graphd.conf 不存在"

# Qdrant配置文件
mv docker-compose.qdrant.yml qdrant/ 2>/dev/null || echo "docker-compose.qdrant.yml 不存在"

# 设置文件权限
chmod -R 755 monitoring/ nebula/ qdrant/
find monitoring/ -name "*.yml" -o -name "*.yaml" -o -name "*.json" | xargs chmod 644 2>/dev/null || true
find nebula/ -name "*.yml" -o -name "*.conf" | xargs chmod 644 2>/dev/null || true
find qdrant/ -name "*.yml" | xargs chmod 644 2>/dev/null || true
```