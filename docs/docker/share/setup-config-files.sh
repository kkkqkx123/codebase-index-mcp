#!/bin/bash

# WSL Docker 配置文件设置脚本
# 该脚本用于在share目录内部创建目录结构并设置文件权限
# 假设当前目录为 /home/docker-compose/codebase-index/share

set -e  # 遇到错误立即退出

echo "=== WSL Docker 配置文件设置脚本 ==="
echo "当前工作目录: $(pwd)"
echo "开始配置代码库索引系统的目录结构和权限..."

# 当前目录就是share目录
SHARE_DIR="$(pwd)"

echo "=== 创建目录结构 ==="

# 创建monitoring目录结构
mkdir -p monitoring/alerts
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/provisioning/datasources

echo "✓ monitoring目录结构创建完成"

# 创建nebula目录结构
echo "=== 创建NebulaGraph目录结构 ==="
mkdir -p nebula/data/{meta0,meta1,meta2,storage0,storage1,storage2}
mkdir -p nebula/logs/{metad0,metad1,metad2,storaged0,storaged1,storaged2,graphd,console}

echo "✓ nebula目录结构创建完成"

# 创建qdrant目录结构
echo "=== 创建Qdrant目录结构 ==="
mkdir -p qdrant/storage

echo "✓ qdrant目录结构创建完成"

# 检查并移动现有配置文件
echo "=== 检查现有配置文件 ==="

# 检查monitoring目录中的文件
if [ -f "prometheus.yml" ]; then
    mv prometheus.yml monitoring/
    echo "✓ prometheus.yml 已移动到 monitoring/"
fi

if [ -f "alertmanager.yml" ]; then
    mv alertmanager.yml monitoring/
    echo "✓ alertmanager.yml 已移动到 monitoring/"
fi

if [ -f "docker-compose.monitoring.yml" ]; then
    mv docker-compose.monitoring.yml monitoring/
    echo "✓ docker-compose.monitoring.yml 已移动到 monitoring/"
fi

if [ -d "grafana" ]; then
    mv grafana/* monitoring/grafana/
    rmdir grafana
    echo "✓ grafana配置已移动到 monitoring/grafana/"
fi

# 检查nebula目录中的文件
echo "=== 检查NebulaGraph配置文件 ==="

if [ -f "docker-compose.nebula.yml" ]; then
    mv docker-compose.nebula.yml nebula/
    echo "✓ docker-compose.nebula.yml 已移动到 nebula/"
fi

if [ -f "nebula-graphd.conf" ]; then
    mv nebula-graphd.conf nebula/
    echo "✓ nebula-graphd.conf 已移动到 nebula/"
fi

# 检查qdrant目录中的文件
if [ -f "docker-compose.qdrant.yml" ]; then
    mv docker-compose.qdrant.yml qdrant/
    echo "✓ docker-compose.qdrant.yml 已移动到 qdrant/"
fi

# 设置文件权限
echo "=== 设置文件权限 ==="

echo "正在设置监控配置文件权限..."
chmod -R 755 monitoring/
find monitoring/ -name "*.yml" -o -name "*.yaml" -o -name "*.json" | xargs chmod 644 2>/dev/null || true

echo "正在设置NebulaGraph配置文件权限..."
chmod -R 755 nebula/
find nebula/ -name "*.yml" -o -name "*.conf" | xargs chmod 644 2>/dev/null || true

# 设置数据目录权限
chmod -R 755 nebula/data/* 2>/dev/null || true
chmod -R 755 nebula/logs/* 2>/dev/null || true

echo "正在设置Qdrant配置文件权限..."
chmod -R 755 qdrant/
find qdrant/ -name "*.yml" | xargs chmod 644 2>/dev/null || true
chmod -R 755 qdrant/storage/ 2>/dev/null || true

echo "✓ 所有文件权限设置完成"

# 验证配置完整性
echo "=== 验证配置完整性 ==="
echo "检查目录结构:"
find . -type d -name "monitoring" -o -name "nebula" -o -name "qdrant" | head -10

echo ""
echo "检查配置文件:"
ls -la monitoring/ 2>/dev/null || echo "monitoring目录为空"
ls -la nebula/ 2>/dev/null || echo "nebula目录为空"
ls -la qdrant/ 2>/dev/null || echo "qdrant目录为空"

echo ""
echo "=== 配置完成 ==="
echo "所有目录结构和权限已设置完成"
echo "当前目录: $SHARE_DIR"
echo ""
echo "目录结构概览:"
tree -L 3 . 2>/dev/null || find . -type d | head -20