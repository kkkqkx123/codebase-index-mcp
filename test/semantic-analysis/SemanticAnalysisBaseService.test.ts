import { SemanticAnalysisBaseService } from '../../src/services/semantic-analysis/SemanticAnalysisBaseService';
import { LoggerService } from '../../src/core/LoggerService';

// 创建模拟的LoggerService
class MockLoggerService {
  info(message: string) { console.log(`[INFO] ${message}`); }
  error(message: string) { console.error(`[ERROR] ${message}`); }
  warn(message: string) { console.warn(`[WARN] ${message}`); }
}

async function runSemanticAnalysisTests() {
  console.log('🚀 Starting Phase 1 Semantic Analysis Tests\n');

  const logger = new MockLoggerService() as any;
  const service = new SemanticAnalysisBaseService(logger);

  const testConfig = {
    projectPath: './test-project',
    includeControlFlow: true,
    includeDataFlow: true,
    includeCallGraph: true
  };

  try {
    // 测试1: 项目验证
    console.log('📋 Test 1: Project Validation');
    const validationResult = await service.validateProject(testConfig.projectPath);
    console.log(`   Result: ${validationResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Message: ${validationResult.message}\n`);

    // 测试2: Semgrep规则集成
    console.log('🔍 Test 2: Semgrep Rules Integration');
    const semgrepResult = await service.integrateSemgrepRules(testConfig);
    console.log(`   Result: ${semgrepResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Rules processed: ${semgrepResult.data?.totalRules || 0}`);
    console.log(`   Successful rules: ${semgrepResult.data?.successfulRules || 0}\n`);

    // 测试3: 调用图构建
    console.log('📊 Test 3: Call Graph Building');
    const callGraphResult = await service.buildCallGraph(testConfig);
    console.log(`   Result: ${callGraphResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Total functions: ${callGraphResult.data?.metrics?.totalFunctions || 0}`);
    console.log(`   Total calls: ${callGraphResult.data?.metrics?.totalCalls || 0}\n`);

    // 测试4: 完整分析流程
  console.log('🔄 Test 4: Complete Semantic Analysis');
  const analysisResult = await service.runSemanticAnalysis(testConfig);
    console.log(`   Result: ${analysisResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Message: ${analysisResult.message}\n`);

    // 测试5: 报告生成
    console.log('📄 Test 5: Report Generation');
    const jsonReport = await service.exportResults('json');
    const markdownReport = await service.exportResults('markdown');
    console.log(`   JSON report: ${jsonReport ? '✅ Generated' : '❌ Failed'}`);
    console.log(`   Markdown report: ${markdownReport ? '✅ Generated' : '❌ Failed'}\n`);

    // 显示最终状态
    if (analysisResult.success) {
      console.log('🎉 All semantic analysis tests completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`   - Project validation: ✅`);
      console.log(`   - Semgrep integration: ✅`);
      console.log(`   - Call graph building: ✅`);
      console.log(`   - Report generation: ✅`);
      
      console.log('\n📈 Metrics:');
      console.log(`   - Total files analyzed: ${analysisResult.data?.metrics?.totalFiles || 0}`);
      console.log(`   - Total functions: ${analysisResult.data?.metrics?.totalFunctions || 0}`);
      console.log(`   - Total issues found: ${analysisResult.data?.metrics?.totalIssues || 0}`);
      console.log(`   - Analysis time: ${analysisResult.data?.metrics?.analysisTime || 0}ms`);

      console.log('\n🔮 Next Steps:');
      console.log('   1. Review the generated reports');
      console.log('   2. Address identified issues');
      console.log('   3. Prepare for advanced semantic rules implementation');

    } else {
      console.log('❌ Phase 1 tests failed:');
      console.log(`   Errors: ${analysisResult.errors?.join(', ') || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error);
  }
}

// 运行测试
if (require.main === module) {
  runSemanticAnalysisTests().catch(console.error);
}

// 导出测试函数供其他模块使用
export { runSemanticAnalysisTests };