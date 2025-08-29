# 代码库索引MCP服务 - 项目结构文档

## 📁 项目概述

本文档详细描述了独立的代码库索引MCP服务的项目结构，该服务与Kode CLI分离，通过MCP协议提供代码索引和结构分析功能。

**🚀 架构增强**: 集成智能语法解析、多嵌入器提供商支持、路径段索引、增量实时索引和全方位监控体系。

## 🏗️ 项目结构

```
codebase-index-mcp/
├── 📁 src/                    # 源代码目录
│   ├── 📁 core/              # 核心模块
│   │   ├── container.ts      # 依赖注入容器
│   │   ├── config.ts         # 配置管理
│   │   └── logger.ts         # 日志系统
│   ├── 📁 services/          # 服务层
│   │   ├── index/
│   │   │   ├── index-service.ts        # 索引服务
│   │   │   ├── vector-store.ts         # 向量存储
│   │   │   ├── search-service.ts       # 搜索服务
│   │   │   └── incremental-indexer.ts  # 增量索引器
│   │   ├── reranking/
│   │   │   ├── reranking-service.ts    # 重排服务
│   │   │   ├── semantic-reranker.ts    # 语义重排器
│   │   │   ├── graph-enhancer.ts       # 图关系增强器
│   │   │   ├── feature-optimizer.ts    # 特征优化器
│   │   │   ├── fusion-engine.ts        # 结果融合引擎
│   │   │   └── learning-optimizer.ts   # 学习优化器
│   │   ├── similarity/
│   │   │   ├── similarity-service.ts   # 相似度计算服务
│   │   │   ├── vector-similarity.ts    # 向量相似度计算
│   │   │   ├── structural-similarity.ts # 结构相似度计算
│   │   │   ├── contextual-similarity.ts # 上下文相似度计算
│   │   │   └── feature-similarity.ts   # 特征相似度计算
│   │   ├── parser/
│   │   │   ├── smart-parser.ts         # 智能代码解析器
│   │   │   ├── tree-sitter-manager.ts   # Tree-sitter管理器
│   │   │   └── markdown-processor.ts   # Markdown处理器
│   │   ├── graph/
│   │   │   ├── graph-service.ts         # 图分析服务
│   │   │   ├── nebula-graph-connector.ts      # Nebula Graph连接管理
│   │   │   └── graph-builder.ts        # 图构建器
│   │   ├── monitoring/
│   │   │   ├── monitoring-service.ts   # 监控服务
│   │   │   ├── metrics-collector.ts    # 指标收集器
│   │   │   ├── error-handler.ts        # 错误处理器
│   │   │   └── health-check.ts          # 健康检查
│   │   └── rules/
│   │       ├── rule-engine.ts          # 规则引擎
│   │       ├── language-rules/         # 语言特定规则
│   │       └── framework-rules/         # 框架特定规则
│   ├── 📁 mcp/               # MCP协议处理
│   │   ├── server.ts         # MCP服务器
│   │   ├── tools/            # MCP工具定义
│   │   │   ├── search-tool.ts
│   │   │   ├── index-tool.ts
│   │   │   ├── analyze-tool.ts
│   │   │   └── rule-tool.ts
│   │   └── resources/        # MCP资源定义
│   ├── 📁 embedders/          # 嵌入器提供商
│   │   ├── embedder-factory.ts          # 嵌入器工厂
│   │   ├── openai-embedder.ts          # OpenAI嵌入器
│   │   ├── ollama-embedder.ts          # Ollama嵌入器
│   │   ├── gemini-embedder.ts          # Gemini嵌入器
│   │   └── mistral-embedder.ts         # Mistral嵌入器
│   ├── 📁 database/          # 数据库客户端
│   │   ├── qdrant-client.ts  # Qdrant客户端
│   ├── nebula-graph-client.ts   # Nebula Graph客户端
│   └── redis-client.ts   # Redis缓存客户端
│   ├── 📁 models/            # 数据模型
│   │   ├── index-model.ts    # 索引数据模型
│   │   ├── graph-model.ts    # 图数据模型
│   │   ├── embedder-model.ts # 嵌入器模型
│   │   ├── parser-model.ts   # 解析器模型
│   │   ├── monitoring-model.ts # 监控模型
│   │   ├── reranking-model.ts # 重排数据模型
│   │   ├── similarity-model.ts # 相似度计算模型
│   │   ├── fusion-model.ts   # 融合引擎模型
│   │   └── learning-model.ts # 学习优化模型
│   ├── 📁 utils/             # 工具函数
│   │   ├── file-utils.ts     # 文件处理
│   │   ├── text-utils.ts     # 文本处理
│   │   ├── hash-utils.ts     # 哈希工具
│   │   ├── path-utils.ts     # 路径工具
│   │   ├── file-watcher.ts   # 文件监视器
│   │   └── validation.ts     # 数据验证
│   ├── 📁 config/            # 配置管理
│   │   ├── env.ts            # 环境配置
│   │   ├── embedder.ts       # 嵌入器配置
│   │   ├── monitoring.ts     # 监控配置
│   │   └── mcp.ts            # MCP服务器配置
│   └── main.ts               # 应用入口
├── 📁 rules/                 # 规则文件目录
│   ├── 📁 javascript/       # JavaScript规则
│   ├── 📁 typescript/       # TypeScript规则
│   ├── 📁 python/           # Python规则
│   ├── 📁 java/             # Java规则
│   ├── 📁 go/               # Go规则
│   └── 📁 rust/             # Rust规则
├── 📁 test/                  # 测试目录
│   ├── 📁 unit/             # 单元测试
│   ├── 📁 integration/      # 集成测试
│   ├── 📁 e2e/              # 端到端测试
│   └── 📁 performance/       # 性能测试
├── 📁 dist/                  # 编译输出目录
├── 📁 docs/                  # 项目文档
├── 📁 scripts/               # 脚本文件
├── 📁 monitoring/            # 监控配置
│   ├── prometheus.yml       # Prometheus配置
│   ├── grafana/             # Grafana仪表板
│   └── alerts/              # 警报规则
├── .env                      # 环境变量配置
├── .env.example              # 环境变量示例
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript配置
├── jest.config.js           # Jest测试配置
├── docker-compose.yml        # Docker编排配置
└── docker-compose.monitoring.yml # 监控服务配置
```

