# NebulaGraph监控服务启动脚本
# 用于启动NebulaGraph数据库和监控组件

param(
    [switch]$Build = $false,
    [switch]$Detach = $false
)

$ErrorActionPreference = "Stop"

# 设置工作目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
$dockerComposeDir = Join-Path $projectRoot "docs\docker\codebase-index"

Write-Host "🚀 启动NebulaGraph监控服务..." -ForegroundColor Green

# 检查Docker是否运行
try {
    docker info *>$null
} catch {
    Write-Host "❌ Docker未运行，请先启动Docker服务" -ForegroundColor Red
    exit 1
}

# 检查监控网络是否存在
$networkExists = docker network ls --filter "name=monitoring" --format "{{.Name}}"
if (-not $networkExists) {
    Write-Host "📦 创建监控网络..." -ForegroundColor Yellow
    docker network create monitoring
}

# 切换到Docker Compose目录
Push-Location $dockerComposeDir

try {
    # 启动NebulaGraph服务
    Write-Host "🐳 启动NebulaGraph数据库..." -ForegroundColor Cyan
    $nebulaArgs = @("-f", "nebula\docker-compose.nebula.yml")
    if ($Build) {
        $nebulaArgs += "--build"
    }
    if ($Detach) {
        $nebulaArgs += "-d"
    }
    $nebulaArgs += "up"
    
    Write-Host "执行命令: docker-compose $nebulaArgs" -ForegroundColor Gray
    docker-compose $nebulaArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ NebulaGraph启动失败" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    
    Write-Host "✅ NebulaGraph启动成功" -ForegroundColor Green
    
    # 等待NebulaGraph完全启动
    Write-Host "⏳ 等待NebulaGraph服务就绪..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # 启动监控服务
    Write-Host "📊 启动监控服务..." -ForegroundColor Cyan
    $monitoringArgs = @("-f", "monitoring\docker-compose.monitoring.yml")
    if ($Build) {
        $monitoringArgs += "--build"
    }
    if ($Detach) {
        $monitoringArgs += "-d"
    }
    $monitoringArgs += "up"
    
    Write-Host "执行命令: docker-compose $monitoringArgs" -ForegroundColor Gray
    docker-compose $monitoringArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 监控服务启动失败" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    
    Write-Host "✅ 监控服务启动成功" -ForegroundColor Green
    
    # 显示服务信息
    Write-Host ""
    Write-Host "🎉 NebulaGraph监控服务已启动" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Gray
    Write-Host "NebulaGraph Graphd:     http://localhost:9669" -ForegroundColor Cyan
    Write-Host "Prometheus:            http://localhost:9090" -ForegroundColor Cyan
    Write-Host "Grafana:               http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Alertmanager:          http://localhost:9093" -ForegroundColor Cyan
    Write-Host "Nebula Stats Exporter: http://localhost:9100" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 默认凭据:" -ForegroundColor Yellow
    Write-Host "NebulaGraph: root/nebula" -ForegroundColor Gray
    Write-Host "Grafana: admin/admin" -ForegroundColor Gray
    Write-Host ""
    
} finally {
    Pop-Location
}

Write-Host "✅ 所有服务启动完成" -ForegroundColor Green