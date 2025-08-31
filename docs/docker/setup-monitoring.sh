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

## 启动监控栈

```bash
# 启动所有服务
docker-compose -f docker-compose.monitoring.yml up -d

# 查看服务状态
docker-compose -f docker-compose.monitoring.yml ps

# 查看日志
docker-compose -f docker-compose.monitoring.yml logs -f