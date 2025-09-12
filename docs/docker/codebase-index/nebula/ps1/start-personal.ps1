# NebulaGraph个人版启动脚本
# 专为个人开发者优化的单节点配置

param(
    [switch]$Detach,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
NebulaGraph个人版启动脚本

使用方法:
    .\start-personal.ps1          # 前台启动
    .\start-personal.ps1 -Detach  # 后台启动
    .\start-personal.ps1 -Help    # 显示帮助

功能:
    - 单节点NebulaGraph（替代7节点集群）
    - 内存占用从4-8GB降至512MB-2GB
    - 启动时间从60-90秒降至10-15秒
    - 专为个人代码库索引优化

访问地址:
    - Graph服务: localhost:9669
    - HTTP监控: localhost:19669
    - 导出器: localhost:9101
"@
    exit
}

# 设置颜色输出
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

Write-Host "${Green}🚀 启动NebulaGraph个人版...${Reset}" -ForegroundColor Green

# 创建必要的目录
$directories = @("nebula-data", "nebula-logs")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "${Yellow}📁 创建目录: $dir${Reset}" -ForegroundColor Yellow
    }
}

# 检查Docker是否运行
try {
    docker info | Out-Null
} catch {
    Write-Host "${Red}❌ Docker未运行，请先启动Docker${Reset}" -ForegroundColor Red
    exit 1
}

# 检查配置文件
$configFiles = @("personal-nebula.conf", "nebula-stats-exporter-personal.yaml")
foreach ($file in $configFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "${Red}❌ 缺少配置文件: $file${Reset}" -ForegroundColor Red
        exit 1
    }
}

# 启动服务
Write-Host "${Green}🐳 启动Docker容器...${Reset}" -ForegroundColor Green

if ($Detach) {
    docker-compose -f docker-compose.personal.yml up -d
} else {
    docker-compose -f docker-compose.personal.yml up
}

# 等待服务启动（仅后台模式）
if ($Detach) {
    Write-Host "${Yellow}⏳ 等待服务启动...${Reset}" -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    # 检查服务状态
    $attempts = 0
    $maxAttempts = 5
    $serviceUp = $false

    while ($attempts -lt $maxAttempts -and -not $serviceUp) {
        try {
            $result = docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW HOSTS;" 2>$null
            if ($result -match "nebula-personal") {
                $serviceUp = $true
                Write-Host "${Green}✅ NebulaGraph个人版启动成功！${Reset}" -ForegroundColor Green
                Write-Host "${Green}📊 访问地址:${Reset}"
                Write-Host "  - Graph服务: ${Yellow}localhost:9669${Reset}"
                Write-Host "  - HTTP监控: ${Yellow}localhost:19669${Reset}"
                Write-Host "  - 导出器: ${Yellow}localhost:9101${Reset}"
            }
        } catch {
            $attempts++
            if ($attempts -lt $maxAttempts) {
                Write-Host "${Yellow}⏳ 等待服务就绪... ($attempts/$maxAttempts)${Reset}" -ForegroundColor Yellow
                Start-Sleep -Seconds 5
            }
        }
    }

    if (-not $serviceUp) {
        Write-Host "${Red}⚠️  服务启动可能遇到问题，请检查日志${Reset}" -ForegroundColor Red
        docker-compose -f docker-compose.personal.yml logs
    }
}