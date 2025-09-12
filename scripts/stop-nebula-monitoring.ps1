# NebulaGraph监控服务停止脚本

param(
    [switch]$RemoveVolumes = $false
)

$ErrorActionPreference = "Stop"

# 设置工作目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
$dockerComposeDir = Join-Path $projectRoot "docs\docker\codebase-index"

Write-Host "🛑 停止NebulaGraph监控服务..." -ForegroundColor Yellow

# 检查Docker是否运行
try {
    docker info *>$null
} catch {
    Write-Host "❌ Docker未运行" -ForegroundColor Red
    exit 1
}

# 切换到Docker Compose目录
Push-Location $dockerComposeDir

try {
    # 停止监控服务
    Write-Host "📊 停止监控服务..." -ForegroundColor Cyan
    $monitoringArgs = @("-f", "monitoring\docker-compose.monitoring.yml", "down")
    if ($RemoveVolumes) {
        $monitoringArgs += "-v"
    }
    
    Write-Host "执行命令: docker-compose $monitoringArgs" -ForegroundColor Gray
    docker-compose $monitoringArgs
    
    # 停止NebulaGraph服务
    Write-Host "🐳 停止NebulaGraph数据库..." -ForegroundColor Cyan
    $nebulaArgs = @("-f", "nebula\docker-compose.nebula.yml", "down")
    if ($RemoveVolumes) {
        $nebulaArgs += "-v"
    }
    
    Write-Host "执行命令: docker-compose $nebulaArgs" -ForegroundColor Gray
    docker-compose $nebulaArgs
    
    Write-Host "✅ 所有服务已停止" -ForegroundColor Green
    
} finally {
    Pop-Location
}