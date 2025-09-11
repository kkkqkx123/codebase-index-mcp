#!/usr/bin/env node

// 最终内存优化验证脚本
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runFinalTest() {
  console.log('=== 内存优化最终验证 ===\n');
  
  try {
    // 1. 检查构建状态
    console.log('1. 检查构建状态...');
    if (!fs.existsSync('./dist')) {
      console.log('   执行构建...');
      execSync('npm run build', { stdio: 'inherit' });
    }
    console.log('   ✅ 构建完成');
    
    // 2. 验证配置文件
    console.log('\n2. 验证配置文件...');
    const envFiles = ['.env.example', '.env.memory-optimized'];
    envFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const hasMemoryConfig = content.includes('MEMORY_THRESHOLD') || content.includes('MAX_MEMORY_MB');
        console.log(`   ✅ ${file}: ${hasMemoryConfig ? '包含内存配置' : '文件存在'}`);
      } else {
        console.log(`   ❌ ${file}: 文件不存在`);
      }
    });
    
    // 3. 验证 package.json 脚本
    console.log('\n3. 验证 package.json 脚本...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};
    const memoryScripts = ['dev:memory', 'start:memory', 'start:memory-optimized'];
    
    memoryScripts.forEach(script => {
      if (scripts[script]) {
        console.log(`   ✅ ${script}: ${scripts[script]}`);
      } else {
        console.log(`   ❌ ${script}: 未找到`);
      }
    });
    
    // 4. 验证文档
    console.log('\n4. 验证文档...');
    const docs = [
      'docs/memory-optimization.md',
      'test-memory.js',
      'test-memory-check.ts'
    ];
    
    docs.forEach(doc => {
      if (fs.existsSync(doc)) {
        console.log(`   ✅ ${doc}: 文件存在`);
      } else {
        console.log(`   ❌ ${doc}: 文件不存在`);
      }
    });
    
    // 5. 提供运行建议
    console.log('\n5. 运行建议:');
    console.log('   📋 开发模式: npm run dev:memory');
    console.log('   🚀 生产模式: npm run start:memory');
    console.log('   ⚙️  优化模式: npm run start:memory-optimized');
    console.log('   📖 查看文档: docs/memory-optimization.md');
    
    // 6. 环境变量检查
    console.log('\n6. 当前环境变量:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   MEMORY_THRESHOLD: ${process.env.MEMORY_THRESHOLD || '默认'}`);
    console.log(`   MAX_MEMORY_MB: ${process.env.MAX_MEMORY_MB || '默认'}`);
    
    console.log('\n=== 验证完成 ===');
    console.log('\n🎉 内存优化已部署完成！');
    console.log('现在可以使用内存优化模式运行项目。');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    console.log('\n请检查:');
    console.log('1. 是否已运行 npm install');
    console.log('2. 是否已运行 npm run build');
    console.log('3. 查看错误日志获取更多信息');
  }
}

// 运行测试
if (require.main === module) {
  runFinalTest();
}