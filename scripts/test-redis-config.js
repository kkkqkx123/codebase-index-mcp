const { ConfigService } = require('../dist/src/config/ConfigService');
const { CacheFactory } = require('../dist/src/services/cache/CacheFactory');
const { RedisConfigManager } = require('../dist/src/services/cache/RedisConfigManager');

async function testRedisConfig() {
  console.log('🧪 测试Redis配置和内存限制...');
  
  try {
    // 初始化配置
    const configService = new ConfigService();
    const redisConfig = configService.get('redis');
    
    console.log('📋 Redis配置:', {
      enabled: redisConfig.enabled,
      url: redisConfig.url,
      maxmemory: redisConfig.maxmemory,
      useMultiLevel: redisConfig.useMultiLevel
    });

    if (!redisConfig.enabled) {
      console.log('⚠️ Redis未启用，跳过测试');
      return;
    }

    // 创建缓存实例
    const cache = CacheFactory.createCache('test', redisConfig, 300);
    
    // 等待Redis连接
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 获取Redis实例
    const redis = CacheFactory.getRedisInstance();
    if (!redis) {
      throw new Error('无法获取Redis实例');
    }

    // 测试内存配置
    console.log('🔧 配置Redis内存限制...');
    await RedisConfigManager.configureRedis(redis, redisConfig);

    // 获取内存统计信息
    console.log('📊 获取Redis内存统计...');
    const memoryInfo = await RedisConfigManager.getMemoryInfo(redis);
    console.log('💾 内存使用情况:', {
      usedMemory: `${(memoryInfo.usedMemory / 1024 / 1024).toFixed(2)} MB`,
      maxMemory: memoryInfo.maxMemory > 0 ? `${(memoryInfo.maxMemory / 1024 / 1024).toFixed(2)} MB` : '无限制',
      memoryUsage: `${memoryInfo.memoryUsage.toFixed(2)}%`
    });

    // 获取详细统计信息
    const stats = await RedisConfigManager.getRedisStats(redis);
    console.log('📈 Redis统计信息:', {
      version: stats.version,
      uptime: `${(stats.uptime / 3600).toFixed(2)} 小时`,
      connectedClients: stats.connectedClients,
      usedMemory: `${(stats.usedMemory / 1024 / 1024).toFixed(2)} MB`,
      maxMemory: stats.maxMemory > 0 ? `${(stats.maxMemory / 1024 / 1024).toFixed(2)} MB` : '无限制',
      memoryUsage: `${stats.memoryUsage.toFixed(2)}%`,
      keyspace: stats.keyspace
    });

    // 测试缓存操作
    console.log('🔄 测试缓存操作...');
    const testKey = 'redis-config-test';
    const testValue = { message: 'Redis配置测试', timestamp: Date.now() };
    
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

    console.log('🎉 Redis配置测试完成！');

  } catch (error) {
    console.error('❌ Redis配置测试失败:', error.message);
    process.exit(1);
  } finally {
    // 清理资源
    await CacheFactory.shutdown();
  }
}

if (require.main === module) {
  testRedisConfig();
}

module.exports = { testRedisConfig };