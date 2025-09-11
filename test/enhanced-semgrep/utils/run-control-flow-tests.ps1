Write-Host "正在测试控制流分析规则..." -ForegroundColor Green
Write-Host ""

Write-Host "1. 验证基础控制流规则..." -ForegroundColor Yellow
& semgrep --validate --config=enhanced-rules/control-flow/enhanced-cfg-simple.yml
Write-Host ""

Write-Host "2. 验证JavaScript控制流规则..." -ForegroundColor Yellow
& semgrep --validate --config=enhanced-rules/control-flow/js-control-flow.yml
Write-Host ""

Write-Host "3. 验证循环分析规则..." -ForegroundColor Yellow
& semgrep --validate --config=enhanced-rules/control-flow/loop-analysis-fixed.yml
Write-Host ""

Write-Host "4. 验证异常处理规则..." -ForegroundColor Yellow
& semgrep --validate --config=enhanced-rules/control-flow/exception-flow-simple.yml
Write-Host ""

Write-Host "5. 验证资源管理规则..." -ForegroundColor Yellow
& semgrep --validate --config=enhanced-rules/control-flow/resource-management.yml
Write-Host ""

Write-Host "6. 运行所有规则测试示例..." -ForegroundColor Cyan
Write-Host "测试基础规则:" -ForegroundColor Yellow
& semgrep --config=enhanced-rules/control-flow/enhanced-cfg-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试JavaScript规则:" -ForegroundColor Yellow
& semgrep --config=enhanced-rules/control-flow/js-control-flow.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试异常处理规则:" -ForegroundColor Yellow
& semgrep --config=enhanced-rules/control-flow/exception-flow-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试资源管理规则:" -ForegroundColor Yellow
& semgrep --config=enhanced-rules/control-flow/resource-management.yml test/enhanced-semgrep/test-cases/control-flow-test.js
Write-Host ""

Write-Host "测试完成！" -ForegroundColor Green