## 🔧 核心模块说明

### 1. 核心模块 (core/)

**container.ts** - 依赖注入容器
```typescript
import { Container } from 'inversify';

const container = new Container();

// 注册数据库客户端
container.bind<QdrantClient>('QdrantClient').toConstantValue(qdrantClient);
container.bind<NebulaGraph>('NebulaGraphDriver').toConstantValue(nebulaGraphDriver);
container.bind<OpenAI>('OpenAIClient').toConstantValue(openaiClient);

// 注册服务
container.bind<IndexService>('IndexService').to(IndexService);
container.bind<SearchService>('SearchService').to(SearchService);
container.bind<GraphService>('GraphService').to(GraphService);
container.bind<RuleService>('RuleService').to(RuleService);
```

**config.ts** - 配置管理
```typescript
import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  mcp: {
    port: number;
    host: string;
    name: string;
  };
  qdrant: {
    url: string;
    collection: string;
  };
  nebulaGraph: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  rules: {
    directory: string;
    maxFiles: number;
  };
}

export const config: AppConfig = {
  mcp: {
    port: parseInt(process.env.MCP_PORT || '8000'),
    host: process.env.MCP_HOST || 'localhost',
    name: process.env.MCP_NAME || 'codebase-index-service'
  },
  nebulaGraph: {
    host: process.env.NEBULA_HOST || '127.0.0.1',
    port: parseInt(process.env.NEBULA_PORT || '9669'),
    username: process.env.NEBULA_USERNAME || 'root',
    password: process.env.NEBULA_PASSWORD || 'nebula',
    space: process.env.NEBULA_SPACE || 'codebase_index'
  }
  // ... 其他配置
};
```

### 2. 服务层 (services/)

