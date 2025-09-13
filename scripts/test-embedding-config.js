#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { ConfigService } = require('../dist/src/config/ConfigService');

async function testEmbeddingConfig() {
  try {
    console.log('🔍 测试嵌入配置...\n');
    
    // 检查环境变量
    console.log('📋 环境变量检查:');
    console.log(`EMBEDDING_PROVIDER = ${process.env.EMBEDDING_PROVIDER}`);
    console.log(`SILICONFLOW_API_KEY = ${process.env.SILICONFLOW_API_KEY ? '已设置' : '未设置'}`);
    console.log(`MISTRAL_API_KEY = ${process.env.MISTRAL_API_KEY ? '已设置' : '未设置'}`);
    console.log('');

    // 使用项目配置系统
    const configService = ConfigService.getInstance();
    const embeddingConfig = configService.get('embedding');
    
    console.log('🔧 实际加载的嵌入配置:');
    console.log(`Provider: ${embeddingConfig.provider}`);
    console.log(`Model: ${embeddingConfig[embeddingConfig.provider]?.model || '未设置'}`);
    console.log(`Dimensions: ${embeddingConfig[embeddingConfig.provider]?.dimensions || '未设置'}`);
    console.log(`Base URL: ${embeddingConfig[embeddingConfig.provider]?.baseUrl || '未设置'}`);
    console.log('');

    // 验证API密钥
    const provider = embeddingConfig.provider;
    const apiKey = embeddingConfig[provider]?.apiKey;
    
    if (!apiKey || apiKey === 'your-api-key-here') {
      console.log(`⚠️  警告: ${provider} API密钥未正确设置`);
    } else {
      console.log(`✅ ${provider} API密钥已正确设置`);
    }

    // 检查所有支持的provider
    console.log('\n📊 支持的嵌入提供者:');
    const providers = ['openai', 'ollama', 'gemini', 'mistral', 'siliconflow', 'custom1', 'custom2', 'custom3'];
    
    providers.forEach(p => {
      const config = embeddingConfig[p];
      if (config) {
        const hasKey = config.apiKey && config.apiKey !== 'your-api-key-here';
        console.log(`  ${p}: ${hasKey ? '✅' : '❌'} ${config.model || '未设置模型'}`);
      }
    });

  } catch (error) {
    console.error('❌ 配置加载失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testEmbeddingConfig();
}