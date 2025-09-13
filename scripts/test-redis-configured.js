require('dotenv').config();
const { ConfigService } = require('../dist/src/config/ConfigService');
const { CacheFactory } = require('../dist/src/services/cache/CacheFactory');
const { RedisConfigManager } = require('../dist/src/services/cache/RedisConfigManager');

async function testRedisWithConfig() {
  console.log('🧪 使用项目配置测试Redis...');
  
  try {
    // 初始化配置服务
    const configService = new ConfigService();
    
    // 获取Redis配置
    const redisConfig = configService.get('redis');
    const embeddingConfig = configService.get('embedding');
    
    console.log('📋 当前配置:');
    console.log('   Redis配置:', {
      enabled: redisConfig.enabled,
      url: redisConfig.url,
      maxmemory: redisConfig.maxmemory,
      useMultiLevel: redisConfig.useMultiLevel
    });
    console.log('   嵌入配置:', {
      provider: embeddingConfig.provider,
      siliconflow: {
        apiKey: embeddingConfig.siliconflow?.apiKey ? '已设置' : '未设置',
        model: embeddingConfig.siliconflow?.model,
        dimensions: embeddingConfig.siliconflow?.dimensions
      }
    });

    if (!redisConfig.enabled) {
      console.log('⚠️ Redis未启用，跳过测试');
      return;
    }

    // 使用项目配置的Redis连接
    const cache = CacheFactory.createCache('test-config', redisConfig, 300);
    
    // 等待Redis连接建立
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const redis = CacheFactory.getRedisInstance();
    if (!redis) {
      throw new Error('无法获取Redis实例');
    }

    // 验证项目配置的内存限制
    console.log('🔧 验证项目配置的内存限制...');
    await RedisConfigManager.configureRedis(redis, redisConfig);

    // 获取当前内存配置
    const memoryInfo = await RedisConfigManager.getMemoryInfo(redis);
    console.log('💾 内存使用情况:', {
      usedMemory: `${(memoryInfo.usedMemory / 1024 / 1024).toFixed(2)} MB`,
      maxMemory: memoryInfo.maxMemory > 0 ? `${(memoryInfo.maxMemory / 1024 / 1024).toFixed(2)} MB` : '无限制',
      usagePercent: `${memoryInfo.memoryUsage.toFixed(2)}%`
    });

    // 测试缓存操作
    console.log('🔄 测试缓存操作...');
    const testKey = 'configured-test';
    const testValue = {
      message: '使用项目配置的测试',
      provider: embeddingConfig.provider,
      timestamp: Date.now()
    };
    
    await cache.set(testKey, testValue, { ttl: 60 });
    const retrieved = await cache.get(testKey);
    
    console.log('✅ 缓存测试成功:', {
      set: !!testValue,
      get: !!retrieved,
      value: retrieved
    });

    // 清理测试数据
    await cache.del(testKey);
    console.log('🧹 清理测试数据完成');

    console.log('🎉 使用项目配置的Redis测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  } finally {
    // 清理资源
    await CacheFactory.shutdown();
  }
}

if (require.main === module) {
  testRedisWithConfig();
}

module.exports = { testRedisWithConfig };