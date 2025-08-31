const dotenv = require('dotenv');
dotenv.config();

// 简化测试：只测试硅基流动服务
async function testSiliconFlowOnly() {
  console.log('=== 硅基流动服务独立测试 ===');
  
  try {
    // 动态导入ES模块
    const { SiliconFlowEmbedder } = await import('../src/embedders/SiliconFlowEmbedder.js');
    const { ConfigService } = await import('../src/config/ConfigService.js');
    const { LoggerService } = await import('../src/core/LoggerService.js');
    const { ErrorHandlerService } = await import('../src/core/ErrorHandlerService.js');
    const { EmbeddingCacheService } = await import('../src/embedders/EmbeddingCacheService.js');
    
    const configService = new ConfigService();
    const logger = new LoggerService();
    const errorHandler = new ErrorHandlerService();
    const cacheService = new EmbeddingCacheService();
    
    const embedder = new SiliconFlowEmbedder(configService, logger, errorHandler, cacheService);
    
    console.log('测试硅基流动服务可用性...');
    const isAvailable = await embedder.isAvailable();
    console.log('硅基流动服务可用:', isAvailable);
    
    if (isAvailable) {
      console.log('测试嵌入功能...');
      const result = await embedder.embed('这是一个测试文本');
      console.log('嵌入成功:', {
        hasEmbedding: !!result.embedding,
        dimensions: result.embedding.length,
        model: result.model
      });
    }
    
    // 清理资源
    if (typeof cacheService.stop === 'function') {
      cacheService.stop();
    }
    
    return isAvailable;
    
  } catch (error) {
    console.error('测试失败:', error.message);
    return false;
  }
}

// 运行测试
testSiliconFlowOnly().then(success => {
  console.log('测试完成，硅基流动服务状态:', success ? '正常' : '异常');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试异常:', error);
  process.exit(1);
});