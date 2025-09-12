@echo off
REM 从环境变量获取enhanced-rules路径，默认为./enhanced-rules
if "%SEMGREP_ENHANCED_RULES_PATH%"=="" (
    set ENHANCED_RULES_PATH=./enhanced-rules
) else (
    set ENHANCED_RULES_PATH=%SEMGREP_ENHANCED_RULES_PATH%
)

echo 正在测试控制流分析规则...
echo 使用规则路径: %ENHANCED_RULES_PATH%
echo.

echo 1. 验证基础控制流规则...
semgrep --validate --config=%ENHANCED_RULES_PATH%/control-flow/enhanced-cfg-simple.yml
echo.

echo 2. 验证JavaScript控制流规则...
semgrep --validate --config=%ENHANCED_RULES_PATH%/control-flow/js-control-flow.yml
echo.

echo 3. 验证循环分析规则...
semgrep --validate --config=%ENHANCED_RULES_PATH%/control-flow/loop-analysis-fixed.yml
echo.

echo 4. 验证异常处理规则...
semgrep --validate --config=%ENHANCED_RULES_PATH%/control-flow/exception-flow-simple.yml
echo.

echo 5. 验证资源管理规则...
semgrep --validate --config=%ENHANCED_RULES_PATH%/control-flow/resource-management.yml
echo.

echo 6. 运行所有规则测试示例...
semgrep --config=%ENHANCED_RULES_PATH%/control-flow/enhanced-cfg-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=%ENHANCED_RULES_PATH%/control-flow/js-control-flow.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=%ENHANCED_RULES_PATH%/control-flow/exception-flow-simple.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

semgrep --config=%ENHANCED_RULES_PATH%/control-flow/resource-management.yml test/enhanced-semgrep/test-cases/control-flow-test.js
echo.

echo 测试完成！