# 代码库索引和结构分析功能架构设计

## 概述

为Kode项目提供独立的MCP服务，包含代码库索引和结构分析功能。使用Qdrant向量数据库实现智能代码搜索，使用Neo4j图数据库存储代码调用关系图，通过MCP协议与Kode CLI进行通信。

## 架构设计

### 1. MCP服务架构

#### 1.1 独立MCP服务设计
- **部署方式**: 独立的Node.js进程，通过MCP协议与Kode CLI通信
- **项目结构**: 与Kode主项目分离，单独的文件目录结构
- **通信协议**: 使用MCP标准协议进行进程间通信

#### 1.2 核心服务组件

##### 1.2.1 CodeIndexService (代码索引服务)
- 负责文档处理、分块和向量索引创建
- 支持增量索引和全量索引
- 处理代码文件解析和元数据提取

##### 1.2.2 VectorStore (向量存储管理)  
- Qdrant客户端封装
- 集合管理和向量操作
- 连接池和性能优化

##### 1.2.3 EmbeddingService (嵌入服务)
- OpenAI API集成
- 文本向量化处理
- 缓存和批处理优化

##### 1.2.4 SearchService (搜索服务)
- 语义搜索和关键词搜索
- 结果重排和过滤
- 相关性评分

##### 1.2.5 GraphAnalysisService (图分析服务)
- 静态代码分析提取调用关系
- Neo4j图数据库集成
- 代码结构可视化和查询

### 2. 技术栈选择

#### 向量数据库
- **Qdrant**: 生产级向量搜索引擎，支持REST和gRPC API
- **地址**: http://127.0.0.1:6333 (Docker部署)
- **客户端**: 使用官方JavaScript客户端

#### 图数据库
- **Neo4j**: 生产级图数据库，支持Cypher查询语言
- **地址**: bolt://127.0.0.1:7687 (Docker部署)
- **客户端**: 使用官方JavaScript驱动

#### 嵌入模型
- **OpenAI兼容 API**
- **模型**: text-embedding-ada-002 (1536维)

#### 重排模型
- **OpenAI兼容 API** 
- **模型**: 待定

#### MCP框架
- **MCP协议**: Model Context Protocol标准
- **通信方式**: stdio或socket通信
- **客户端**: Kode CLI内置MCP客户端支持

### 3. 依赖分析

#### MCP服务依赖
```bash
# 核心依赖
qdrant-client@^1.10.0
neo4j-driver@^5.0.0
ts-morph@^20.0.0
@modelcontextprotocol/server@^1.0.0

# 代码解析工具
@babel/parser@^7.24.0
typescript@^5.0.0

# 文本处理
natural@^6.0.0

# 规则引擎支持（预留）
javascript-rule-engine@^1.0.0
```

#### 版本兼容性  
- Node.js版本: >=18.0.0 ✓
- TypeScript版本: 5.9.2 ✓
- MCP协议版本: 1.0+ ✓

### 4. 模块设计

#### 4.1 MCP服务项目结构
```
codebase-index-mcp/
  ├── src/
  │   ├── server.ts              # MCP服务器入口
  │   ├── services/
  │   │   ├── index/
  │   │   │   ├── CodeIndexService.ts    # 代码索引服务
  │   │   │   ├── VectorStore.ts        # Qdrant客户端封装
  │   │   │   ├── EmbeddingService.ts    # OpenAI嵌入服务
  │   │   │   └── SearchService.ts       # 搜索服务
  │   │   ├── graph/
  │   │   │   ├── GraphAnalysisService.ts # 图分析服务
  │   │   │   ├── Neo4jConnector.ts      # Neo4j连接管理
  │   │   │   ├── CodeParser.ts          # 代码解析器
  │   │   │   └── GraphBuilder.ts        # 图构建器
  │   │   └── rules/
  │   │       ├── RuleEngine.ts          # 规则引擎
  │   │       ├── languageRules/         # 语言特定规则
  │   │       └── frameworkRules/         # 框架特定规则
  │   ├── types/
  │   │   ├── index.ts           # 索引相关类型
  │   │   ├── graph.ts           # 图分析相关类型
  │   │   └── mcp.ts             # MCP协议类型
  │   ├── utils/
  │   │   ├── codeParser.ts      # 代码文件解析
  │   │   ├── textChunker.ts     # 文本分块处理
  │   │   └── metadataExtractor.ts # 元数据提取
  │   └── config/
  │       ├── env.ts             # 环境配置
  │       └── mcp.ts             # MCP服务器配置
  ├── package.json
  ├── tsconfig.json
  └── docker-compose.yml         # 数据库服务配置
```

