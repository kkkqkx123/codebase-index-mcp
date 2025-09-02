# CodeQL与Semgrep集成执行方案

是否集成CodeQL待定

## 概述

本方案将详细规划CodeQL与Semgrep工具的集成实施步骤。我们将分阶段实施，确保系统稳定性和功能增强。

## 设计思路

### 架构设计原则
1. **模块化设计**：将CodeQL和Semgrep作为独立服务模块，通过接口与现有系统集成
2. **异步处理**：利用现有的事件队列机制实现异步扫描和分析
3. **结果融合**：将静态分析结果与现有图数据库和向量搜索结合，提供更丰富的代码洞察
4. **配置驱动**：基于现有配置体系，支持灵活的规则配置和扫描策略

### 技术选型考量
- **CodeQL**：适用于深度代码逻辑分析和复杂查询
- **Semgrep**：适用于快速模式匹配和轻量级扫描
- **集成方式**：REST API调用 + 本地CLI工具集成
- **数据存储**：利用现有NebulaGraph和Qdrant存储分析结果

## 工作流设计

### CodeQL分析工作流
```
代码变更 → 触发CodeQL数据库构建 → 执行预定义查询 → 结果解析转换 → 存储到图数据库 → 结果可视化
```

### Semgrep扫描工作流  
```
代码变更 → 触发Semgrep扫描 → 规则匹配分析 → 结果格式化 → 存储到向量数据库 → 实时告警
```

### 与现有系统集成工作流
```
用户请求 → 混合搜索服务 → 查询图数据库 + 向量数据库 → 融合静态分析结果 → 返回增强的代码洞察
```

## 目录结构规划

### 新增服务目录
```
src/services/codeql/
├── CodeQLAnalysisService.ts      # CodeQL核心分析服务
├── CodeQLDatabaseBuilder.ts     # 代码数据库构建器
├── CodeQLResultAdapter.ts       # 结果转换适配器
├── CodeQLRuleManager.ts         # 规则管理服务
└── test/
    └── CodeQLAnalysisService.test.ts

src/services/semgrep/
├── SemgrepScanService.ts        # Semgrep扫描服务
├── SemgrepRuleAdapter.ts        # 规则转换适配器
├── SemgrepResultProcessor.ts    # 结果处理器
└── test/
    └── SemgrepScanService.test.ts

src/services/static-analysis/    # 静态分析协调服务
├── StaticAnalysisCoordinator.ts # 分析任务协调器
├── AnalysisResultFusion.ts      # 多源结果融合
└── test/
    └── StaticAnalysisCoordinator.test.ts
```

### 新增配置类型
在 `src/config/ConfigTypes.ts` 中扩展：
- `StaticAnalysisConfig`：静态分析相关配置
- `CodeQLConfig`：CodeQL特定配置
- `SemgrepConfig`：Semgrep特定配置

### 新增数据模型
在 `src/models/` 中创建：
- `StaticAnalysisTypes.ts`：静态分析相关类型定义
- `CodeQLResultTypes.ts`：CodeQL结果数据类型
- `SemgrepResultTypes.ts`：Semgrep结果数据类型

## 文件说明

### 核心服务文件
1. **CodeQLAnalysisService.ts**：主分析服务，负责调用CodeQL CLI、解析结果、错误处理
2. **SemgrepScanService.ts**：轻量级扫描服务，支持实时扫描和自定义规则
3. **StaticAnalysisCoordinator.ts**：协调多个分析工具，管理分析任务队列

### 适配器文件
1. **CodeQLResultAdapter.ts**：将CodeQL结果转换为图数据库节点和边
2. **SemgrepRuleAdapter.ts**：支持自定义规则到Semgrep格式的转换

### 工具类文件
1. **CodeQLDatabaseBuilder.ts**：自动化CodeQL数据库构建和缓存管理
2. **AnalysisResultFusion.ts**：多源分析结果融合算法

## 文件依赖关系

### 内部依赖
- 依赖现有 `GraphService` 进行图数据操作
- 依赖 `EventQueueService` 实现异步处理
- 依赖现有配置体系进行参数管理
- 依赖 `LoggerService` 进行日志记录
- 依赖 `ErrorHandlerService` 进行错误处理

### 外部依赖
- CodeQL CLI 工具链
- Semgrep CLI 工具
- 相应的语言解析器

## 接口设计

### CodeQL分析服务接口
```typescript
interface ICodeQLAnalysisService {
  analyzeProject(projectPath: string, options?: CodeQLAnalysisOptions): Promise<CodeQLAnalysisResult>;
  buildDatabase(projectPath: string, language: string): Promise<string>;
  runQuery(databasePath: string, queryFile: string): Promise<CodeQLQueryResult>;
  getSupportedLanguages(): string[];
}

interface CodeQLAnalysisOptions {
  queries?: string[];
  timeout?: number;
  memoryLimit?: string;
  includeSarif?: boolean;
}
```

