// 运行测试并确保正确清理的脚本
import 'reflect-metadata';
import { execSync } from 'child_process';

async function runTestWithCleanup() {
  console.log('=== 运行测试并确保正确清理 ===');
  
  try {
    // 使用Jest的--forceExit选项确保测试完成后退出
    console.log('运行测试...');
    
    const command = 'npx jest test/integration/snippet-storage-retrieval.test.ts --detectOpenHandles --forceExit --maxWorkers=1';
    
    execSync(command, {
      stdio: 'inherit',
      timeout: 120000, // 2分钟超时
      env: {
        ...process.env,
        // 确保使用正确的环境变量
        NODE_ENV: 'test'
      }
    });
    
    console.log('测试完成并成功清理');
    
  } catch (error) {
    console.error('测试运行失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTestWithCleanup().catch(console.error);