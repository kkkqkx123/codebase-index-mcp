# 配置指南

本文档详细介绍了代码库索引服务的配置选项，包括环境变量、TypeScript配置、包依赖和配置服务结构。

## 环境变量配置 (.env)

### 基础环境配置
```env
NODE_ENV = development  # 运行环境: development, production, test
PORT = 3000            # 服务监听端口
```

### 数据库配置

#### Qdrant 向量数据库
```env
QDRANT_HOST = 127.0.0.1      # Qdrant 主机地址
QDRANT_PORT = 6333           # Qdrant 端口
QDRANT_COLLECTION = code-snippets  # 集合名称
```

#### NebulaGraph 图数据库
```env
NEBULA_HOST = 127.0.0.1      # NebulaGraph 主机地址
NEBULA_PORT = 9669           # NebulaGraph 端口
NEBULA_USERNAME = root       # 用户名
NEBULA_PASSWORD = nebula     # 密码
NEBULA_SPACE = codebase_index # 图空间名称
```

### 嵌入模型配置

#### 嵌入提供商选择
```env
EMBEDDING_PROVIDER = siliconflow  # 可选: openai, ollama, gemini, mistral, siliconflow, custom1, custom2, custom3
```

#### OpenAI 配置
```env
OPENAI_BASE_URL = https://api.openai.com
OPENAI_API_KEY = your-openai-api-key-here
OPENAI_MODEL = text-embedding-ada-002
OPENAI_DIMENSIONS = 1536
```

#### Ollama 配置
```env
OLLAMA_BASE_URL = http://localhost:11434
OLLAMA_MODEL = nomic-embed-text
OLLAMA_DIMENSIONS = 768
```

#### Gemini 配置
```env
GEMINI_API_KEY = your-gemini-api-key-here
GEMINI_BASE_URL = https://generativelanguage.googleapis.com
GEMINI_MODEL = embedding-001
GEMINI_DIMENSIONS = 768
```

#### Mistral 配置
```env
MISTRAL_BASE_URL = https://api.mistral.ai
MISTRAL_MODEL = mistral-embed
MISTRAL_DIMENSIONS = 1024
```

#### SiliconFlow 配置
```env
SILICONFLOW_API_KEY = your-SiliconFlow-api-key-here
SILICONFLOW_BASE_URL = https://api.siliconflow.cn/v1
SILICONFLOW_MODEL = BAAI/bge-m3
SILICONFLOW_DIMENSIONS = 1024
```

#### 自定义嵌入器配置
```env
CUSTOM_CUSTOM1_API_KEY = your-custom1-api-key-here
CUSTOM_CUSTOM1_BASE_URL = 
CUSTOM_CUSTOM1_MODEL = your-custom1-model-here
CUSTOM_CUSTOM1_DIMENSIONS = 768

CUSTOM_CUSTOM2_API_KEY = your-custom2-api-key-here
CUSTOM_CUSTOM2_BASE_URL = 
CUSTOM_CUSTOM2_MODEL = your-custom2-model-here
CUSTOM_CUSTOM2_DIMENSIONS = 768

CUSTOM_CUSTOM3_API_KEY = your-custom3-api-key-here
CUSTOM_CUSTOM3_BASE_URL = 
CUSTOM_CUSTOM3_MODEL = your-custom3-model-here
CUSTOM_CUSTOM3_DIMENSIONS = 768
```

### 日志配置
```env
LOG_LEVEL = info      # 日志级别: error, warn, info, debug, verbose
LOG_FORMAT = json     # 日志格式: json, text
```

### 监控配置
```env
ENABLE_METRICS = true    # 是否启用监控指标
METRICS_PORT = 9090     # 监控指标端口
```

### 文件处理配置
```env
MAX_FILE_SIZE = 10485760           # 最大文件大小 (10MB)
SUPPORTED_EXTENSIONS = .ts,.js,.py,.java,.go,.rs,.cpp,.c,.h  # 支持的文件扩展名
INDEX_BATCH_SIZE = 100              # 索引批处理大小
CHUNK_SIZE = 1000                   # 代码块大小
OVERLAP_SIZE = 200                   # 代码块重叠大小
```

