# Monitoring Stack WSL 部署指南

本文档介绍如何在 Windows Subsystem for Linux (WSL) 环境中部署 Prometheus、Alertmanager 和 Grafana 监控栈。

## 先决条件

1. 已安装 WSL2 和 Linux 发行版（如 Ubuntu）
2. 已安装 Docker Desktop for Windows 并启用 WSL2 集成
3. 已安装 Docker Compose

## 目录结构

确保项目具有以下目录结构：

```
/home/share/monitoring
├── docker-compose.monitoring.yml
├── monitoring/
│   ├── prometheus.yml
│   ├── alertmanager.yml
│   ├── alerts/
│   │   └── codebase-index-alerts.yml
│   └── grafana/
│       ├── dashboards/
│       │   └── codebase-index-dashboard.json
│       └── provisioning/
│           ├── dashboards/
│           │   └── codebase-index.yaml
│           └── datasources/
│               └── prometheus.yaml
```

## 自动化设置脚本

创建以下脚本来自动建立正确的目录结构：
```bash
cd /home/share
touch setup-monitoring.sh
vi setup-monitoring.sh
```

```bash
#!/bin/bash

# setup-monitoring.sh - 创建监控栈所需的目录结构
cd /home/share
mkdir monitoring && cd monitoring

echo "Setting up monitoring directory structure..."

# 创建监控目录结构
mkdir -p monitoring/alerts
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/provisioning/datasources

echo "Directory structure created:"
echo "monitoring/"
echo "├── alerts/"
echo "└── grafana/"
echo "    ├── dashboards/"
echo "    └── provisioning/"
echo "        ├── dashboards/"
echo "        └── datasources/"

echo ""
echo "Next steps:"
echo "1. Ensure docker-compose.monitoring.yml is in the project root"
echo "2. Copy your configuration files to the appropriate directories:"
echo "   - monitoring/prometheus.yml"
echo "   - monitoring/alertmanager.yml"
echo "   - monitoring/alerts/*.yml"
echo "   - monitoring/grafana/dashboards/*.json"
```

```bash
chmod 777 setup-monitoring.sh
./setup-monitoring.sh
cd monitoring
touch docker-compose.monitoring.yml
vi docker-compose.monitoring.yml
docker-compose up -d
```

## 启动监控栈

```bash
# 启动所有服务
docker-compose -f docker-compose.monitoring.yml up -d

# 查看服务状态
docker-compose -f docker-compose.monitoring.yml ps

# 查看日志
docker-compose -f docker-compose.monitoring.yml logs -f
```

## 验证部署

```bash
# 检查容器状态
docker ps | grep -E "(prometheus|alertmanager|grafana)"

# 验证 Prometheus 是否运行
curl http://localhost:9090/status

# 验证 Alertmanager 是否运行
curl http://localhost:9093

# 验证 Grafana 是否运行
curl http://localhost:3000
```

## 访问服务

- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Grafana**: http://localhost:3000
  - 默认用户名: `admin`
  - 默认密码: `admin`

## 停止和清理

```bash
# 停止所有服务
docker-compose -f docker-compose.monitoring.yml down

# 停止并删除卷（会丢失数据）
docker-compose -f docker-compose.monitoring.yml down -v

# 仅删除容器，保留卷
docker-compose -f docker-compose.monitoring.yml down --remove-orphans
```

## 故障排除

### 常见问题

1. **权限问题**
   ```bash
   # 确保 Docker 服务正在运行
   sudo service docker start
   
   # 将用户添加到 docker 组
   sudo usermod -aG docker $USER
   ```

2. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep -E "(9090|9093|3000)"
   
   # 修改 docker-compose 文件中的端口映射
   ```

3. **卷挂载问题**
   ```bash
   # 检查目录权限
   ls -la monitoring/
   
   # 确保配置文件存在
   ls -la monitoring/prometheus.yml
   ls -la monitoring/alertmanager.yml
   ```

4. **WSL 特定问题**
   ```bash
   # 重启 WSL
   wsl --shutdown
   
   # 在 PowerShell 中重启 Docker Desktop
   ```

### 日志查看

```bash
# 查看所有服务日志
docker-compose -f docker-compose.monitoring.yml logs

# 查看特定服务日志
docker-compose -f docker-compose.monitoring.yml logs prometheus
docker-compose -f docker-compose.monitoring.yml logs alertmanager
docker-compose -f docker-compose.monitoring.yml logs grafana

# 实时跟踪日志
docker-compose -f docker-compose.monitoring.yml logs -f
```

## 安全注意事项

1. **默认凭证**: Grafana 使用默认的 `admin/admin` 凭证，生产环境中应立即修改
2. **网络隔离**: 服务运行在独立的 `monitoring` 网络中，提供基本隔离
3. **文件权限**: 确保配置文件具有适当的权限，避免敏感信息泄露
echo "   - monitoring/grafana/provisioning/dashboards/*.yaml"
echo "   - monitoring/grafana/provisioning/datasources/*.yaml"
echo ""
echo "3. Run the monitoring stack with:"
echo "   docker-compose -f docker-compose.monitoring.yml up -d"