**index-service.ts** - 索引服务
```typescript
import { inject, injectable } from 'inversify';
import { QdrantClient } from '../database/qdrant-client';
import { OpenAI } from '../database/openai-client';

@injectable()
export class IndexService {
  constructor(
    @inject('QdrantClient') private qdrantClient: QdrantClient,
    @inject('OpenAIClient') private openaiClient: OpenAI
  ) {}

  async indexCodeSnippet(snippet: CodeSnippet): Promise<void> {
    const embedding = await this.generateEmbedding(snippet.content);
    await this.qdrantClient.upsertPoint(snippet.id, embedding, snippet);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // OpenAI嵌入生成逻辑
  }
}
```

**graph-service.ts** - 图分析服务
```typescript
@injectable()
export class GraphService {
  constructor(
    @inject('NebulaGraphDriver') private nebulaGraphDriver: NebulaGraph
  ) {}

  async analyzeCodeStructure(files: CodeFile[]): Promise<CodeGraph> {
    // 代码结构分析逻辑
    const graph = await this.buildCallGraph(files);
    await this.persistGraph(graph);
    return graph;
  }
}
```

**rule-service.ts** - 规则引擎服务
```typescript
@injectable()
export class RuleService {
  private rules: Map<string, LanguageRule> = new Map();

  async loadRules(directory: string): Promise<void> {
    // 从文件系统加载规则
    const ruleFiles = await this.findRuleFiles(directory);
    for (const file of ruleFiles) {
      const rule = await this.loadRuleFromFile(file);
      this.rules.set(rule.language, rule);
    }
  }

  getRuleForLanguage(language: string): LanguageRule | undefined {
    return this.rules.get(language);
  }

  async importRule(rule: LanguageRule): Promise<void> {
    this.rules.set(rule.language, rule);
    await this.saveRuleToFile(rule);
  }
}
```

**reranking-service.ts** - 重排服务
```typescript
@injectable()
export class RerankingService {
  constructor(
    @inject('SemanticReranker') private semanticReranker: SemanticReranker,
    @inject('GraphEnhancer') private graphEnhancer: GraphEnhancer,
    @inject('FeatureOptimizer') private featureOptimizer: FeatureOptimizer
  ) {}

  async multiStageRerank(
    results: MultiModalResults,
    query: string,
    context: SearchContext
  ): Promise<RerankedResult[]> {
    // 第一阶段：语义重排
    const semanticReranked = await this.semanticReranker.rerank(
      results.semantic,
      query,
      context
    );
    
    // 第二阶段：图关系增强
    const graphEnhanced = await this.graphEnhancer.enhance(
      semanticReranked,
      results.graph,
      context
    );
    
    // 第三阶段：代码特征优化
    const featureOptimized = await this.featureOptimizer.optimize(
      graphEnhanced,
      results.keyword,
      query,
      context
    );
    
    return featureOptimized;
  }
}
```

**similarity-service.ts** - 相似度计算服务
```typescript
@injectable()
export class SimilarityService {
  async calculateSimilarity(
    item1: CodeItem,
    item2: CodeItem,
    metrics: SimilarityMetrics[] = ['cosine', 'structural', 'contextual']
  ): Promise<SimilarityResult> {
    const results: SimilarityResult = {
      overall: 0,
      metrics: {}
    };
    
    // 向量相似度
    if (metrics.includes('cosine')) {
      results.metrics.cosine = await this.calculateCosineSimilarity(
        item1.vector,
        item2.vector
      );
    }
    
    // 结构相似度
    if (metrics.includes('structural')) {
      results.metrics.structural = await this.calculateStructuralSimilarity(
        item1.ast,
        item2.ast
      );
    }
    
    // 上下文相似度
    if (metrics.includes('contextual')) {
      results.metrics.contextual = await this.calculateContextualSimilarity(
        item1.context,
        item2.context
      );
    }
    
    // 计算综合相似度
    results.overall = this.calculateOverallSimilarity(results.metrics);
    
    return results;
  }
}
```

### 3. MCP协议处理 (mcp/)

