# 代码库索引和结构分析功能 - 技术调研文档

## 📋 调研概述

本文档详细调研了MCP服务所需的核心技术组件，包括Qdrant向量数据库、Neo4j图数据库、OpenAI嵌入API、MCP协议实现以及相关的性能优化策略。调研重点在于技术选型的合理性、性能表现、以及集成复杂度。

## 🔍 MCP协议实现

### 协议框架选择

选择使用`@modelcontextprotocol/server`作为MCP服务器框架，该框架提供完整的TypeScript支持，符合MCP 1.0标准，支持工具注册、资源管理和协议处理。

### 核心特性
- **工具注册**: 支持动态注册MCP工具
- **资源管理**: 提供统一的资源访问接口
- **协议兼容**: 完全兼容MCP 1.0标准
- **错误处理**: 内置协议级错误处理机制

## 1. Qdrant向量数据库集成

### 🔍 Qdrant向量数据库

### 客户端选择

经过调研，选择使用Qdrant官方JavaScript客户端`@qdrant/js-client-rest`，版本1.10.0。该客户端提供完整的TypeScript支持，与Qdrant 1.10.0服务端完全兼容。

#### 官方JavaScript客户端
```typescript
import { QdrantClient } from 'qdrant-client';

// 创建客户端
const client = new QdrantClient({
  url: 'http://127.0.0.1:6333',
  // 或者使用host和port
  host: '127.0.0.1',
  port: 6333,
  https: false
});
```

#### 版本兼容性
- **当前版本**: qdrant-client@1.10.0
- **Node.js支持**: >=14.0.0
- **TypeScript支持**: 完整类型定义

## 🔍 Neo4j图数据库

### 客户端选择

选择使用`neo4j-driver`官方驱动程序，版本5.20.0，提供完整的TypeScript类型定义和异步操作支持。

### 核心操作API

#### 图数据操作
```typescript
// 创建节点
const session = driver.session();
await session.run(`
  CREATE (n:Function {name: $name, filePath: $filePath})
  RETURN n
`, { name: 'functionName', filePath: '/path/to/file.js' });

// 创建关系
await session.run(`
  MATCH (a:Function {name: $caller}), (b:Function {name: $callee})
  CREATE (a)-[r:CALLS]->(b)
  RETURN r
`, { caller: 'functionA', callee: 'functionB' });

// 查询调用关系
const result = await session.run(`
  MATCH path = (start:Function)-[:CALLS*]->(end:Function)
  WHERE start.name = $functionName
  RETURN nodes(path) as nodes, relationships(path) as relationships
`, { functionName: 'main' });
```

### 核心操作API

#### 集合管理
```typescript
// 创建集合
await client.createCollection('code-index', {
  vectors: {
    size: 1536,  // OpenAI ada-002维度
    distance: 'Cosine',  // 余弦相似度
    on_disk: true  // 磁盘存储
  }
});

// 检查集合存在
const exists = await client.collectionExists('code-index');
```

#### 数据操作
```typescript
// 插入向量点
await client.upsert('code-index', {
  points: [
    {
      id: 1,
      vector: [0.1, 0.2, ..., 0.1536],
      payload: {
        content: 'function example() {}',
        filePath: 'src/utils.ts',
        language: 'typescript'
      }
    }
  ]
});

// 搜索相似向量
const results = await client.search('code-index', {
  vector: [0.1, 0.2, ..., 0.1536],
  limit: 10,
  with_payload: true,
  with_vector: false
});
```

### 1.3 性能优化配置

#### 索引配置
```typescript
const collectionConfig = {
  vectors: {
    size: 1536,
    distance: 'Cosine',
    
    // 量化配置（节省内存）
    quantization_config: {
      scalar: {
        type: 'int8',
        quantile: 0.99,
        always_ram: true
      }
    },
    
    // HNSW索引配置
    hnsw_config: {
      m: 16,
      ef_construct: 200,
      full_scan_threshold: 10000
    }
  },
  
  // 优化配置
  optimizers_config: {
    deleted_threshold: 0.2,
    vacuum_min_vector_number: 1000,
    default_segment_number: 2
  }
};
```

#### 批处理操作
```typescript
// 批量插入（性能优化）
const BATCH_SIZE = 100;
const points = []; // 向量点数组

for (let i = 0; i < points.length; i += BATCH_SIZE) {
  const batch = points.slice(i, i + BATCH_SIZE);
  await client.upsert('code-index', { points: batch });
  
  // 添加延迟避免速率限制
  if (i % 1000 === 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

### 1.4 错误处理和重试

```typescript
class QdrantService {
  private client: QdrantClient;
  private maxRetries = 3;
  
  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // 指数退避
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (attempt === this.maxRetries) {
          throw new Error(`Qdrant operation failed after ${attempt} attempts: ${lastError.message}`);
        }
      }
    }
    
    throw lastError!;
  }
  
  async searchWithRetry(...args: Parameters<QdrantClient['search']>) {
    return this.withRetry(() => this.client.search(...args));
  }
}
```

## 🤖 OpenAI API集成

### 2.1 嵌入模型配置

#### 模型选择

选择OpenAI的`text-embedding-ada-002`模型，该模型提供1536维向量输出，在代码语义理解方面表现优异，且API调用成本相对较低。
```typescript
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const EMBEDDING_DIMENSIONS = 1536;