#### 4.2 MCP工具接口设计
```typescript
// MCP工具定义
interface MCPTools {
  'codebase/index/create': {
    input: { projectPath: string; options?: IndexOptions }
    output: { success: boolean; message: string }
  }
  'codebase/index/search': {
    input: { query: string; options?: SearchOptions }
    output: { results: SearchResult[]; total: number }
  }
  'codebase/graph/analyze': {
    input: { projectPath: string; options?: GraphOptions }
    output: { success: boolean; nodes: number; relationships: number }
  }
  'codebase/graph/query': {
    input: { query: string; options?: GraphQueryOptions }
    output: { paths: GraphPath[]; nodes: GraphNode[] }
  }
  'codebase/rules/import': {
    input: { ruleType: 'language' | 'framework'; rulePath: string }
    output: { success: boolean; importedRules: number }
  }
}

// 核心服务接口
interface CodeIndexService {
  createIndex(projectPath: string, options?: IndexOptions): Promise<void>
  updateIndex(filePath: string): Promise<void>
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
}

interface GraphAnalysisService {
  analyzeCodebase(projectPath: string): Promise<GraphAnalysisResult>
  queryGraph(query: string): Promise<GraphQueryResult>
  importRules(ruleType: string, rulePath: string): Promise<RuleImportResult>
}

### 5. 数据模型

#### 向量点结构
```typescript
interface VectorPoint {
  id: string | number
  vector: number[]
  payload: {
    content: string
    filePath: string
    language: string
    functionName?: string
    className?: string
    lineNumber?: number
    metadata: Record<string, any>
  }
}
```

#### 图节点结构
```typescript
interface GraphNode {
  id: string
  labels: string[]
  properties: {
    name: string
    type: 'Function' | 'Class' | 'Variable' | 'File' | 'Module'
    filePath: string
    language: string
    startLine?: number
    endLine?: number
    visibility?: 'public' | 'private' | 'protected'
  }
}
```

#### 图关系结构
```typescript
interface GraphRelationship {
  id: string
  type: 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'REFERENCES' | 'CONTAINS'
  startNodeId: string
  endNodeId: string
  properties: {
    weight?: number
    context?: string
  }
}
```

#### 规则定义结构
```typescript
interface AnalysisRule {
  id: string
  name: string
  type: 'language' | 'framework'
  target: string  // 如 'typescript', 'react', 'vue'
  patterns: RulePattern[]
  priority: number
  version: string
}

