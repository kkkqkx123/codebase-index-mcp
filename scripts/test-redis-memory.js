const Redis = require('ioredis');

async function testRedisMemory() {
  console.log('🧪 测试Redis内存配置...');
  
  try {
    // 创建Redis连接
    const redis = new Redis('redis://localhost:6379');
    
    // 等待连接
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Redis连接成功');

    // 设置内存限制
    const maxmemory = '128mb';
    await redis.config('SET', 'maxmemory', maxmemory);
    console.log(`🔧 已设置最大内存限制: ${maxmemory}`);

    // 设置内存淘汰策略
    await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
    console.log('🔧 已设置内存淘汰策略: allkeys-lru');

    // 获取当前内存配置
    const currentMaxmemory = await redis.config('GET', 'maxmemory');
    const currentPolicy = await redis.config('GET', 'maxmemory-policy');
    
    console.log('📋 当前Redis内存配置:', {
      maxmemory: currentMaxmemory[1],
      policy: currentPolicy[1]
    });

    // 获取内存使用情况
    const info = await redis.info('memory');
    const lines = info.split('\r\n');
    
    let usedMemory = 0;
    let maxMemory = 0;
    
    for (const line of lines) {
      if (line.startsWith('used_memory:')) {
        usedMemory = parseInt(line.split(':')[1]) || 0;
      }
      if (line.startsWith('maxmemory:')) {
        maxMemory = parseInt(line.split(':')[1]) || 0;
      }
    }

    console.log('💾 内存使用情况:', {
      usedMemory: `${(usedMemory / 1024 / 1024).toFixed(2)} MB`,
      maxMemory: maxMemory > 0 ? `${(maxMemory / 1024 / 1024).toFixed(2)} MB` : '无限制',
      usagePercent: maxMemory > 0 ? `${((usedMemory / maxMemory) * 100).toFixed(2)}%` : 'N/A'
    });

    // 测试缓存操作
    console.log('🔄 测试缓存操作...');
    const testKey = 'memory-test';
    const largeData = Array(1000).fill(0).map((_, i) => ({ id: i, data: 'x'.repeat(100) }));
    
    await redis.set(testKey, JSON.stringify(largeData), 'EX', 300);
    console.log('✅ 测试数据已写入');

    const retrieved = await redis.get(testKey);
    console.log('✅ 测试数据已读取，大小:', `${(JSON.stringify(retrieved).length / 1024).toFixed(2)} KB`);

    // 清理测试数据
    await redis.del(testKey);
    console.log('🧹 测试数据已清理');

    // 获取Redis统计信息
    const stats = await redis.info();
    console.log('📈 Redis运行统计:');
    
    const versionMatch = stats.match(/redis_version:(\S+)/);
    const uptimeMatch = stats.match(/uptime_in_seconds:(\d+)/);
    const clientsMatch = stats.match(/connected_clients:(\d+)/);
    
    if (versionMatch) console.log(`   版本: ${versionMatch[1]}`);
    if (uptimeMatch) console.log(`   运行时间: ${(parseInt(uptimeMatch[1]) / 3600).toFixed(2)} 小时`);
    if (clientsMatch) console.log(`   连接客户端: ${clientsMatch[1]}`);

    console.log('🎉 Redis内存配置测试完成！');

    // 关闭连接
    await redis.quit();

  } catch (error) {
    console.error('❌ Redis内存配置测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testRedisMemory();
}

module.exports = { testRedisMemory };