**server.ts** - MCP服务器
```typescript
import { Server } from '@modelcontextprotocol/server';
import { SearchTool } from './tools/search-tool';
import { IndexTool } from './tools/index-tool';
import { AnalyzeTool } from './tools/analyze-tool';
import { RuleTool } from './tools/rule-tool';

export class CodebaseIndexServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: 'codebase-index-service',
      version: '1.0.0'
    });

    this.registerTools();
  }

  private registerTools(): void {
    this.server.setToolHandler('searchCode', SearchTool.handle);
    this.server.setToolHandler('indexCode', IndexTool.handle);
    this.server.setToolHandler('analyzeStructure', AnalyzeTool.handle);
    this.server.setToolHandler('importRule', RuleTool.handle);
  }

  async start(): Promise<void> {
    await this.server.listen({
      port: config.mcp.port,
      host: config.mcp.host
    });
  }
}
```

**tools/search-tool.ts** - 增强搜索工具
```typescript
export class EnhancedSearchTool {
  static async handle(params: any): Promise<any> {
    const { 
      query, 
      limit = 10,
      useReranking = true,
      rerankingStrategy = 'hybrid',
      similarityMetrics = ['cosine', 'structural', 'contextual'],
      fusionWeights
    } = params;
    
    const searchOptions: EnhancedSearchOptions = {
      limit,
      useReranking,
      rerankingStrategy,
      similarityMetrics,
      fusionWeights
    };
    
    const results = await container.get<EnhancedSearchService>('EnhancedSearchService')
      .enhancedSearch(query, searchOptions);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results,
          metadata: {
            query,
            strategy: rerankingStrategy,
            totalResults: results.length,
            processingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0)
          }
        }, null, 2)
      }]
    };
  }
}
```

**tools/reranking-tool.ts** - 重排配置工具
```typescript
export class RerankingTool {
  static async handle(params: any): Promise<any> {
    const { 
      action,
      strategy,
      weights,
      threshold 
    } = params;
    
    switch (action) {
      case 'configure':
        await container.get<RerankingService>('RerankingService')
          .configureStrategy(strategy, weights);
        break;
      case 'analyze':
        const analysis = await container.get<RerankingService>('RerankingService')
          .analyzePerformance(strategy);
        return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
      case 'optimize':
        const optimization = await container.get<RerankingService>('RerankingService')
          .autoOptimize(threshold);
        return { content: [{ type: 'text', text: JSON.stringify(optimization, null, 2) }] };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: `Reranking configuration updated: ${strategy}`
      }]
    };
  }
}
```

**tools/rule-tool.ts** - 规则导入工具
```typescript
export class RuleTool {
  static async handle(params: any): Promise<any> {
    const { language, rules } = params;
    
    const ruleService = container.get<RuleService>('RuleService');
    await ruleService.importRule({
      language,
      rules: JSON.parse(rules)
    });
    
    return {
      content: [{
        type: 'text',
        text: `规则已成功导入: ${language}`
      }]
    };
  }
}
```

### 4. 数据库客户端 (database/)

**qdrant-client.ts** - Qdrant客户端封装
```typescript
export class QdrantClientWrapper {
  private client: QdrantClient;

  constructor(url: string) {
    this.client = new QdrantClient({ url });
  }

  async upsertPoint(id: string, vector: number[], payload: any): Promise<void> {
    await this.client.upsert('code-snippets', {
      points: [{
        id,
        vector,
        payload
      }]
    });
  }

  async searchSimilar(vector: number[], limit: number = 10): Promise<any[]> {
    const results = await this.client.search('code-snippets', {
      vector,
      limit,
      with_payload: true
    });
    
    return results;
  }
}
```

**nebula-graph-client.ts** - Nebula Graph客户端封装
```typescript
export class NebulaGraphClientWrapper {
  private client: NebulaClient;

  constructor(host: string, port: number, username: string, password: string, space: string) {
    this.client = createClient({ host, port, username, password, space });
  }

  async createNode(tag: string, properties: any): Promise<void> {
    const session = this.client.session();
    try {
      await session.execute(
        `INSERT VERTEX ${tag}(${Object.keys(properties).join(',')}) VALUES $properties`,
        { properties }
      );
    } finally {
      await session.close();
    }
  }

  async createRelationship(
    srcTag: string,
    srcProps: any,
    dstTag: string, 
    dstProps: any,
    edgeType: string,
    edgeProps: any = {}
  ): Promise<void> {
    const session = this.client.session();
    try {
      await session.execute(`
        INSERT EDGE ${edgeType}(${Object.keys(edgeProps).join(',')}) 
        VALUES ${srcProps.id} -> ${dstProps.id}:(${Object.values(edgeProps).map(v => `"${v}"`).join(',')})
      `);
    } finally {
      await session.close();
    }
  }
}
```

