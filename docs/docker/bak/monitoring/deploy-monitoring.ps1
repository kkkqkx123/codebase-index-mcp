#!/usr/bin/env pwsh

# 监控部署脚本
param(
    [string]$Action = "start",
    [string]$Environment = "development"
)

Write-Host "🚀 开始部署监控组件..." -ForegroundColor Green

# 检查Docker是否可用
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker未安装或未在PATH中" -ForegroundColor Red
    exit 1
}

# 检查配置文件是否存在
$requiredFiles = @(
    "prometheus.yml",
    "alerts/semgrep-alerts.yml",
    "alerts/treesitter-alerts.yml",
    "grafana/dashboards/semgrep-dashboard.json",
    "grafana/dashboards/treesitter-dashboard.json",
    "grafana/provisioning/datasources/prometheus.yml",
    "grafana/provisioning/dashboards/dashboards.yml",
    "docker-compose.monitoring.yml"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ 缺少配置文件:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

# 验证配置文件格式
Write-Host "🔍 验证配置文件格式..." -ForegroundColor Yellow

# 验证Prometheus配置
try {
    docker run --rm -v "${PWD}/prometheus.yml:/etc/prometheus/prometheus.yml" prom/prometheus:latest promtool check config /etc/prometheus/prometheus.yml
    Write-Host "✅ Prometheus配置验证通过" -ForegroundColor Green
} catch {
    Write-Host "❌ Prometheus配置验证失败" -ForegroundColor Red
    exit 1
}

# 验证告警规则
try {
    docker run --rm -v "${PWD}/alerts:/etc/prometheus/alerts" prom/prometheus:latest promtool check rules /etc/prometheus/alerts/semgrep-alerts.yml
    docker run --rm -v "${PWD}/alerts:/etc/prometheus/alerts" prom/prometheus:latest promtool check rules /etc/prometheus/alerts/treesitter-alerts.yml
    Write-Host "✅ 告警规则验证通过" -ForegroundColor Green
} catch {
    Write-Host "❌ 告警规则验证失败" -ForegroundColor Red
    exit 1
}

switch ($Action.ToLower()) {
    "start" {
        Write-Host "🚀 启动监控服务..." -ForegroundColor Green
        docker-compose -f docker-compose.monitoring.yml up -d
        
        Write-Host "⏳ 等待服务启动..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        # 检查服务状态
        $services = @("prometheus", "grafana", "alertmanager")
        foreach ($service in $services) {
            $status = docker ps --filter "name=codebase-index-$service" --format "{{.Status}}"
            if ($status -like "Up*") {
                Write-Host "✅ $service 服务已启动" -ForegroundColor Green
            } else {
                Write-Host "❌ $service 服务启动失败" -ForegroundColor Red
            }
        }
        
        Write-Host ""
        Write-Host "📊 监控服务已启动:" -ForegroundColor Green
        Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor Cyan
        Write-Host "  - Grafana: http://localhost:3001 (admin/admin123)" -ForegroundColor Cyan
        Write-Host "  - Alertmanager: http://localhost:9093" -ForegroundColor Cyan
    }
    
    "stop" {
        Write-Host "🛑 停止监控服务..." -ForegroundColor Yellow
        docker-compose -f docker-compose.monitoring.yml down
        Write-Host "✅ 监控服务已停止" -ForegroundColor Green
    }
    
    "restart" {
        Write-Host "🔄 重启监控服务..." -ForegroundColor Yellow
        docker-compose -f docker-compose.monitoring.yml restart
        Write-Host "✅ 监控服务已重启" -ForegroundColor Green
    }
    
    "status" {
        Write-Host "📊 监控服务状态:" -ForegroundColor Green
        docker-compose -f docker-compose.monitoring.yml ps
    }
    
    "logs" {
        Write-Host "📋 查看监控服务日志..." -ForegroundColor Yellow
        docker-compose -f docker-compose.monitoring.yml logs -f
    }
    
    default {
        Write-Host "❌ 无效的操作: $Action" -ForegroundColor Red
        Write-Host "可用操作: start, stop, restart, status, logs" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "💡 使用说明:" -ForegroundColor Yellow
Write-Host "  1. 确保你的应用服务正在运行并暴露指标端点" -ForegroundColor White
Write-Host "  2. 在浏览器中访问上述URL查看监控数据" -ForegroundColor White
Write-Host "  3. 配置告警规则以接收通知" -ForegroundColor White
Write-Host ""
Write-Host "🔧 故障排除:" -ForegroundColor Yellow
Write-Host "  - 检查服务状态: ./deploy-monitoring.ps1 status" -ForegroundColor White
Write-Host "  - 查看日志: ./deploy-monitoring.ps1 logs" -ForegroundColor White
Write-Host "  - 重新部署: ./deploy-monitoring.ps1 restart" -ForegroundColor White