### 内存配置
```env
MEMORY_THRESHOLD = 75                # 内存使用阈值百分比
BATCH_MEMORY_THRESHOLD = 75          # 批处理内存阈值
MAX_MEMORY_MB = 2048                 # 最大内存限制 (MB)
MEMORY_WARNING_THRESHOLD = 90        # 内存警告阈值
MEMORY_CRITICAL_THRESHOLD = 95       # 内存严重阈值
MEMORY_EMERGENCY_THRESHOLD = 98      # 内存紧急阈值
NODE_OPTIONS = "--max-old-space-size=2048"  # Node.js 内存限制
```

### 静态分析配置 (Semgrep)
```env
SEMGREP_ENABLED = true               # 是否启用 Semgrep
SEMGREP_CLI_PATH = semgrep           # Semgrep CLI 路径
SEMGREP_RULES_DIR = ./config/semgrep-rules  # 基础规则目录
SEMGREP_ENHANCED_RULES_PATH = ./config/enhanced-rules  # 增强规则目录
SEMGREP_TIMEOUT = 300                # 扫描超时时间 (秒)
SEMGREP_MAX_TARGET_BYTES = 1000000   # 最大目标文件大小
SEMGREP_MAX_CONCURRENT_SCANS = 5    # 最大并发扫描数
SEMGREP_CACHE_ENABLED = true         # 是否启用缓存
SEMGREP_CACHE_TTL = 3600             # 缓存生存时间 (秒)
SEMGREP_SCAN_ON_CHANGE = true        # 文件变更时扫描
SEMGREP_RESULT_RETENTION_DAYS = 30   # 结果保留天数
```

## TypeScript 配置 (tsconfig.json)

### 编译器选项
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@test/setup": ["test/setup.ts"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "downlevelIteration": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "exactOptionalPropertyTypes": false,
    "skipDefaultLibCheck": true,
    "useDefineForClassFields": false
  },
  "include": [
    "src/**/*",
    "test/setup.ts",
    "test/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

## 包依赖配置 (package.json)

### 主要依赖
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.4",      # MCP SDK
    "@nebula-contrib/nebula-nodejs": "^3.0.3",   # NebulaGraph 客户端
    "@qdrant/js-client-rest": "^1.15.1",         # Qdrant 客户端
    "chokidar": "^4.0.3",                        # 文件监听
    "dotenv": "^17.2.1",                         # 环境变量管理
    "express": "^5.1.0",                         # Web 框架
    "inversify": "^7.9.1",                       # 依赖注入
    "joi": "^18.0.1",                            # 数据验证
    "neo4j-driver": "^5.28.1",                   # Neo4j 驱动
    "openai": "^5.16.0",                         # OpenAI API
    "reflect-metadata": "~0.2.2",                # 反射元数据
    "tree-sitter": "^0.25.0",                    # 语法解析器
    "tree-sitter-cpp": "^0.23.4",                # C++ 语法
    "tree-sitter-go": "^0.25.0",                 # Go 语法
    "tree-sitter-java": "^0.23.5",               # Java 语法
    "tree-sitter-javascript": "^0.23.1",         # JavaScript 语法
    "tree-sitter-python": "^0.23.6",             # Python 语法
    "tree-sitter-rust": "^0.24.0",               # Rust 语法
    "tree-sitter-typescript": "^0.23.2",         # TypeScript 语法
    "winston": "^3.17.0"                         # 日志记录
  }
}
```

### 开发依赖
```json
{
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.3.0",
    "@types/supertest": "^6.0.3",
    "@typescript-eslint/eslint-plugin": "^8.41.0",
    "@typescript-eslint/parser": "^8.41.0",
    "eslint": "^9.34.0",
    "husky": "^9.1.7",
    "jest": "^30.1.1",
    "lint-staged": "^16.1.5",
    "prettier": "^3.6.2",
    "rimraf": "^6.0.1",
    "supertest": "^7.1.4",
    "ts-jest": "^29.4.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.2"
  }
}
```

## 配置服务结构

### ConfigService 配置接口
位于 `src/config/ConfigService.ts` 的配置接口定义了完整的配置结构：

```typescript
interface Config {
  nodeEnv: string;
  port: number;
  
