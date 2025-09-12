# NebulaGraph个人版状态检查脚本

# 设置颜色输出
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Reset = "`e[0m"

Write-Host "${Blue}📊 NebulaGraph个人版状态检查${Reset}" -ForegroundColor Blue
Write-Host "======================================"

# 检查Docker容器状态
Write-Host "${Green}🐳 容器状态:${Reset}" -ForegroundColor Green
$containers = @("nebula-personal", "nebula-stats-exporter-personal")

foreach ($container in $containers) {
    try {
        $status = docker inspect -f "{{.State.Status}}" $container 2>$null
        if ($status -eq "running") {
            Write-Host "  ✅ $container: ${Green}运行中${Reset}" -ForegroundColor Green
            
            # 显示资源使用
            $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" $container 2>$null
            if ($stats) {
                Write-Host "     CPU: $($stats[1].Split()[1]) | 内存: $($stats[1].Split()[2]) $($stats[1].Split()[3])" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ❌ $container: ${Red}$status${Reset}" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ $container: ${Red}未找到${Reset}" -ForegroundColor Red
    }
}

# 检查端口占用
Write-Host "`n${Green}🔌 端口状态:${Reset}" -ForegroundColor Green
$ports = @(
    @{Port=9669; Service="Graph服务"},
    @{Port=19669; Service="HTTP监控"},
    @{Port=9101; Service="监控导出器"}
)

foreach ($portInfo in $ports) {
    $port = $portInfo.Port
    $service = $portInfo.Service
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($connection) {
            Write-Host "  ✅ 端口 $port ($service): ${Green}开放${Reset}" -ForegroundColor Green
        } else {
            Write-Host "  ❌ 端口 $port ($service): ${Red}关闭${Reset}" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❓ 端口 $port ($service): ${Yellow}无法检测${Reset}" -ForegroundColor Yellow
    }
}

# 检查Nebula服务健康状态
Write-Host "`n${Green}🏥 服务健康:${Reset}" -ForegroundColor Green
try {
    $result = docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW HOSTS;" 2>$null
    if ($result -match "nebula-personal") {
        Write-Host "  ✅ ${Green}NebulaGraph服务响应正常${Reset}" -ForegroundColor Green
        
        # 显示会话信息
        $sessions = docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW SESSIONS;" 2>$null
        if ($sessions -and $sessions.Count -gt 2) {
            $sessionCount = $sessions.Count - 2  # 减去表头
            Write-Host "  📊 活跃会话: ${Yellow}$sessionCount${Reset}" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ ${Red}NebulaGraph服务无响应${Reset}" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ ${Red}无法检查NebulaGraph服务状态${Reset}" -ForegroundColor Red
}

# 检查磁盘空间
Write-Host "`n${Green}💾 磁盘使用:${Reset}" -ForegroundColor Green
try {
    $dockerSpace = docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" 2>$null
    if ($dockerSpace) {
        Write-Host "  📊 Docker资源使用:" -ForegroundColor Gray
        foreach ($line in $dockerSpace[1..($dockerSpace.Count-1)]) {
            Write-Host "    $line" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❓ ${Yellow}无法获取Docker磁盘使用信息${Reset}" -ForegroundColor Yellow
}

# 显示使用说明
Write-Host "`n${Blue}📋 使用说明:${Reset}" -ForegroundColor Blue
Write-Host "  - 启动: .\start-personal.ps1"
Write-Host "  - 停止: .\stop-personal.ps1"
Write-Host "  - 清理: .\stop-personal.ps1 -Clean"
Write-Host "  - 连接: nebula-console -u root -p nebula --address=localhost --port=9669"