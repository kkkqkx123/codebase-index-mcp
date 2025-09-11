const { EnhancedSemgrepAnalyzer } = require('../../dist/services/static-analysis/EnhancedSemgrepAnalyzer');
const path = require('path');

async function runEnhancedAnalysis() {
    console.log('🚀 启动增强型Semgrep分析测试...\n');
    
    try {
        const analyzer = new EnhancedSemgrepAnalyzer();
        
        // 测试JavaScript文件
        console.log('📊 分析JavaScript测试文件...');
        const jsResults = await analyzer.detectSecurityPatterns(
            path.join(__dirname, 'test-vulnerable.js')
        );
        console.log('JavaScript安全检测结果:', JSON.stringify(jsResults.summary, null, 2));
        
        // 测试Python文件
        console.log('\n📊 分析Python测试文件...');
        const pyResults = await analyzer.detectSecurityPatterns(
            path.join(__dirname, 'test-vulnerable.py')
        );
        console.log('Python安全检测结果:', JSON.stringify(pyResults.summary, null, 2));
        
        // 测试控制流分析
        console.log('\n🔄 运行控制流分析...');
        const cfgResults = await analyzer.analyzeControlFlow(
            path.join(__dirname, 'test-vulnerable.js')
        );
        console.log('控制流分析结果:', {
            函数数量: cfgResults.functions.length,
            节点数量: cfgResults.nodes.length,
            入口函数: cfgResults.entryPoint
        });
        
        // 测试数据流分析
        console.log('\n📈 运行数据流分析...');
        const dfResults = await analyzer.analyzeDataFlow();
        console.log('数据流分析结果:', {
            变量数量: dfResults.variables.length,
            污点源: dfResults.taintSources.length,
            污点汇: dfResults.taintSinks.length
        });
        
        console.log('\n✅ 第一阶段测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runEnhancedAnalysis();
}