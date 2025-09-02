# 嵌入器真实API调用实现方案

## 概述

本文档描述了如何为嵌入器实现真实的API调用，替代当前的模拟嵌入生成。实现将基于配置文件中定义的API密钥和基础URL，为不同的嵌入服务提供商（OpenAI、Ollama、Gemini、Mistral）提供真实的API调用功能。

## 实现方式

### 1. 配置管理

API密钥和基础URL通过配置文件管理，使用dotenv从环境变量加载，并通过Joi验证配置结构。

- OpenAI: 需要apiKey和model参数
- Ollama: 需要baseUrl和model参数
- Gemini: 需要apiKey和model参数
- Mistral: 需要apiKey和model参数

### 2. OpenAI嵌入器实现

`OpenAIEmbedder.ts`文件中的`embed`方法已修改，实现了真实的API调用：

1. 使用`fetch`向OpenAI API发送POST请求
2. 请求URL: `https://api.openai.com/v1/embeddings`
3. 请求头包含:
   - `Authorization: Bearer ${apiKey}`
   - `Content-Type: application/json`
4. 请求体包含:
   - `input`: 要嵌入的文本
   - `model`: 模型名称
5. 解析响应中的嵌入向量
6. `generateMockEmbedding`方法已被移除

### 3. Ollama嵌入器实现

`OllamaEmbedder.ts`文件中的`embed`方法已修改，实现了真实的API调用：

1. 使用`fetch`向Ollama API发送POST请求
2. 请求URL: `${baseUrl}/api/embeddings`
3. 请求头包含:
   - `Content-Type: application/json`
4. 请求体包含:
   - `prompt`: 要嵌入的文本
   - `model`: 模型名称
5. 解析响应中的嵌入向量
6. `generateMockEmbedding`方法已被移除

### 4. Gemini嵌入器实现

`GeminiEmbedder.ts`文件中的`embed`方法已修改，实现了真实的API调用：

1. 使用`fetch`向Gemini API发送POST请求
2. 请求URL: `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`
3. 请求头包含:
   - `Content-Type: application/json`
4. 请求体包含:
   - `content`: 包含要嵌入的文本
5. 解析响应中的嵌入向量
6. `generateMockEmbedding`方法已被移除

### 5. Mistral嵌入器实现

`MistralEmbedder.ts`文件中的`embed`方法已修改，实现了真实的API调用：

1. 使用`fetch`向Mistral API发送POST请求
2. 请求URL: `https://api.mistral.ai/v1/embeddings`
3. 请求头包含:
   - `Authorization: Bearer ${apiKey}`
   - `Content-Type: application/json`
4. 请求体包含:
   - `input`: 要嵌入的文本
   - `model`: 模型名称
5. 解析响应中的嵌入向量
6. `generateMockEmbedding`方法已被移除

### 6. 错误处理和可用性检查

1. 更新每个嵌入器的`isAvailable`方法，实现真实的可用性检查：
   - OpenAI: 发送一个简单的API请求验证API密钥
   - Ollama: 检查Ollama服务是否正在运行
   - Gemini: 发送一个简单的API请求验证API密钥
   - Mistral: 发送一个简单的API请求验证API密钥

2. 增强错误处理，提供更详细的错误信息和重试机制

### 7. 性能优化

1. 实现嵌入结果缓存，避免重复请求相同的文本
2. 实现批量嵌入功能，一次请求处理多个文本
3. 添加请求超时和并发控制

## 实施步骤

1. ✅ 创建一个共享的HTTP客户端工具，用于处理API请求
2. ✅ 逐个修改每个嵌入器的`embed`方法，实现真实的API调用
3. ✅ 更新`isAvailable`方法，实现真实的可用性检查
4. 添加错误处理和重试机制
5. 实现性能优化功能（缓存、批量处理等）
6. 测试每个嵌入器的实现
7. 更新文档和示例配置

## 预期效果

实现真实的API调用后，嵌入器将能够生成高质量的嵌入向量，提高语义搜索和重排的准确性。同时，通过配置文件管理API密钥和基础URL，使系统更加灵活和安全。