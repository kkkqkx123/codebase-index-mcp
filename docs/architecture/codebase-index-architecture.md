# 代码库索引系统架构设计

## 概述

本系统是一个为LLM提供MCP形式代码库索引的TypeScript项目，支持高效检索代码库信息。系统采用模块化设计，集成tree-sitter多语言解析器和semgrep语义分析工具。

## 核心模块

### 1. Tree-sitter模块

**功能职责：**
- 多语言语法解析器集成（支持TypeScript、JavaScript、Python等10+语言）
- AST抽象语法树解析和构建
- 代码片段智能提取（9种提取规则）
- 语言检测和节点文本提取

**核心文件：**
- <mcfile name="TreeSitterCoreService.ts" path="src/services/tree-sitter/TreeSitterCoreService.ts"></mcfile> - 多语言解析器初始化和AST处理
- <mcfile name="TreeSitterUtils.ts" path="src/services/tree-sitter/TreeSitterUtils.ts"></mcfile> - 工具方法提供

### 2. Semgrep工具集成

**功能职责：**
- 语义规则扫描和验证
- 安全漏洞和控制流分析
- 扫描结果处理和转换
- 性能监控和IDE集成

**核心文件：**
- <mcfile name="SemgrepResultProcessor.ts" path="src/services/semgrep/SemgrepResultProcessor.ts"></mcfile> - 结果处理和统计计算
- <mcfile name="EnhancedSemgrepScanService.ts" path="src/services/semgrep/EnhancedSemgrepScanService.ts"></mcfile> - 扫描服务管理
- <mcfile name="enhanced-rules-config.yml" path="config/semgrep/enhanced-rules-config.yml"></mcfile> - 规则配置文件

### 3. 代码库索引主模块

**功能职责：**
- 代码索引服务协调和管理
- 向量存储和嵌入服务管理
- 文件扫描和解析流程控制
- 搜索查询处理和结果返回

**核心服务：**
- <mcfile name="IndexService.ts" path="src/services/index/IndexService.ts"></mcfile> - 索引服务接口定义
- <mcfile name="IndexCoordinator.ts" path="src/services/index/IndexCoordinator.ts"></mcfile> - 索引流程协调器
- <mcfile name="CodeIndexService.ts" path="src/services/index/CodeIndexService.ts"></mcfile> - 代码索引核心实现
- <mcfile name="VectorStore.ts" path="src/services/vector/VectorStore.ts"></mcfile> - 向量存储管理
- <mcfile name="EmbeddingService.ts" path="src/services/embedding/EmbeddingService.ts"></mcfile> - 嵌入服务支持

## 协作机制

### 1. 解析流程协作

```
文件扫描 → Tree-sitter AST解析 → Semgrep语义分析 → 智能分块 → 向量嵌入 → 索引存储
```

### 2. 服务集成点

- **Tree-sitter集成：** 通过<mcsymbol name="TreeSitterService" filename="ParserService.ts" path="src/services/parser/ParserService.ts" startline="1" type="class"></mcsymbol>封装TreeSitterCoreService
- **Semgrep集成：** 通过<mcsymbol name="SemanticAnalysisService" filename="SemanticAnalysisService.ts" path="src/services/semantic/SemanticAnalysisService.ts" startline="1" type="class"></mcsymbol>结合AST和规则分析
- **协调管理：** <mcsymbol name="StaticAnalysisCoordinator" filename="StaticAnalysisCoordinator.ts" path="src/services/coordinator/StaticAnalysisCoordinator.ts" startline="1" type="class"></mcsymbol>负责整体协调

### 3. 数据流整合

- Tree-sitter提供AST节点信息
- Semgrep提供规则匹配结果
- 语义分析服务关联两者信息
- 生成增强的语义分析结果

## 整体架构设计

### 架构特点

1. **模块化设计** - 各功能模块独立，通过依赖注入解耦
2. **并发处理** - 支持并行文件处理和索引构建
3. **实时更新** - 支持增量索引和实时搜索
4. **哈希去重** - 基于内容哈希避免重复索引
5. **多语言支持** - 集成tree-sitter多语言解析能力
6. **语义增强** - 结合semgrep规则提供深度分析

### 核心工作流程

#### 阶段一：初始化
1. 配置加载和环境检查
2. 依赖注入容器初始化
3. 服务实例创建和注册
4. 解析器初始化（tree-sitter语言包加载）

#### 阶段二：索引构建
1. 目录递归扫描和文件过滤
2. 多语言代码解析（tree-sitter AST构建）
3. 语义规则扫描（semgrep分析）
4. 智能分块和内容提取
5. 文本向量化（嵌入服务）
6. 向量索引存储（Qdrant集成）

#### 阶段三：搜索查询
1. 查询文本预处理
2. 向量相似性搜索
3. 结果排序和过滤
4. 增强信息返回（包含语义分析结果）

### 性能优化机制

1. **AST缓存** - tree-sitter解析结果缓存
2. **批处理** - 文件处理批量执行
3. **对象池** - 资源复用减少创建开销
4. **内存管理** - 大文件分块处理
5. **异步管道** - 非阻塞IO操作

## 文件结构

```
src/
├── main.ts                    # 应用入口，依赖注入初始化
├── services/
│   ├── index/                # 索引核心服务
│   ├── tree-sitter/          # Tree-sitter集成
│   ├── semgrep/              # Semgrep集成
│   ├── semantic/             # 语义分析服务
│   ├── embedding/            # 嵌入服务
│   ├── vector/               # 向量存储
│   └── coordinator/          # 流程协调器
├── config/                   # 配置文件
│   └── semgrep/             # Semgrep规则配置
└── docs/architecture/       # 架构文档
```

## 技术栈

- **语言:** TypeScript
- **解析器:** Tree-sitter（多语言AST解析）
- **分析工具:** Semgrep（语义规则扫描）
- **向量存储:** Qdrant（向量数据库）
- **嵌入模型:** OpenAI/Ollama/Gemini（多提供商支持）
- **架构模式:** 依赖注入、模块化设计

## 扩展能力

1. **多语言扩展** - 通过tree-sitter支持新语言
2. **规则扩展** - 自定义semgrep规则
3. **嵌入模型扩展** - 支持新的嵌入提供商
4. **存储扩展** - 支持其他向量数据库

---

*文档版本: 1.0*
*最后更新: 2024年*