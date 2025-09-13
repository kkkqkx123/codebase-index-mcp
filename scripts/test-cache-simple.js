const Redis = require('ioredis');

async function testCacheSimple() {
  console.log('🧪 开始简单缓存测试...\n');
  
  try {
    // 测试Redis连接
    console.log('📋 测试Redis连接...');
    const redis = new Redis('redis://127.0.0.1:6379');
    
    await redis.ping();
    console.log('✅ Redis连接成功');
    
    // 测试基本操作
    console.log('\n📋 测试基本缓存操作...');
    
    await redis.set('test-key', 'test-value', 'EX', 60);
    const value = await redis.get('test-key');
    console.log(`✅ 设置/获取测试: ${value === 'test-value' ? '通过' : '失败'}`);
    
    await redis.del('test-key');
    const deleted = await redis.get('test-key');
    console.log(`✅ 删除测试: ${deleted === null ? '通过' : '失败'}`);
    
    // 测试缓存抽象层类
    console.log('\n📋 测试缓存抽象层类...');
    
    // 动态导入TypeScript模块
    const { MemoryCacheAdapter } = await import('../dist/src/services/cache/MemoryCacheAdapter.js');
    const { RedisCacheAdapter } = await import('../dist/src/services/cache/RedisCacheAdapter.js');
    
    // 测试内存缓存
    const memoryCache = new MemoryCacheAdapter('test-memory', 300);
    await memoryCache.set('mem-key', { data: 'memory-value' });
    const memValue = await memoryCache.get('mem-key');
    console.log(`✅ 内存缓存测试: ${memValue?.data === 'memory-value' ? '通过' : '失败'}`);
    
    // 测试Redis缓存
    const redisCache = new RedisCacheAdapter('test-redis', redis, 300);
    await redisCache.set('redis-key', { data: 'redis-value' });
    const redisValue = await redisCache.get('redis-key');
    console.log(`✅ Redis缓存测试: ${redisValue?.data === 'redis-value' ? '通过' : '失败'}`);
    
    // 获取统计信息
    const memStats = await memoryCache.getStats();
    const redisStats = await redisCache.getStats();
    
    console.log('\n📊 统计信息:');
    console.log('内存缓存:', memStats);
    console.log('Redis缓存:', redisStats);
    
    // 清理
    await memoryCache.clear();
    await redisCache.clear();
    await redis.disconnect();
    
    console.log('\n🎉 简单缓存测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

// 运行测试
if (require.main === module) {
  testCacheSimple().catch(console.error);
}