// 替代模型（备用）
const FALLBACK_MODELS = [
  'text-embedding-3-small',
  'text-embedding-3-large'
];
```

#### API调用配置
```typescript
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000,
  
  // 代理配置（如果需要）
  // httpAgent: new ProxyAgent('http://proxy:8080')
});

// 嵌入请求
const embeddingResponse = await openai.embeddings.create({
  model: EMBEDDING_MODEL,
  input: text,
  encoding_format: 'float'
});

const embedding = embeddingResponse.data[0].embedding;
```

### 2.2 批处理和速率限制

#### 智能批处理
```typescript
class EmbeddingService {
  private BATCH_SIZE = 2048; // OpenAI限制
  private RATE_LIMIT_DELAY = 1000 / 60; // 60 RPM
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      const batch = texts.slice(i, i + this.BATCH_SIZE);
      
      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          encoding_format: 'float'
        });
        
        embeddings.push(...response.data.map(item => item.embedding));
        
        // 速率限制控制
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
        
      } catch (error) {
        if (error.status === 429) {
          // 速率限制，等待后重试
          await new Promise(resolve => setTimeout(resolve, 60000));
          i -= this.BATCH_SIZE; // 重试当前批次
        } else {
          throw error;
        }
      }
    }
    
    return embeddings;
  }
}
```

#### 令牌计数和限制
```typescript
function estimateTokens(text: string): number {
  // 简单估算：1 token ≈ 4个字符
  return Math.ceil(text.length / 4);
}

function validateBatch(texts: string[]): void {
  const totalTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
  
  if (totalTokens > 8192) { // OpenAI批处理限制
    throw new Error(`Batch too large: ${totalTokens} tokens exceeds 8192 limit`);
  }
}
```

### 2.3 重排模型集成

#### 搜索结果重排
```typescript
async rerankResults(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  if (results.length <= 1) return results;
  
  const prompt = this.buildRerankPrompt(query, results);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: '你是一个代码搜索助手，需要根据查询相关性对搜索结果进行重排。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  });
  
  return this.parseRerankResponse(response.choices[0].message.content, results);
}

private buildRerankPrompt(query: string, results: SearchResult[]): string {
  return `
查询: "${query}"

请对以下搜索结果按相关性从高到低排序，只返回排序后的ID列表：

${results.map((result, index) => 
  `${index + 1}. [ID: ${result.id}] ${result.content.substring(0, 200)}...`
).join('\n')}

请只返回排序后的数字序列，例如: "3,1,2,4"
  `;
}
```

## ⚡ 性能优化策略

### MCP协议优化

#### 连接池管理
```typescript
// MCP服务器连接池配置
const server = new Server({
  name: 'codebase-index-service',
  version: '1.0.0',
  capabilities: {
    tools: {},
    resources: {},
    logging: {}
  },
  connection: {
    maxConnections: 50,
    timeout: 30000,
    heartbeatInterval: 10000
  }
});
```

### 3.1 内存管理

#### 流式处理
```typescript
async function* processLargeCodebase(rootPath: string) {
  const files = await findAllCodeFiles(rootPath);
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const chunks = chunkText(content, 1000); // 分块处理
    
    for (const chunk of chunks) {
      yield {
        filePath: file,
        content: chunk,
        metadata: extractMetadata(content)
      };
    }
    
    // 定期垃圾回收
    if (files.indexOf(file) % 100 === 0) {
      global.gc?.();
    }
  }
}
```

#### 磁盘缓存
```typescript
class DiskCache {
  private cacheDir: string;
  
  async getEmbedding(text: string): Promise<number[] | null> {
    const hash = createHash('md5').update(text).digest('hex');
    const cacheFile = path.join(this.cacheDir, `${hash}.json`);
    
    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  async setEmbedding(text: string, embedding: number[]): Promise<void> {
    const hash = createHash('md5').update(text).digest('hex');
    const cacheFile = path.join(this.cacheDir, `${hash}.json`);
    
    await fs.writeFile(cacheFile, JSON.stringify(embedding));
  }
}
```

### 3.2 网络优化

#### 连接池管理
```typescript
// Qdrant连接池
class QdrantConnectionPool {
  private connections: QdrantClient[] = [];
  private maxConnections = 10;
  