## 📋 配置文件

### 增强package.json 配置
```json
{
  "name": "codebase-index-mcp",
  "version": "1.0.0",
  "description": "独立MCP服务，提供代码库索引和结构分析功能，支持多层次重排和智能相似度计算",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "test:unit": "jest --testPathPattern=\"unit\"",
    "test:integration": "jest --testPathPattern=\"integration\"",
    "test:e2e": "jest --testPathPattern=\"e2e\"",
    "test:performance": "jest --testPathPattern=\"performance\"",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "@modelcontextprotocol/types": "^1.0.0",
    "@qdrant/js-client-rest": "^1.10.0",
    "@nebula-contrib/nebula-nodejs": "^1.0.0",
    "openai": "^5.15.0",
    "inversify": "^6.0.0",
    "reflect-metadata": "^0.1.13",
    "dotenv": "^16.0.0",
    "lodash": "^4.17.21",
    "natural": "^6.12.0",
    "ml-matrix": "^6.10.4",
    "fast-levenshtein": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "eslint": "^8.0.0",
    "@types/lodash": "^4.14.199",
    "@types/natural": "^5.1.4"
  }
}
```

### Docker Compose 配置
```yaml
version: '3.8'

services:
  qdrant:
    image: qdrant/qdrant:v1.10.0
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - codebase-network

  nebula-graph:
    image: vesoft/nebula-graphd:v3.8.0
    ports:
      - "9669:9669"
      - "19669:19669"
    environment:
      - USER=root
      - PASSWORD=nebula
    networks:
      - codebase-network
  nebula-metad:
    image: vesoft/nebula-metad:v3.8.0
    environment:
      - USER=root
      - PASSWORD=nebula
    networks:
      - codebase-network
  nebula-storaged:
    image: vesoft/nebula-storaged:v3.8.0
    environment:
      - USER=root
      - PASSWORD=nebula
    networks:
      - codebase-network

  codebase-index-mcp:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MCP_PORT=8000
      - MCP_HOST=0.0.0.0
      - QDRANT_URL=http://qdrant:6333
      - NEBULA_HOST=nebula-graph
      - NEBULA_PORT=9669
      - NEBULA_USERNAME=root
      - NEBULA_PASSWORD=nebula
      - NEBULA_SPACE=codebase_index
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - qdrant
      - nebula-graph
      - nebula-metad
      - nebula-storaged
    networks:
      - codebase-network

volumes:
  qdrant_data:
  nebula_data:

networks:
  codebase-network:
    driver: bridge
```

## 🚀 部署和运行

### 本地开发
```bash
# 克隆项目
git clone <repository-url>
cd codebase-index-mcp

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env文件配置必要的参数

# 启动依赖服务
docker-compose up -d qdrant nebula-graph nebula-metad nebula-storaged

# 开发模式运行
npm run dev

# 或者构建后运行
npm run build
npm start
```

### 生产部署
```bash
# 构建生产版本
npm run build

# 使用Docker部署
docker-compose up -d

# 或者使用PM2进程管理
npm install -g pm2
pm2 start dist/main.js --name "codebase-index-mcp"
```

## 🔌 Kode CLI集成

### Kode配置
在Kode CLI的配置文件中添加MCP服务器连接：

```json
{
  "mcpServers": {
    "codebase-index": {
      "command": "node",
      "args": ["/path/to/codebase-index-mcp/dist/main.js"],
      "env": {
        "MCP_PORT": "8000",
        "QDRANT_URL": "http://localhost:6333",
        "NEBULA_HOST": "localhost",
        "NEBULA_PORT": "9669",
        "NEBULA_USERNAME": "root",
        "NEBULA_PASSWORD": "nebula",
        "NEBULA_SPACE": "codebase_index",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 使用示例
Kode CLI通过MCP协议调用服务：

```bash
# 搜索代码
kode search "function definition"

# 索引代码库
kode index /path/to/project

# 分析代码结构  
kode analyze /path/to/project

