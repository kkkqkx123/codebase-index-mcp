# NebulaGraph个人版停止脚本

param(
    [switch]$Clean,    # 同时清理数据
    [switch]$Help      # 显示帮助
)

if ($Help) {
    Write-Host @"
NebulaGraph个人版停止脚本

使用方法:
    .\stop-personal.ps1          # 仅停止服务
    .\stop-personal.ps1 -Clean    # 停止并清理数据
    .\stop-personal.ps1 -Help     # 显示帮助

注意:
    - 使用-Clean参数会删除所有数据，请谨慎使用！
"@
    exit
}

# 设置颜色输出
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

Write-Host "${Yellow}🛑 停止NebulaGraph个人版...${Reset}" -ForegroundColor Yellow

# 停止服务
docker-compose -f docker-compose.personal.yml down

if ($Clean) {
    Write-Host "${Red}🧹 清理数据和日志...${Reset}" -ForegroundColor Red
    
    # 询问确认
    $confirm = Read-Host "⚠️  这将删除所有NebulaGraph数据！是否继续？(y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        # 清理数据目录
        $directories = @("nebula-data", "nebula-logs")
        foreach ($dir in $directories) {
            if (Test-Path $dir) {
                Remove-Item -Path $dir -Recurse -Force
                Write-Host "${Green}✅ 已清理: $dir${Reset}" -ForegroundColor Green
            }
        }
        Write-Host "${Green}✅ 数据清理完成${Reset}" -ForegroundColor Green
    } else {
        Write-Host "${Yellow}🚫 取消清理操作${Reset}" -ForegroundColor Yellow
    }
} else {
    Write-Host "${Green}✅ 服务已停止（数据保留）${Reset}" -ForegroundColor Green
}

# 显示磁盘使用情况
$dockerSpace = docker system df 2>$null
if ($dockerSpace) {
    Write-Host "${Green}📊 Docker磁盘使用情况:${Reset}"
    $dockerSpace | ForEach-Object { Write-Host "  $_" }
}