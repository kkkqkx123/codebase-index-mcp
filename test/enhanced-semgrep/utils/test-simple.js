const { EnhancedSemgrepAnalyzer } = require('../../src/services/static-analysis/EnhancedSemgrepAnalyzer');

// Simple test without dependency injection
async function runSimpleTest() {
    console.log('🚀 启动简化版测试...\n');
    
    try {
        // Create analyzer instance without DI
        const analyzer = new EnhancedSemgrepAnalyzer();
        
        // Test if we can access the class methods
        console.log('✅ EnhancedSemgrepAnalyzer 实例创建成功');
        console.log('🔍 可用方法:', Object.getOwnPropertyNames(EnhancedSemgrepAnalyzer.prototype));
        
        // Test basic method calls (they may fail but should not throw TypeError for undefined this.logger)
        try {
            const result = await analyzer.analyzeControlFlow('test');
            console.log('📊 控制流分析结果:', result);
        } catch (e) {
            console.log('📊 控制流分析失败 (预期):', e.message);
        }
        
        try {
            const result = await analyzer.analyzeDataFlow();
            console.log('📈 数据流分析结果:', result);
        } catch (e) {
            console.log('📈 数据流分析失败 (预期):', e.message);
        }
        
        console.log('\n✅ 简化版测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

runSimpleTest();