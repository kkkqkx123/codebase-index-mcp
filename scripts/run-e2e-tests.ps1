# 端到端测试运行脚本
Write-Host "🚀 启动代码库索引系统端到端测试..." -ForegroundColor Green
Write-Host ""

# 检查必要的服务是否运行
Write-Host "🔍 检查必要服务状态..." -ForegroundColor Yellow

# 检查Qdrant服务
$qdrantStatus = docker ps --filter "name=qdrant" --format "table {{.Names}}\t{{.Status}}" 2>$null
if ($LASTEXITCODE -eq 0 -and $qdrantStatus -like "*qdrant*") {
    Write-Host "✅ Qdrant服务正在运行" -ForegroundColor Green
} else {
    Write-Host "❌ Qdrant服务未运行，请先启动Qdrant" -ForegroundColor Red
    Write-Host "运行命令: docker-compose -f docker-compose.qdrant.yml up -d" -ForegroundColor Yellow
    exit 1
}

# 检查NebulaGraph服务
$nebulaStatus = docker ps --filter "name=nebula" --format "table {{.Names}}\t{{.Status}}" 2>$null
if ($LASTEXITCODE -eq 0 -and $nebulaStatus -like "*nebula*") {
    Write-Host "✅ NebulaGraph服务正在运行" -ForegroundColor Green
} else {
    Write-Host "⚠️  NebulaGraph服务未运行，部分测试可能受影响" -ForegroundColor Yellow
}

Write-Host ""

# 检查环境变量配置
Write-Host "📋 检查环境变量配置..." -ForegroundColor Yellow
if (Test-Path .\.env) {
    Write-Host "✅ .env文件存在" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env文件不存在，使用默认配置" -ForegroundColor Yellow
    Copy-Item .\.env.example .\.env -ErrorAction SilentlyContinue
}

# 检查必要的环境变量
$requiredVars = @("EMBEDDING_PROVIDER", "QDRANT_HOST", "QDRANT_PORT")
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not (Get-ChildItem env: | Where-Object { $_.Name -eq $var })) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  缺少环境变量: $($missingVars -join ', ')" -ForegroundColor Yellow
    Write-Host "   请在.env文件中配置这些变量" -ForegroundColor Yellow
}

Write-Host ""

# 构建项目
Write-Host "🔨 构建项目..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 构建成功" -ForegroundColor Green

Write-Host ""

# 运行类型检查
Write-Host "🔍 运行TypeScript类型检查..." -ForegroundColor Yellow
tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 类型检查失败" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 类型检查通过" -ForegroundColor Green

Write-Host ""

# 运行端到端测试
Write-Host "🧪 运行端到端测试..." -ForegroundColor Cyan
npm test -- test/e2e/full-workflow.test.ts --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 端到端测试全部通过！" -ForegroundColor Green
    Write-Host "✅ 完整工作流验证成功" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ 端到端测试失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 测试总结:" -ForegroundColor Magenta
Write-Host "• 多语言文件解析 ✓" -ForegroundColor Green
Write-Host "• 代码片段提取 ✓" -ForegroundColor Green  
Write-Host "• 嵌入向量生成 ✓" -ForegroundColor Green
Write-Host "• 索引构建 ✓" -ForegroundColor Green
Write-Host "• 搜索查询 ✓" -ForegroundColor Green
Write-Host "• 项目索引 ✓" -ForegroundColor Green
Write-Host "• Tree-sitter/Semgrep集成 ✓" -ForegroundColor Green
Write-Host "• 错误处理 ✓" -ForegroundColor Green
Write-Host "• 性能基准 ✓" -ForegroundColor Green
Write-Host "• 数据一致性 ✓" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 代码库索引系统工作流验证完成！" -ForegroundColor Green