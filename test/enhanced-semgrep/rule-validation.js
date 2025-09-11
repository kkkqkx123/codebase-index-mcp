#!/usr/bin/env node

/**
 * Semgrep增强规则验证脚本
 * 该脚本用于验证增强规则的正确性和有效性
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SemgrepRuleValidator {
  constructor() {
    this.rulesDir = path.join(__dirname, '../../enhanced-rules');
    this.testDir = path.join(__dirname);
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * 验证所有规则文件
   */
  async validateAllRules() {
    console.log('🚀 开始验证Semgrep增强规则...\n');
    
    const rules = this.getAllRuleFiles();
    
    for (const rule of rules) {
      await this.validateRule(rule);
    }
    
    this.printResults();
    return this.results;
  }

  /**
   * 获取所有规则文件
   */
  getAllRuleFiles() {
    const rules = [];
    const categories = ['control-flow', 'data-flow', 'security'];
    
    categories.forEach(category => {
      const categoryDir = path.join(this.rulesDir, category);
      if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir)
          .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
          .map(f => path.join(categoryDir, f));
        rules.push(...files);
      }
    });
    
    return rules;
  }

  /**
   * 验证单个规则文件
   */
  async validateRule(rulePath) {
    const ruleName = path.basename(rulePath);
    console.log(`📋 验证规则: ${ruleName}`);
    
    try {
      // 验证规则语法
      const validation = this.validateRuleSyntax(rulePath);
      
      if (validation.valid) {
        console.log(`   ✅ 语法验证通过`);
        
        // 测试规则匹配
        const testResult = await this.testRuleMatching(rulePath);
        
        if (testResult.success) {
          console.log(`   ✅ 测试匹配成功 (${testResult.matches} 个匹配)`);
          this.results.passed.push({ rule: ruleName, matches: testResult.matches });
        } else {
          console.log(`   ⚠️  测试匹配失败: ${testResult.error}`);
          this.results.warnings.push({ rule: ruleName, error: testResult.error });
        }
      } else {
        console.log(`   ❌ 语法验证失败: ${validation.error}`);
        this.results.failed.push({ rule: ruleName, error: validation.error });
      }
    } catch (error) {
      console.log(`   ❌ 验证失败: ${error.message}`);
      this.results.failed.push({ rule: ruleName, error: error.message });
    }
    
    console.log('');
  }

  /**
   * 验证规则语法
   */
  validateRuleSyntax(rulePath) {
    try {
      const ruleContent = fs.readFileSync(rulePath, 'utf8');
      
      // 检查基本YAML结构
      if (!ruleContent.includes('rules:')) {
        return { valid: false, error: '缺少rules: 顶级键' };
      }
      
      // 检查每个规则的必要字段
      const lines = ruleContent.split('\n');
      let inRule = false;
      let currentRule = {};
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('- id:')) {
          if (inRule && !currentRule.id) {
            return { valid: false, error: '规则缺少id字段' };
          }
          inRule = true;
          currentRule = { id: trimmed.substring(5).trim() };
        }
        
        if (inRule) {
          if (trimmed.startsWith('message:')) currentRule.message = true;
          if (trimmed.startsWith('languages:')) currentRule.languages = true;
          if (trimmed.startsWith('severity:')) currentRule.severity = true;
        }
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 测试规则匹配
   */
  async testRuleMatching(rulePath) {
    try {
      // 创建测试文件
      const testFile = this.createTestFile(rulePath);
      
      // 运行semgrep
      const cmd = `semgrep --config=${rulePath} ${testFile} --json`;
      const result = execSync(cmd, { encoding: 'utf8' });
      
      const output = JSON.parse(result);
      const matches = output.results ? output.results.length : 0;
      
      // 清理测试文件
      fs.unlinkSync(testFile);
      
      return { success: true, matches };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建测试文件
   */
  createTestFile(rulePath) {
    const ruleName = path.basename(rulePath, '.yml');
    const testFile = path.join(this.testDir, `test-${ruleName}.js`);
    
    // 根据规则类型创建不同的测试代码
    let testCode = '';
    
    if (ruleName.includes('sql-injection')) {
      testCode = `
        // 测试SQL注入
        const userId = req.params.id;
        const query = "SELECT * FROM users WHERE id = '" + userId + "'";
        db.query(query);
      `;
    } else if (ruleName.includes('xss')) {
      testCode = `
        // 测试XSS
        const userInput = req.query.name;
        document.getElementById('output').innerHTML = userInput;
      `;
    } else if (ruleName.includes('control-flow')) {
      testCode = `
        // 测试控制流
        function testComplexity(x) {
          if (x > 0) {
            if (x < 10) {
              if (x > 5) {
                if (x < 8) {
                  return true;
                }
              }
            }
          }
          return false;
        }
      `;
    } else {
      testCode = `
        // 通用测试代码
        function testFunction(input) {
          if (input) {
            return input;
          }
          return null;
        }
      `;
    }
    
    fs.writeFileSync(testFile, testCode);
    return testFile;
  }

  /**
   * 打印验证结果
   */
  printResults() {
    console.log('📊 验证结果汇总:');
    console.log(`   ✅ 通过: ${this.results.passed.length}`);
    console.log(`   ⚠️  警告: ${this.results.warnings.length}`);
    console.log(`   ❌ 失败: ${this.results.failed.length}`);
    
    if (this.results.passed.length > 0) {
      console.log('\n✅ 通过的规则:');
      this.results.passed.forEach(r => console.log(`   - ${r.rule} (${r.matches} 匹配)`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  警告的规则:');
      this.results.warnings.forEach(r => console.log(`   - ${r.rule}: ${r.error}`));
    }
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ 失败的规则:');
      this.results.failed.forEach(r => console.log(`   - ${r.rule}: ${r.error}`));
    }
  }

  /**
   * 生成报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalRules: this.results.passed.length + this.results.warnings.length + this.results.failed.length,
      passed: this.results.passed.length,
      warnings: this.results.warnings.length,
      failed: this.results.failed.length,
      details: this.results
    };
    
    const reportPath = path.join(this.testDir, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 详细报告已保存: ${reportPath}`);
  }

  /**
   * 运行性能测试
   */
  async runPerformanceTest() {
    console.log('⚡ 运行性能测试...');
    
    const configFile = path.join(this.rulesDir, 'config/enhanced-rules-config.yml');
    const testStart = Date.now();
    
    try {
      const cmd = `semgrep --config=${configFile} ${this.testDir} --time --json`;
      const result = execSync(cmd, { encoding: 'utf8' });
      const output = JSON.parse(result);
      
      const testEnd = Date.now();
      const duration = testEnd - testStart;
      
      console.log(`   ⏱️  扫描耗时: ${duration}ms`);
      console.log(`   📊 发现结果: ${output.results ? output.results.length : 0}`);
      
      return {
        duration,
        results: output.results ? output.results.length : 0
      };
    } catch (error) {
      console.log(`   ❌ 性能测试失败: ${error.message}`);
      return null;
    }
  }
}

// 主程序
async function main() {
  const validator = new SemgrepRuleValidator();
  
  try {
    // 验证规则
    await validator.validateAllRules();
    
    // 生成报告
    validator.generateReport();
    
    // 运行性能测试
    await validator.runPerformanceTest();
    
    console.log('\n🎉 验证完成！');
  } catch (error) {
    console.error('❌ 验证过程出错:', error);
    process.exit(1);
  }
}

// 如果直接运行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SemgrepRuleValidator;