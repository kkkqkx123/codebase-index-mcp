@echo off
echo 正在测试控制流分析规则...
echo.

echo 1. 验证基础控制流规则...
semgrep --validate --config=enhanced-rules/control-flow/enhanced-cfg-simple.yml
echo.

echo 2. 验证JavaScript控制流规则...
semgrep --validate --config=enhanced-rules/control-flow/js-control-flow.yml
echo.

echo 3. 验证循环分析规则...
semgrep --validate --config=enhanced-rules/control-flow/loop-analysis-fixed.yml
echo.

echo 4. 验证异常处理规则...
semgrep --validate --config=enhanced-rules/control-flow/exception-flow-simple.yml
echo.

echo 5. 验证资源管理规则...
semgrep --validate --config=enhanced-rules/control-flow/resource-management.yml
echo.

echo 6. 运行所有规则测试示例...
semgrep --config=enhanced-rules/control-flow/enhanced-cfg-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=enhanced-rules/control-flow/js-control-flow.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=enhanced-rules/control-flow/exception-flow-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=enhanced-rules/control-flow/resource-management.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

echo 测试完成！