  async getConnection(): Promise<QdrantClient> {
    if (this.connections.length < this.maxConnections) {
      const client = new QdrantClient({ host: '127.0.0.1', port: 6333 });
      this.connections.push(client);
      return client;
    }
    
    // 返回最少使用的连接
    return this.connections[Math.floor(Math.random() * this.connections.length)];
  }
}
```

#### 请求压缩
```typescript
// 压缩嵌入请求
async function getCompressedEmbedding(text: string): Promise<number[]> {
  // 预处理文本，移除不必要的空格和注释
  const compressedText = compressText(text);
  
  // 使用更小的模型进行简单文本
  if (compressedText.length < 100) {
    return getFastEmbedding(compressedText);
  }
  
  return getFullEmbedding(text);
}
```

## 🛡️ 错误处理和重试机制

### MCP协议错误处理

MCP服务器提供协议级错误处理：

```typescript
// MCP工具错误处理
server.setToolHandler('searchCode', async (params) => {
  try {
    const results = await searchService.search(params.query);
    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new ToolError('数据库查询失败', { code: 'DATABASE_ERROR' });
    }
    throw error;
  }
});
```

### 客户端错误处理

Qdrant客户端提供完善的错误处理机制：

```typescript
try {
  await client.search('code-snippets', {
    vector: await getEmbedding(query),
    limit: 10,
    with_payload: true
  });
} catch (error) {
  if (error instanceof QdrantError) {
    console.error('Qdrant操作失败:', error.message);
    // 根据错误类型进行重试或降级处理
  } else {
    throw error;
  }
}
```

## 4. 监控和日志

### 4.1 性能监控

```typescript
interface PerformanceMetrics {
  embeddingTime: number;
  indexingTime: number;
  searchTime: number;
  memoryUsage: number;
  apiCalls: number;
  cacheHits: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    embeddingTime: 0,
    indexingTime: 0,
    searchTime: 0,
    memoryUsage: 0,
    apiCalls: 0,
    cacheHits: 0
  };
  
  trackOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    return fn().then(result => {
      const duration = Date.now() - startTime;
      const memoryDelta = process.memoryUsage().heapUsed - startMemory;
      
      this.metrics[`${operation}Time`] += duration;
      this.metrics.memoryUsage = Math.max(this.metrics.memoryUsage, memoryDelta);
      
      if (operation === 'embedding') {
        this.metrics.apiCalls++;
      }
      
      return result;
    });
  }
}
```

### 4.2 错误监控

```typescript
class ErrorTracker {
  private errors: Map<string, number> = new Map();
  
  trackError(error: Error, context: string = '') {
    const errorKey = `${error.name}:${error.message}:${context}`;
    const count = this.errors.get(errorKey) || 0;
    this.errors.set(errorKey, count + 1);
    
    // 报告频繁错误
    if (count >= 5) {
      console.warn(`频繁错误: ${errorKey} (${count}次)`);
    }
  }
  
  getErrorReport(): string {
    return Array.from(this.errors.entries())
      .map(([error, count]) => `${error}: ${count}次`)
      .join('\n');
  }
}
```

## 5. 安全考虑

### 5.1 API密钥安全

```typescript
class SecureConfig {
  private encryptedApiKey: string;
  
  constructor() {
    this.encryptedApiKey = this.encrypt(process.env.OPENAI_API_KEY);
  }
  
  private encrypt(text: string): string {
    // 使用环境特定的加密
    const salt = process.env.SECRET_SALT || 'default-salt';
    return createHash('sha256').update(text + salt).digest('hex');
  }
  
  getApiKey(): string {
    return process.env.OPENAI_API_KEY; // 实际使用时从安全存储获取
  }
}
```

### 5.2 输入验证

```typescript
function validateInput(text: string): void {
  // 防止注入攻击
  if (text.includes('${') || text.includes('`')) {
    throw new Error('潜在的安全风险：输入包含可疑字符');
  }
  
  // 长度限制
  if (text.length > 10000) {
    throw new Error('输入文本过长');
  }
  
  // 编码验证
  if (!isValidUtf8(text)) {
    throw new Error('无效的文本编码');
  }
}
```

## 6. 测试策略

### 6.1 单元测试示例

```typescript
describe('EmbeddingService', () => {
  let service: EmbeddingService;
  
  beforeEach(() => {
    service = new EmbeddingService();
  });
  
  test('should handle batch embedding', async () => {
    const texts = ['hello', 'world'];
    const embeddings = await service.embedBatch(texts);
    
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(1536);
  });
  
  test('should respect rate limiting', async () => {
    const startTime = Date.now();
    const texts = Array(100).fill('test');
    
    await service.embedBatch(texts);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeGreaterThan(1000); // 至少1秒延迟
  });
});
```

### 6.2 集成测试

```typescript
describe('QdrantIntegration', () => {
  let qdrant: QdrantClient;
  
  beforeAll(async () => {
    qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });
    await qdrant.createCollection('test-index', {
      vectors: { size: 1536, distance: 'Cosine' }
    });
  });
  
  afterAll(async () => {
    await qdrant.deleteCollection('test-index');
  });
  
  test('should store and retrieve vectors', async () => {
    const point = {
      id: 1,
      vector: Array(1536).fill(0.1),
      payload: { text: 'test' }
    };
    
    await qdrant.upsert('test-index', { points: [point] });
    
    const results = await qdrant.search('test-index', {
      vector: Array(1536).fill(0.1),
      limit: 1
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].payload.text).toBe('test');
  });
});
```

---

*最后更新: 2024-12-20*
*版本: v1.0.0*
*状态: 技术调研完成*