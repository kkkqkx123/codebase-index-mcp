// 调试硅基流动服务的脚本
const dotenv = require('dotenv');
dotenv.config();

// 模拟测试环境
process.env.NODE_ENV = 'test';

// 创建一个简化版的硅基流动测试
async function testSiliconFlow() {
  console.log('=== 硅基流动服务调试 ===');
  
  // 检查环境变量
  console.log('EMBEDDING_PROVIDER:', process.env.EMBEDDING_PROVIDER);
  console.log('SILICONFLOW_API_KEY:', process.env.SILICONFLOW_API_KEY ? '已设置' : '未设置');
  console.log('SILICONFLOW_BASE_URL:', process.env.SILICONFLOW_BASE_URL);
  console.log('SILICONFLOW_MODEL:', process.env.SILICONFLOW_MODEL);
  
  try {
    // 使用fetch测试硅基流动API - 使用正确的端点
    const response = await fetch(`${process.env.SILICONFLOW_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API响应状态:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('API可用，模型列表:', data.data ? data.data.length : '无模型数据');
      
      // 测试嵌入功能
      const embedResponse = await fetch(`${process.env.SILICONFLOW_BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.SILICONFLOW_MODEL,
          input: '测试文本',
          encoding_format: 'float'
        })
      });
      
      console.log('嵌入API响应状态:', embedResponse.status);
      
      if (embedResponse.ok) {
        const embedData = await embedResponse.json();
        console.log('嵌入成功，维度:', embedData.data[0].embedding.length);
        return true;
      } else {
        console.error('嵌入API错误:', embedResponse.status, await embedResponse.text());
        return false;
      }
    } else {
      console.error('API错误:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('网络错误:', error.message);
    return false;
  }
}

// 运行测试
testSiliconFlow().then(available => {
  console.log('硅基流动服务可用:', available);
  process.exit(available ? 0 : 1);
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});