  // 数据库配置
  qdrant: {
    host: string;
    port: number;
    collection: string;
  };
  
  nebula: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
  
  // 嵌入配置
  embedding: {
    provider: string;
    openai: { apiKey: string; baseUrl?: string; model: string; dimensions: number; };
    ollama: { baseUrl: string; model: string; dimensions: number; };
    gemini: { apiKey: string; baseUrl?: string; model: string; dimensions: number; };
    mistral: { apiKey: string; baseUrl?: string; model: string; dimensions: number; };
    siliconflow: { apiKey: string; baseUrl?: string; model: string; dimensions: number; };
    custom?: {
      custom1?: { apiKey?: string; baseUrl?: string; model?: string; dimensions?: number; };
      custom2?: { apiKey?: string; baseUrl?: string; model?: string; dimensions?: number; };
      custom3?: { apiKey?: string; baseUrl?: string; model?: string; dimensions?: number; };
    };
  };
  
  // 日志和监控
  logging: { level: string; format: string; };
  monitoring: { enabled: boolean; port: number; };
  
  // 文件处理
  fileProcessing: {
    maxFileSize: number;
    supportedExtensions: string;
    indexBatchSize: number;
    chunkSize: number;
    overlapSize: number;
  };
  
  // 批处理
  batchProcessing: {
    enabled: boolean;
    maxConcurrentOperations: number;
    defaultBatchSize: number;
    maxBatchSize: number;
    memoryThreshold: number;
    processingTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    continueOnError: boolean;
  };
  
  // Semgrep 配置
  semgrep: {
    binaryPath: string;
    timeout: number;
    maxMemory: number;
    maxTargetBytes: number;
    jobs: number;
    noGitIgnore: boolean;
    noRewriteRuleIds: boolean;
    strict: boolean;
    configPaths: string[];
    customRulesPath: string;
    enhancedRulesPath: string;
    outputFormat: 'json' | 'sarif' | 'text';
    excludePatterns: string[];
    includePatterns: string[];
    severityLevels: string[];
  };
}
```

## 配置验证

配置服务使用 Joi 进行严格的配置验证，确保所有配置项的类型和格式正确：

```typescript
const configSchema = Joi.object({
  nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),
  
  qdrant: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(6333),
    collection: Joi.string().default('code-snippets')
  }),
  
  // ... 其他配置项的验证规则
});
```

## 最佳实践

1. **环境分离**: 为不同环境创建不同的 `.env` 文件
2. **敏感信息**: 不要在代码中硬编码敏感信息，使用环境变量
3. **配置验证**: 充分利用 Joi 的验证功能确保配置正确
4. **内存管理**: 根据服务器资源调整内存相关配置
5. **性能调优**: 根据实际负载调整批处理和并发配置

## 故障排除

### 常见问题

1. **内存不足**: 调整 `MAX_MEMORY_MB` 和 `NODE_OPTIONS`
2. **数据库连接失败**: 检查数据库配置和网络连接
3. **嵌入模型错误**: 验证 API 密钥和模型配置
4. **文件处理问题**: 检查文件权限和磁盘空间

### 调试命令

```bash
# 检查 TypeScript 类型
npm run typecheck

# 检查环境变量
node -e "console.log(process.env)"

# 验证配置
node -e "require('./src/config/ConfigService').getInstance().getAll()"
```

## 版本兼容性

- Node.js: >= 18.0
- TypeScript: ^5.9.2
- 支持的操作系统: Windows, Linux, macOS

## 更新日志

- **v1.0.0**: 初始版本，包含完整的配置系统
- **增强规则**: 添加了 `SEMGREP_ENHANCED_RULES_PATH` 配置
- **内存优化**: 添加了详细的内存管理配置
- **多提供商支持**: 支持多种嵌入模型提供商

---

*最后更新: 2024年*