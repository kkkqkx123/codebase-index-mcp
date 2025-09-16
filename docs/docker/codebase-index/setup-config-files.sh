#!/bin/bash

# WSL Docker 配置文件设置脚本
# 该脚本用于在codebase-index目录创建目录结构并设置文件权限

set -e  # 遇到错误立即退出

echo "=== WSL Docker 配置文件设置脚本 ==="
echo "当前工作目录: $(pwd)"
echo "开始配置代码库索引系统的目录结构和权限..."

# 验证当前目录结构
CURRENT_DIR="$(pwd)"
BASE_DIR_NAME=$(basename "$CURRENT_DIR")

if [ "$BASE_DIR_NAME" != "codebase-index" ] && [ "$BASE_DIR_NAME" != "docker" ]; then
    echo "警告: 当前目录不是预期的codebase-index或docker目录"
    echo "当前目录: $CURRENT_DIR"
    echo "建议切换到正确的目录后重新运行脚本"
fi

echo "=== 验证基础目录结构 ==="
if [ ! -d "nebula" ] || [ ! -d "monitoring" ]; then
    echo "错误: 缺少必需的目录结构"
    echo "请确保在包含nebula和monitoring目录的父目录中运行此脚本"
    exit 1
fi

echo "=== 创建目录结构 ==="

# 创建monitoring目录结构
echo "正在创建monitoring目录结构..."
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/provisioning/datasources

echo "✓ monitoring目录结构创建完成"

# 创建nebula目录结构
echo "=== 创建NebulaGraph目录结构 ==="
echo "正在创建数据目录..."
mkdir -p nebula/data/{meta0,meta1,meta2,storage0,storage1,storage2}

echo "正在创建日志目录..."
mkdir -p nebula/logs/{metad0,metad1,metad2,storaged0,storaged1,storaged2,graphd,console}

# 确保graphd日志目录存在（Docker挂载必需）
if [ ! -d "nebula/logs/graphd" ]; then
    echo "错误: graphd日志目录创建失败"
    exit 1
fi

echo "✓ nebula目录结构创建完成"

# 创建qdrant目录结构
# 现在使用127.0.0.1的qdrant，故跳过

# 检查并移动现有配置文件
echo "=== 检查现有配置文件 ==="

# 设置文件权限
echo "=== 设置文件权限 ==="

echo "正在设置监控配置文件权限..."
if [ -d "monitoring" ]; then
    chmod -R 755 monitoring/
    find monitoring/ -name "*.yml" -o -name "*.yaml" -o -name "*.json" 2>/dev/null | xargs chmod 644 2>/dev/null || true
fi

echo "正在设置NebulaGraph配置文件权限..."
if [ -d "nebula" ]; then
    chmod -R 755 nebula/
    find nebula/ -name "*.yml" -o -name "*.conf" -o -name "*.yaml" 2>/dev/null | xargs chmod 644 2>/dev/null || true
fi

# 设置数据目录权限
if [ -d "nebula/data" ]; then
    chmod -R 755 nebula/data/* 2>/dev/null || true
fi

if [ -d "nebula/logs" ]; then
    chmod -R 755 nebula/logs/* 2>/dev/null || true
fi

echo "✓ 所有文件权限设置完成"

# 验证配置完整性
echo "=== 验证配置完整性 ==="
echo "检查创建的目录结构:"

echo ""
echo "monitoring目录结构:"
if [ -d "monitoring" ]; then
    find monitoring/ -type d | sort
else
    echo "monitoring目录不存在"
fi

echo ""
echo "nebula目录结构:"
if [ -d "nebula" ]; then
    echo "数据目录:"
    find nebula/data/ -type d 2>/dev/null | sort || echo "无数据目录"
    echo "日志目录:"
    find nebula/logs/ -type d 2>/dev/null | sort || echo "无日志目录"
else
    echo "nebula目录不存在"
fi

echo ""
echo "检查关键目录权限:"
if [ -d "nebula/logs/graphd" ]; then
    echo "✓ graphd日志目录存在: $(ls -ld nebula/logs/graphd)"
else
    echo "✗ graphd日志目录不存在"
fi

echo ""
echo "=== 配置完成 ==="
echo "所有目录结构和权限已设置完成"
echo "当前目录: $CURRENT_DIR"
echo ""
echo "目录结构概览:"
if command -v tree >/dev/null 2>&1; then
    tree -L 3 . 2>/dev/null || find . -type d -name "*" | head -20
else
    find . -type d -name "*" | head -20
fi