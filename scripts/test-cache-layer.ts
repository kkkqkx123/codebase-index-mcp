import 'reflect-metadata';
import { ConfigService } from '../src/config/ConfigService';
import { CacheManager } from '../src/services/cache/CacheManager';
import { LoggerService } from '../src/core/LoggerService';

async function testCacheLayer() {
  console.log('🧪 开始测试缓存抽象层...\n');
  
  const logger = new LoggerService();
  
  try {
    // 初始化配置
    const configService = await ConfigService.getInstance();
    
    // 创建缓存管理器
    const cacheManager = new CacheManager(configService);
    
    // 测试内存缓存
    console.log('📋 测试内存缓存...');
    const memoryCache = await cacheManager.getCache('test-memory');
    
    await memoryCache.set('test-key', 'test-value', { ttl: 60 });
    const value = await memoryCache.get<string>('test-key');
    console.log(`✅ 内存缓存测试: ${value === 'test-value' ? '通过' : '失败'}`);
    
    // 测试多级缓存（如果启用）
    const redisConfig = configService.get('redis');
    if (redisConfig.enabled) {
      console.log('\n📋 测试Redis缓存...');
      
      const redisCache = await cacheManager.getCache('test-redis');
      
      await redisCache.set('redis-key', { data: 'redis-value' }, { ttl: 60 });
      const redisValue = await redisCache.get<any>('redis-key');
      console.log(`✅ Redis缓存测试: ${redisValue?.data === 'redis-value' ? '通过' : '失败'}`);
      
      // 测试多级缓存
      if (redisConfig.useMultiLevel) {
        console.log('\n📋 测试多级缓存...');
        const multiCache = await cacheManager.getCache('test-multi');
        
        await multiCache.set('multi-key', 'multi-value', { ttl: 60 });
        const multiValue = await multiCache.get<string>('multi-key');
        console.log(`✅ 多级缓存测试: ${multiValue === 'multi-value' ? '通过' : '失败'}`);
      }
      
      // 测试健康检查
      console.log('\n📋 测试健康检查...');
      const healthStatus = await cacheManager.healthCheck();
      console.log(`✅ 健康检查:`, healthStatus);
    }
    
    // 显示统计信息
    console.log('\n📊 缓存统计信息:');
    const stats = await cacheManager.getAllStats();
    console.log(JSON.stringify(stats, null, 2));
    
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await cacheManager.clearAll();
    
    // 关闭连接
    await cacheManager.shutdown();
    
    console.log('\n🎉 缓存抽象层测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testCacheLayer().catch(console.error);
}

export { testCacheLayer };