interface RulePattern {
  type: 'ast' | 'regex' | 'structural'
  pattern: any
  action: 'createNode' | 'createRelationship' | 'extractMetadata'
}
```

#### 搜索选项
```typescript
interface SearchOptions {
  limit?: number
  scoreThreshold?: number
  fileFilter?: string[]
  languageFilter?: string[]
  useReranking?: boolean
}
```

### 6. 工作流程

#### 6.1 MCP服务启动流程
1. 加载环境配置和MCP服务器配置
2. 初始化数据库连接（Qdrant + Neo4j）. 加载规则引擎和预定义规则
4. 注册MCP工具和处理程序
5. 启动stdio或socket监听

#### 6.2 代码索引创建流程
1. 接收MCP索引创建请求
2. 遍历项目文件系统
3. 解析代码文件，提取文本和元数据
4. 应用规则引擎进行结构化分析
5. 文本分块处理（函数级、类级、文件级）
6. 调用OpenAI API生成向量
7. 存储向量到Qdrant集合
8. 返回索引完成状态

#### 6.3 图分析流程
1. 接收MCP图分析请求
2. 遍历项目文件系统
3. 使用AST解析器提取代码结构
4. 应用语言特定规则识别实体和关系
5. 构建图数据结构
极6. 批量导入Neo4j数据库
7. 创建图索引优化查询性能
8. 返回分析结果统计

#### 6.4 搜索流程
1. 接收MCP搜索请求
2. 生成查询向量
3. Qdrant向量相似性搜索
4. 可选：使用图关系进行结果增强
5. OpenAI结果重排（可选）
6. 返回排序后的搜索结果

#### 极6.5 规则导入流程
1. 接收MCP规则导入请求
2. 验证规则格式和兼容性
3. 加载规则到规则引擎
4. 更新规则索引和缓存
5. 返回导入结果统计

### 7. 性能优化

#### 批处理优化
- 嵌入请求批处理（OpenAI限制: 2048 tokens/request）
- 向量存储批量操作
- 图数据批量导入（Neo4j UNWIND操作）
- 异步并行处理

#### 缓存策略
- 嵌入结果缓存
- 搜索结果缓存
- 元数据缓存
- 规则编译缓存
- AST解析缓存

#### 增量处理
- 极文件修改时间跟踪
- Git变更检测
- 智能增量索引更新
- 图结构增量分析

#### 资源管理
- 连接池管理（Qdrant + Neo4j）
- 内存使用监控和限制
- 并发请求限制
- 超时和重试机制

### 8. 错误处理和监控

#### 错误处理
- MCP协议错误处理（无效请求、权限错误）
- OpenAI API错误重试和回退机制
- Qdrant连接异常处理和重连
- Neo4j连接池异常管理
- 文件解析错误恢复和日志记录
- 规则引擎编译错误处理
- 内存溢出和资源耗尽保护

#### 监控指标
- MCP请求处理耗时和吞吐量
- 索引创建耗时和文件处理速率
- 图分析耗时和节点关系统计
- 搜索响应时间和结果质量
- API调用成功率和错误分类
- 缓存命中率和内存使用情况
- 数据库连接池使用情况
- 规则引擎执行统计

### 9. 安全考虑

#### 数据安全
- MCP通信加密（TLS支持）
- 本地索引数据加密存储
- API密钥安全管理和轮换
- 敏感数据脱敏处理
- 访问权限控制和认证

#### 资源限制
- 内存使用监控和硬限制
- 磁盘空间管理和预警
- API调用频率限制和配额
- 并发请求限制
- 文件系统访问沙箱

#### 安全审计
- 操作日志记录和审计
- 异常行为检测
- 安全漏洞定期扫描
- 依赖包安全更新管理

## 实施计划

### 阶段一: MCP服务基础架构 (2-3周)
1. ✅ 分析现有项目结构和依赖
2. 🔄 设计MCP服务架构和协议接口
3. ⬜ 创建独立MCP服务项目结构
4. ⬜ 实现MCP服务器框架和工具注册
5. ⬜ 集成Qdrant和Neo4j客户端
6. ⬜ 实现基础规则引擎框架

### 阶段二: 索引功能实现 (2-3周)
1. ⬜ 文件解析和文本处理
2. ⬜ 索引创建和管理
3. ⬜ 增量索引支持
4. ⬜ 性能优化

### 阶段三: 搜索功能实现 (1-2周)
1. ⬜ 基础语义搜索
2. ⬜ 结果重排集成
3. ⬜ 过滤和排序功能
4. ⬜ 用户界面集成

### 阶段四: 测试和优化 (1周)
1. ⬜ 单元测试和集成测试
2. ⬜ 性能测试和调优
3. ⬜ 错误处理和监控
4. ⬜ 文档编写

## 风险评估

### 技术风险
1. **OpenAI API限制**: 处理速率限制和配额管理
2. **Qdrant性能**: 大规模索引时的性能优化
3. **内存使用**: 大文件处理时的内存管理

### 依赖风险
1. **版本冲突**: 确保新依赖与现有项目兼容
2. **API变更**: OpenAI和Qdrant API版本升级

### 缓解措施
1. 实现完善的错误处理和重试机制
2. 添加性能监控和资源限制
3. 定期依赖版本检查和更新

## 后续扩展

### 功能扩展
1. **多语言支持**: 更多编程语言解析
2. **高级搜索**: 语法感知搜索、代码模式匹配
3. **协作功能**: 共享索引、团队搜索

### 性能扩展
1. **分布式索引**: 支持大型代码库
2. **实时索引**: 文件变更实时更新
3. **混合搜索**: 结合传统文本搜索

### 集成扩展
1. **IDE插件**: 编辑器集成
2. **CI/CD集成**: 自动化索引更新
3. **API服务**: 提供外部访问接口

---

*最后更新: 2024-12-20*
*设计者: AI助手*
*版本: v1.0.0*