# NebulaGraph服务状态检查脚本

$ErrorActionPreference = "Stop"

# 设置工作目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
$dockerComposeDir = Join-Path $projectRoot "docs\docker\codebase-index"

Write-Host "🔍 检查NebulaGraph服务状态..." -ForegroundColor Cyan

# 检查Docker是否运行
try {
    docker info *>$null
} catch {
    Write-Host "❌ Docker未运行" -ForegroundColor Red
    exit 1
}

function Get-ServiceStatus {
    param($ComposeFile, $ServiceName)
    
    Push-Location $dockerComposeDir
    try {
        $status = docker-compose -f $ComposeFile ps --services --filter "status=running" | Where-Object { $_ -eq $ServiceName }
        return [bool]$status
    } finally {
        Pop-Location
    }
}

function Test-Endpoint {
    param($Url, $Timeout = 5)
    
    try {
        $request = [System.Net.WebRequest]::Create($Url)
        $request.Timeout = $Timeout * 1000
        $response = $request.GetResponse()
        $response.Close()
        return $true
    } catch {
        return $false
    }
}

# 检查NebulaGraph服务
Write-Host ""
Write-Host "🐳 NebulaGraph服务:" -ForegroundColor Yellow

$nebulaServices = @(
    @{Name="graphd"; ComposeFile="nebula\docker-compose.nebula.yml"},
    @{Name="metad0"; ComposeFile="nebula\docker-compose.nebula.yml"},
    @{Name="storaged0"; ComposeFile="nebula\docker-compose.nebula.yml"},
    @{Name="nebula-stats-exporter"; ComposeFile="nebula\docker-compose.nebula.yml"}
)

foreach ($service in $nebulaServices) {
    $isRunning = Get-ServiceStatus $service.ComposeFile $service.Name
    $status = if ($isRunning) { "✅ 运行中" } else { "❌ 未运行" }
    Write-Host "  $($service.Name.PadRight(20)) $status" -ForegroundColor $(if ($isRunning) { "Green" } else { "Red" })
}

# 检查监控服务
Write-Host ""
Write-Host "📊 监控服务:" -ForegroundColor Yellow

$monitoringServices = @(
    @{Name="prometheus"; ComposeFile="monitoring\docker-compose.monitoring.yml"; Url="http://localhost:9090"},
    @{Name="grafana"; ComposeFile="monitoring\docker-compose.monitoring.yml"; Url="http://localhost:3000"},
    @{Name="alertmanager"; ComposeFile="monitoring\docker-compose.monitoring.yml"; Url="http://localhost:9093"}
)

foreach ($service in $monitoringServices) {
    $isRunning = Get-ServiceStatus $service.ComposeFile $service.Name
    $isAccessible = if ($isRunning -and $service.Url) { Test-Endpoint $service.Url } else { $false }
    
    $status = if ($isRunning) { 
        if ($isAccessible) { "✅ 运行中 (可访问)" } else { "⚠️  运行中 (不可访问)" }
    } else { 
        "❌ 未运行" 
    }
    
    Write-Host "  $($service.Name.PadRight(20)) $status" -ForegroundColor $(if ($isAccessible) { "Green" } elseif ($isRunning) { "Yellow" } else { "Red" })
}

# 检查网络连接
Write-Host ""
Write-Host "🌐 网络检查:" -ForegroundColor Yellow

$endpoints = @(
    @{Name="NebulaGraph Graphd"; Url="http://localhost:9669"},
    @{Name="Nebula Stats Exporter"; Url="http://localhost:9100/metrics"},
    @{Name="Prometheus"; Url="http://localhost:9090"},
    @{Name="Grafana"; Url="http://localhost:3000"}
)

foreach ($endpoint in $endpoints) {
    $isAccessible = Test-Endpoint $endpoint.Url 3
    $status = if ($isAccessible) { "✅ 可访问" } else { "❌ 不可访问" }
    Write-Host "  $($endpoint.Name.PadRight(25)) $status" -ForegroundColor $(if ($isAccessible) { "Green" } else { "Red" })
}

Write-Host ""
Write-Host "📋 使用说明:" -ForegroundColor Cyan
Write-Host "  启动服务: .\scripts\start-nebula-monitoring.ps1" -ForegroundColor Gray
Write-Host "  停止服务: .\scripts\stop-nebula-monitoring.ps1" -ForegroundColor Gray
Write-Host "  查看状态: .\scripts\check-nebula-status.ps1" -ForegroundColor Gray
Write-Host ""