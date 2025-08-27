# 代码库索引MCP服务 - 项目结构文档

## 📁 项目概述

本文档详细描述了独立的代码库索引MCP服务的项目结构，该服务与Kode CLI分离，通过MCP协议提供代码索引和结构分析功能。

## 🏗️ 项目结构

```
codebase-index-mcp/
├── 📁 src/                    # 源代码目录
│   ├── 📁 core/              # 核心模块
│   │   ├── container.ts      # 依赖注入容器
│   │   ├── config.ts         # 配置管理
│   │   └── logger.ts         # 日志系统
│   ├── 📁 services/          # 服务层
│   │   ├── index-service.ts  # 索引服务
│   │   ├── search-service.ts # 搜索服务
│   │   ├── graph-service.ts  # 图分析服务
│   │   └── rule-service.ts   # 规则引擎服务
│   ├── 📁 mcp/               # MCP协议处理
│   │   ├── server.ts         # MCP服务器
│   │   ├── tools/            # MCP工具定义
│   │   │   ├── search-tool.ts
│   │   │   ├── index-tool.ts
│   │   │   ├── analyze-tool.ts
│   │   │   └── rule-tool.ts
│   │   └── resources/        # MCP资源定义
│   ├── 📁 database/          # 数据库客户端
│   │   ├── qdrant-client.ts  # Qdrant客户端
│   │   ├── neo4j-client.ts   # Neo4j客户端
│   │   └── openai-client.ts  # OpenAI客户端
│   ├── 📁 models/            # 数据模型
│   │   ├── index-model.ts    # 索引数据模型
│   │   ├── graph-model.ts    # 图数据模型
│   │   └── rule-model.ts     # 规则模型
│   ├── 📁 utils/             # 工具函数
│   │   ├── file-utils.ts     # 文件处理
│   │   ├── text-utils.ts     # 文本处理
│   │   └── validation.ts     # 数据验证
│   └── main.ts               # 应用入口
├── 📁 rules/                 # 规则文件目录
│   ├── 📁 javascript/       # JavaScript规则
│   ├── 📁 typescript/       # TypeScript规则
│   ├── 📁 python/           # Python规则
│   └── 📁 java/             # Java规则
├── 📁 test/                  # 测试目录
│   ├── 📁 unit/             # 单元测试
│   ├── 📁 integration/      # 集成测试
│   └── 📁 e2e/              # 端到端测试
├── 📁 dist/                  # 编译输出目录
├── 📁 docs/                  # 项目文档
├── 📁 scripts/               # 脚本文件
├── .env                      # 环境变量配置
├── .env.example              # 环境变量示例
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript配置
├── jest.config.js           # Jest测试配置
└── docker-compose.yml        # Docker编排配置
```

## 🔧 核心模块说明

### 1. 核心模块 (core/)

**container.ts** - 依赖注入容器
```typescript
import { Container } from 'inversify';

const container = new Container();

// 注册数据库客户端
container.bind<QdrantClient>('QdrantClient').toConstantValue(qdrantClient);
container.bind<neo4j.Driver>('Neo4jDriver').toConstantValue(neo4jDriver);
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
  neo4j: {
    uri: string;
    username: string;
    password: string;
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
    @inject('Neo4jDriver') private neo4jDriver: neo4j.Driver
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

**tools/search-tool.ts** - 搜索工具
```typescript
export class SearchTool {
  static async handle(params: any): Promise<any> {
    const { query, limit = 10 } = params;
    
    const results = await container.get<SearchService>('SearchService')
      .search(query, limit);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
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

**neo4j-client.ts** - Neo4j客户端封装
```typescript
export class Neo4jClientWrapper {
  private driver: neo4j.Driver;

  constructor(uri: string, username: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }

  async createNode(label: string, properties: any): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (n:${label} $properties) RETURN n`,
        { properties }
      );
    } finally {
      await session.close();
    }
  }

  async createRelationship(
    fromLabel: string,
    fromProps: any,
    toLabel: string, 
    toProps: any,
    relType: string,
    relProps: any = {}
  ): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(`
        MATCH (a:${fromLabel} $fromProps), (b:${toLabel} $toProps)
        CREATE (a)-[r:${relType} $relProps]->(b)
        RETURN r
      `, { fromProps, toProps, relProps });
    } finally {
      await session.close();
    }
  }
}
```

## 📋 配置文件

### package.json 配置
```json
{
  "name": "codebase-index-mcp",
  "version": "1.0.0",
  "description": "独立MCP服务，提供代码库索引和结构分析功能",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "test:unit": "jest --testPathPattern=\"unit\"",
    "test:integration": "jest --testPathPattern=\"integration\"",
    "test:e2e": "jest --testPathPattern=\"e2e\"",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "@modelcontextprotocol/types": "^1.0.0",
    "@qdrant/js-client-rest": "^1.10.0",
    "neo4j-driver": "^5.20.0",
    "openai": "^5.15.0",
    "inversify": "^6.0.0",
    "reflect-metadata": "^0.1.13",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "eslint": "^8.0.0"
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

  neo4j:
    image: neo4j:5.20.0
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_server_memory_pagecache_size=2G
      - NEO4J_server_memory_heap_max__size=4G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
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
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=password
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - qdrant
      - neo4j
    networks:
      - codebase-network

volumes:
  qdrant_data:
  neo4j_data:
  neo4j_logs:

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
docker-compose up -d qdrant neo4j

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
        "NEO4J_URI": "bolt://localhost:7687",
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

### 健康检查
```typescript
// 添加健康检查端点
server.setResourceHandler('health', async () => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      qdrant: await this.checkQdrantHealth(),
      neo4j: await this.checkNeo4jHealth(),
      openai: await this.checkOpenAIHealth()
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

这个项目结构提供了完整的MCP服务实现，与Kode CLI完全分离，通过标准MCP协议进行通信，支持代码索引、搜索、结构分析和规则导入等功能。