### Semgrep扫描服务接口
```typescript
interface ISemgrepScanService {
  scanProject(projectPath: string, options?: SemgrepScanOptions): Promise<SemgrepScanResult>;
  addCustomRule(rule: SemgrepRule): Promise<void>;
  getAvailableRules(): SemgrepRule[];
  validateRule(rule: SemgrepRule): Promise<ValidationResult>;
}

interface SemgrepScanOptions {
  rules?: string[];
  config?: string;
  severity?: ('ERROR' | 'WARNING' | 'INFO')[];
  timeout?: number;
}
```

## 配置扩展详情

### StaticAnalysisConfig 配置结构
```typescript
interface StaticAnalysisConfig {
  enabled: boolean;
  defaultTool: 'codeql' | 'semgrep' | 'both';
  scanOnChange: boolean;
  batchSize: number;
  resultRetentionDays: number;
  codeql: CodeQLConfig;
  semgrep: SemgrepConfig;
}

interface CodeQLConfig {
  enabled: boolean;
  cliPath: string;
  databaseCacheDir: string;
  defaultQueries: string[];
  timeout: number;
  memoryLimit: string;
  parallelBuilds: number;
}

interface SemgrepConfig {
  enabled: boolean;
  cliPath: string;
  rulesDir: string;
  defaultRules: string[];
  timeout: number;
  maxTargetBytes: number;
}
```

### 环境变量配置示例
```bash
# CodeQL 配置
CODEQL_ENABLED=true
CODEQL_CLI_PATH=/opt/codeql/codeql
CODEQL_DB_CACHE_DIR=./.codeql/databases

# Semgrep 配置  
SEMGREP_ENABLED=true
SEMGREP_CLI_PATH=/usr/local/bin/semgrep
SEMGREP_RULES_DIR=./config/semgrep-rules
```

## 任务分解

### 1. CodeQL基础设施准备
- 创建CodeQL服务目录结构
- 配置CodeQL运行环境
- 设置数据库缓存目录
- 准备基础查询规则集

### 2. CodeQL核心服务开发
- 实现CodeQLAnalysisService核心类
- 开发代码数据库构建器
- 创建结果转换适配器
- 实现结果验证机制

### 3. CodeQL与现有系统集成
- 集成CodeQL服务与GraphService
- 扩展现有数据模型以支持CodeQL元数据
- 实现异步处理机制
- 开发增量更新功能

### 4. CodeQL测试与验证
- 建立性能基准测试
- 准确性验证测试
- 与现有功能对比分析
- 试点项目验证

### 5. Semgrep轻量级集成
- 集成Semgrep扫描服务
- 开发规则转换适配器
- 实现自定义规则创建功能
- 与现有解析流程并行运行

### 6. 监控与配置管理
- 配置CodeQL与Semgrep的运行参数
- 建立性能监控指标
- 设置告警机制
- 完善日志记录功能

### 7. 文档与规范制定
- 编写CodeQL集成技术文档
- 制定Semgrep规则编写规范
- 更新API文档
- 创建运维手册

## 实施路线图

### 第一阶段：基础设施准备 (1-2周)
1. **环境准备**：安装CodeQL和Semgrep CLI工具
2. **目录创建**：建立服务目录结构和配置文件
3. **依赖配置**：配置外部工具路径和环境变量

### 第二阶段：核心服务开发 (2-3周)
1. **CodeQL服务**：实现数据库构建和查询执行功能
2. **Semgrep服务**：实现规则管理和扫描功能
3. **结果适配器**：开发结果转换和存储逻辑

### 第三阶段：系统集成 (1-2周)
1. **事件集成**：与现有事件队列系统集成
2. **数据存储**：将分析结果存入图数据库和向量数据库
3. **API扩展**：扩展现有API支持静态分析查询

### 第四阶段：测试优化 (1周)
1. **性能测试**：建立基准测试和性能监控
2. **稳定性测试**：验证大规模代码库的处理能力
3. **优化调整**：根据测试结果进行性能优化

## 性能考量

### 资源消耗评估
- **CodeQL数据库构建**：需要大量磁盘空间（每个项目1-10GB）
- **内存使用**：CodeQL查询可能需要2-8GB内存
- **CPU使用**：并行处理时需要考虑CPU核心数限制

### 性能优化策略
1. **增量构建**：只对变更文件重新构建数据库
2. **查询缓存**：缓存常用查询结果减少重复计算
3. **资源限制**：配置内存和CPU使用上限防止系统过载
4. **并行处理**：利用多核CPU并行处理多个项目

### 监控指标
- 数据库构建时间
- 查询执行时间
- 内存使用峰值
- 结果数量和质量
- 错误率和重试次数

## 预期成果

通过以上7个子任务的实施，我们将成功集成CodeQL和Semgrep工具，显著提升代码逻辑关系分析的深度和准确性，为系统提供更强大的代码分析能力。

### 具体成果指标
1. **功能覆盖**：支持10+编程语言的静态分析
2. **性能指标**：单个项目分析时间控制在30分钟以内
3. **准确性**：误报率低于5%，漏报率低于2%
4. **集成度**：与现有搜索和图分析功能无缝集成
5. **可扩展性**：支持自定义规则和查询的灵活扩展