# 导入自定义规则
kode import-rule javascript ./custom-rules/js-rules.json
```

## 📊 监控和日志

### 日志配置
```typescript
// src/core/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 跨数据库健康检查
```typescript
// 添加增强型健康检查端点
server.setResourceHandler('health', async () => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      qdrant: await this.checkQdrantHealth(),
      nebulaGraph: await this.checkNebulaGraphHealth(),
      openai: await this.checkOpenAIHealth(),
      sync: await this.checkCrossDatabaseSync()
    },
    metrics: {
      qdrantLatency: await this.getQdrantLatency(),
      nebulaGraphLatency: await this.getNebulaGraphLatency(),
      syncDelay: await this.getSyncDelay()
    }
  };
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(status, null, 2)
    }]
  };
});
```

### 综合监控仪表板
```typescript
// src/services/monitoring/MonitoringDashboard.ts
export class MonitoringDashboard {
  private prometheusClient: PrometheusClient;
  private grafanaClient: GrafanaClient;
  
  async initialize(): Promise<void> {
    // 初始化跨数据库监控指标
    this.setupCrossDatabaseMetrics();
    this.setupQueryCoordinationMetrics();
    this.setupSyncMetrics();
  }
  
  private setupCrossDatabaseMetrics(): void {
    // Qdrant性能指标
    new Prometheus.Gauge({
      name: 'qdrant_search_latency_seconds',
      help: 'Qdrant search latency in seconds',
      labelNames: ['operation', 'status']
    });
    
    // NebulaGraph性能指标
    new Prometheus.Gauge({
      name: 'nebula_graph_query_latency_seconds',
      help: 'NebulaGraph query latency in seconds',
      labelNames: ['query_type', 'status']
    });
    
    // 跨数据库协调指标
    new Prometheus.Gauge({
      name: 'cross_database_sync_delay_seconds',
      help: 'Cross-database synchronization delay in seconds'
    });
  }
  
  private setupQueryCoordinationMetrics(): void {
    // 查询融合性能
    new Prometheus.Histogram({
      name: 'query_fusion_duration_seconds',
      help: 'Query fusion processing time in seconds',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0]
    });
    
    // 结果缓存命中率
    new Prometheus.Gauge({
      name: 'query_cache_hit_rate',
      help: 'Query cache hit rate percentage'
    });
  }
  
  private setupSyncMetrics(): void {
    // 同步操作计数
    new Prometheus.Counter({
      name: 'sync_operations_total',
      help: 'Total number of sync operations',
      labelNames: ['operation_type', 'status']
    });
    
    // 一致性检查结果
    new Prometheus.Gauge({
      name: 'consistency_check_status',
      help: 'Consistency check status (1=consistent, 0=inconsistent)'
    });
  }
}
```

### 智能警报系统
```typescript
// src/services/monitoring/AlertManager.ts
export class AlertManager {
  private alertRules: AlertRule[] = [
    {
      name: 'qdrant_latency_high',
      condition: 'qdrant_search_latency_seconds > 1.0',
      severity: 'warning',
      message: 'Qdrant search latency is high'
    },
    {
      name: 'nebula_graph_latency_high',
      condition: 'nebula_graph_query_latency_seconds > 2.0',
      severity: 'warning',
      message: 'NebulaGraph query latency is high'
    },
    {
      name: 'sync_delay_critical',
      condition: 'cross_database_sync_delay_seconds > 30',
      severity: 'critical',
      message: 'Cross-database sync delay is critical'
    },
    {
      name: 'consistency_failed',
      condition: 'consistency_check_status == 0',
      severity: 'critical',
      message: 'Database consistency check failed'
    }
  ];
  
  async evaluateAlerts(metrics: MetricsData): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    for (const rule of this.alertRules) {
      if (this.evaluateCondition(rule.condition, metrics)) {
        alerts.push({
          ...rule,
          timestamp: new Date().toISOString(),
          metrics: this.extractRelevantMetrics(rule.condition, metrics)
        });
      }
    }
    
    return alerts;
  }
}
```

这个项目结构提供了完整的MCP服务实现，与Kode CLI完全分离，通过标准MCP协议进行通信，支持代码索引、搜索、结构分析和规则导入等功能。