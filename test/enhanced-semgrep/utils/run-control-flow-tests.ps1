# 从环境变量获取enhanced-rules路径，默认为./enhanced-rules
$EnhancedRulesPath = $env:SEMGREP_ENHANCED_RULES_PATH
if (-not $EnhancedRulesPath) {
    $EnhancedRulesPath = "./enhanced-rules"
}

Write-Host "正在测试控制流分析规则..." -ForegroundColor Green
Write-Host "使用规则路径: $EnhancedRulesPath" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. 验证基础控制流规则..." -ForegroundColor Yellow
& semgrep --validate --config=$EnhancedRulesPath/control-flow/enhanced-cfg-simple.yml
Write-Host ""

Write-Host "2. 验证JavaScript控制流规则..." -ForegroundColor Yellow
& semgrep --validate --config=$EnhancedRulesPath/control-flow/js-control-flow.yml
Write-Host ""

Write-Host "3. 验证循环分析规则..." -ForegroundColor Yellow
& semgrep --validate --config=$EnhancedRulesPath/control-flow/loop-analysis-fixed.yml
Write-Host ""

Write-Host "4. 验证异常处理规则..." -ForegroundColor Yellow
& semgrep --validate --config=$EnhancedRulesPath/control-flow/exception-flow-simple.yml
Write-Host ""

Write-Host "5. 验证资源管理规则..." -ForegroundColor Yellow
& semgrep --validate --config=$EnhancedRulesPath/control-flow/resource-management.yml
Write-Host ""

Write-Host "6. 运行所有规则测试示例..." -ForegroundColor Cyan
Write-Host "测试基础规则:" -ForegroundColor Yellow
& semgrep --config=$EnhancedRulesPath/control-flow/enhanced-cfg-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试JavaScript规则:" -ForegroundColor Yellow
& semgrep --config=$EnhancedRulesPath/control-flow/js-control-flow.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试异常处理规则:" -ForegroundColor Yellow
& semgrep --config=$EnhancedRulesPath/control-flow/exception-flow-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试资源管理规则:" -ForegroundColor Yellow
& semgrep --config=$EnhancedRulesPath/control-flow/resource-management.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试完成！" -ForegroundColor Green