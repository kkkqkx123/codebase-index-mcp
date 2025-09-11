semgrep --validate --config=enhanced-rules/control-flow/enhanced-cfg-simple.yml

node test/enhanced-semgrep/rule-validation.js

semgrep --config=enhanced-rules/control-flow/enhanced-cfg-analysis-v3.yml test/enhanced-semgrep/test-cases/control-flow-test.js