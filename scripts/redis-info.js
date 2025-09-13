const Redis = require('ioredis');

async function showRedisInfo() {
  console.log('📊 Redis信息查看工具');
  
  try {
    // 创建Redis连接
    const redis = new Redis('redis://localhost:6379');
    
    console.log('🔗 连接到Redis...');
    
    // 获取服务器信息
    const serverInfo = await redis.info('server');
    const memoryInfo = await redis.info('memory');
    const keyspaceInfo = await redis.info('keyspace');
    
    console.log('\n📋 服务器信息:');
    const versionMatch = serverInfo.match(/redis_version:(\S+)/);
    const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
    
    if (versionMatch) console.log(`   Redis版本: ${versionMatch[1]}`);
    if (uptimeMatch) console.log(`   运行时间: ${(parseInt(uptimeMatch[1]) / 3600).toFixed(1)} 小时`);
    
    console.log('\n💾 内存配置:');
    const maxmemoryMatch = memoryInfo.match(/maxmemory:(\d+)/);
    const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
    
    if (maxmemoryMatch) {
      const maxmemory = parseInt(maxmemoryMatch[1]);
      console.log(`   最大内存: ${maxmemory > 0 ? (maxmemory / 1024 / 1024).toFixed(1) + ' MB' : '无限制'}`);
    }
    
    if (usedMemoryMatch) {
      const usedMemory = parseInt(usedMemoryMatch[1]);
      console.log(`   已用内存: ${(usedMemory / 1024 / 1024).toFixed(2)} MB`);
    }
    
    const policyMatch = memoryInfo.match(/maxmemory_policy:(\S+)/);
    if (policyMatch) console.log(`   淘汰策略: ${policyMatch[1]}`);
    
    console.log('\n🗄️  键空间信息:');
    if (keyspaceInfo.trim() === '') {
      console.log('   当前无数据');
    } else {
      const lines = keyspaceInfo.split('\r\n');
      for (const line of lines) {
        if (line.includes('keys=')) {
          const [db, info] = line.split(':');
          console.log(`   ${db}: ${info}`);
        }
      }
    }
    
    // 获取当前数据库的键数量
    const keyCount = await redis.dbsize();
    console.log(`   总键数: ${keyCount}`);
    
    // 获取配置
    console.log('\n⚙️  当前配置:');
    try {
      const currentMaxmemory = await redis.config('GET', 'maxmemory');
      const currentPolicy = await redis.config('GET', 'maxmemory-policy');
      
      console.log(`   maxmemory: ${currentMaxmemory[1]} bytes`);
      console.log(`   maxmemory-policy: ${currentPolicy[1]}`);
    } catch (error) {
      console.log('   无法获取配置（可能需要权限）');
    }
    
    await redis.quit();
    console.log('\n✅ 完成！');
    
  } catch (error) {
    console.error('❌ 连接Redis失败:', error.message);
    console.log('\n💡 请确保:');
    console.log('   1. Redis服务已启动');
    console.log('   2. 连接地址正确: redis://localhost:6379');
    console.log('   3. 防火墙允许6379端口');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  showRedisInfo();
}

module.exports = { showRedisInfo };