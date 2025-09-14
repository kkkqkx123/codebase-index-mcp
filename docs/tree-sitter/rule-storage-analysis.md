# Tree-Sitter 规则数据存储方式分析

## 概述

本文档详细分析了 codebase-index 项目中 tree-sitter 规则的数据存储架构，包括规则定义、持久化机制、数据库存储模式和编译执行流程。

## 1. 核心数据模型

### 1.1 规则定义接口

**文件位置**: `src/models/CustomRuleTypes.ts`

```typescript
export interface CustomRuleDefinition {
  name: string;
  description: string;
  targetType: string;
  pattern: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface CustomRule extends CustomRuleDefinition {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  enabled: boolean;
}

export interface CompiledRule {
  id: string;
  name: string;
  description: string;
  targetType: string;
  conditionEvaluator: (node: any, sourceCode: string) => boolean;
  actionExecutor: (node: any, sourceCode: string) => SnippetChunk | null;
}
```

### 1.2 规则条件和动作

```typescript
export interface RuleCondition {
  type: 'nodeType' | 'contentPattern' | 'complexity' | 'languageFeature';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}

export interface RuleAction {
  type: 'extract' | 'highlight' | 'report';
  parameters: Record<string, any>;
}
```

## 2. 规则存储服务架构

### 2.1 主要服务类

**文件位置**: `src/services/treesitter-dsl/CustomRuleService.ts`

```typescript
export class CustomRuleService {
  private rules: Map<string, CustomRule> = new Map();
  private parser: DSLParser;
  private compiler: DSLCompiler;
  private validator: RuleValidationService;
  private storagePath: string;
}
```

### 2.2 文件系统存储

#### 存储路径
- 默认路径: `./data/custom-rules/`
- 文件格式: `/{ruleId}.json`
- 版本控制: `/{ruleId}_v{version}.json`

#### 存储结构
```typescript
// JSON 文件示例
{
  "id": "complex_function_rule",
  "version": "1.0.0",
  "name": "Complex Function Rule",
  "description": "Extract complex functions with high complexity",
  "targetType": "function_definition",
  "pattern": "",
  "conditions": [
    {
      "type": "complexity",
      "value": "10",
      "operator": "greaterThan"
    }
  ],
  "actions": [
    {
      "type": "extract",
      "parameters": {}
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "author": "Unknown",
  "enabled": true
}
```

## 3. 双数据库架构存储

### 3.1 向量数据库 (Qdrant)

**服务类**: `VectorStorageService`

#### 数据结构
```typescript
{
  id: string;
  vector: number[];                    // 嵌入向量
  payload: {
    content: string;                   // 代码片段内容
    filePath: string;                  // 文件路径
    language: string;                  // 编程语言
    snippetMetadata: {
      snippetType: string;             // 片段类型
      contextInfo: object;             // 上下文信息
      languageFeatures: object;        // 语言特性
      complexity: number;               // 复杂度
      contentHash: string;             // 内容哈希
    };
    projectId: string;                 // 项目ID
  };
}
```

#### 存储特点
- 项目隔离: 每个项目独立的集合
- 向量索引: 支持语义搜索
- 元数据丰富: 包含复杂度、语言特性等
- 路径段索引: 高效的文件路径过滤

### 3.2 图数据库 (Neo4j/NebulaGraph)

**服务类**: `GraphPersistenceService`

#### 数据模型
- **节点**: 代码片段和实体
- **关系**: 依赖关系、引用关系、语义连接
- **属性**: 规则类型、复杂度、语言特性

#### 存储特点
- 关系建模: 代码间的调用和依赖关系
- 图谱查询: 复杂的代码结构分析
- 可视化支持: 代码关系的图形化展示

### 3.3 事务协调

**服务类**: `TransactionCoordinator`

```typescript
export class StorageCoordinator {
  async store(files: ParsedFile[], projectId?: string): Promise<StorageResult> {
    // 双数据库存储，事务一致性保证
    const vectorResult = await vectorStorage.storeChunks(allChunks, options);
    const graphResult = await graphStorage.storeChunks(allChunks, options);

    // 跨数据库事务协调
    await this.transactionCoordinator.commitTransaction();
  }
}
```

## 4. 规则处理工作流

### 4.1 规则生命周期

```
DSL/JSON 定义 → 语法验证 → 解析编译 → 规则执行 → 片段提取 → 数据库存储 → 元数据丰富 → 搜索检索
```

### 4.2 核心处理组件

#### DSL 解析器
**文件位置**: `src/services/treesitter-dsl/DSLParser.ts`

```typescript
export class DSLParser {
  parse(source: string): CustomRuleDefinition {
    // 解析 DSL 语法示例:
    // RULE "ComplexFunctionRule" {
    //   description: "Extract complex functions"
    //   target: "function_definition"
    //   condition: {
    //     nodeType: "function_definition"
    //     complexity: greaterThan(10)
    //   }
    //   action: {
    //     type: "extract"
    //   }
    // }
  }
}
```

#### DSL 编译器
**文件位置**: `src/services/treesitter-dsl/DSLCompiler.ts`

```typescript
export class DSLCompiler {
  compile(ruleDefinition: CustomRuleDefinition): CompiledRule {
    return {
      id: this.generateId(ruleDefinition.name),
      name: ruleDefinition.name,
      description: ruleDefinition.description,
      targetType: ruleDefinition.targetType,
      conditionEvaluator: this.createConditionEvaluator(ruleDefinition.conditions),
      actionExecutor: this.createActionExecutor(ruleDefinition.actions)
    };
  }
}
```

#### 规则验证服务
**文件位置**: `src/services/treesitter-dsl/RuleValidationService.ts`

```typescript
export class RuleValidationService {
  validateRule(rule: CustomRuleDefinition): ValidationResult {
    // 验证规则定义的完整性和正确性
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }
}
```

## 5. 预构建规则库

### 5.1 规则工厂

**文件位置**: `src/services/parser/treesitter-rule/EnhancedRuleFactory.ts`

```typescript
export class EnhancedRuleFactory {
  static createAllRules(): SnippetExtractionRule[] {
    return [
      // 核心语言规则
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),

      // 现代特性规则
      new AsyncPatternRule(),
      new DecoratorPatternRule(),

      // 语言特定规则
      new PythonComprehensionRule(),
      new JavaStreamRule(),

      // 框架规则
      new ReactRule(),
      new DjangoRule(),

      // 构建和工具规则
      new DockerContainerizationRule(),
      new CICDConfigurationRule()
    ];
  }
}
```

### 5.2 规则分类

#### 核心语言规则 (9个)
- ControlStructureRule: 控制结构检测
- ErrorHandlingRule: 错误处理模式
- FunctionCallChainRule: 函数调用链
- CommentMarkedRule: 注释标记代码
- LogicBlockRule: 逻辑块检测
- ExpressionSequenceRule: 表达式序列
- ObjectArrayLiteralRule: 对象数组字面量
- ArithmeticLogicalRule: 算术逻辑操作
- TemplateLiteralRule: 模板字面量
- DestructuringAssignmentRule: 解构赋值

#### 现代特性规则 (4个)
- AsyncPatternRule: 异步模式
- DecoratorPatternRule: 装饰器模式
- GenericPatternRule: 泛型模式
- FunctionalProgrammingRule: 函数式编程

#### 语言特定规则 (6个)
- PythonComprehensionRule: Python 推导式
- JavaStreamRule: Java 流式 API
- JavaLambdaRule: Java Lambda 表达式
- GoGoroutineRule: Go 协程
- GoInterfaceRule: Go 接口
- 各框架特定规则 (12+)

#### 构建工具规则 (4个)
- JavaBuildSystemsRule: Java 构建系统
- NpmYarnPackageManagementRule: Node.js 包管理
- DockerContainerizationRule: Docker 容器化
- CICDConfigurationRule: CI/CD 配置

### 5.3 规则配置

**文件位置**: `config/enhanced-rules/config/enhanced-rules-config.yml`

```yaml
rule-groups:
  control-flow:
    name: "控制流分析规则"
    description: "检测复杂控制流、循环优化、不可达代码等问题"
    rules:
      - enhanced-rules/control-flow/enhanced-cfg-analysis.yml

  modern-features:
    name: "现代语言特性规则"
    description: "检测异步编程、装饰器、泛型等现代语言特性"
    rules:
      - enhanced-rules/modern-features/async-pattern.yml
      - enhanced-rules/modern-features/decorator-pattern.yml
```

## 6. 关键存储模式

### 6.1 文件系统存储
- **位置**: `./data/custom-rules/`
- **格式**: JSON 文件
- **缓存**: 内存 Map 缓存
- **版本控制**: 支持多版本管理

### 6.2 内存缓存
```typescript
private rules: Map<string, CustomRule> = new Map();
```
- 快速访问: O(1) 时间复杂度
- 实时更新: 规则修改立即生效
- 自动同步: 与文件系统自动同步

### 6.3 双数据库持久化
- **向量数据库**: Qdrant，用于语义搜索
- **图数据库**: Neo4j/NebulaGraph，用于关系分析
- **事务协调**: 确保数据一致性
- **项目隔离**: 独立的存储空间

### 6.4 配置驱动
- **YAML 配置**: 规则分组和配置
- **外部化**: 规则逻辑与配置分离
- **可扩展**: 支持新规则类型

## 7. 规则管理功能

### 7.1 版本管理
```typescript
updateRule(ruleId: string, updatedRuleDefinition: CustomRuleDefinition): CustomRule
getRuleVersions(ruleId: string): CustomRule[]
```
- 自动版本递增
- 历史版本保存
- 版本回滚支持

### 7.2 导入导出
```typescript
exportRule(ruleId: string): string
importRule(ruleData: string): CustomRule
```
- JSON 格式导出
- 规则验证导入
- 跨环境共享

### 7.3 启用/禁用
```typescript
toggleRule(ruleId: string): boolean
```
- 运行时控制
- 不删除历史
- 快速切换

## 8. 性能优化策略

### 8.1 存储性能
- **文件缓存**: 内存缓存减少磁盘 IO
- **批量操作**: 支持批量规则处理
- **哈希去重**: 避免重复处理
- **路径段索引**: 提高文件检索效率

### 8.2 搜索性能
- **向量索引**: 语义搜索优化
- **图谱查询**: 关系查询优化
- **多阶段重排**: 语义 → 图谱 → 代码特征
- **动态权重**: 基于查询上下文调整

### 8.3 数据库优化
- **连接池**: 减少连接开销
- **批量操作**: 提高存储效率
- **智能缓存**: 重复查询优化
- **事务管理**: 确保数据一致性

## 9. 数据一致性保证

### 9.1 事务协调
- **跨数据库事务**: 保证向量库和图库一致性
- **回滚机制**: 失败时自动回滚
- **重试策略**: 临时错误自动重试

### 9.2 数据同步
- **实时同步**: 内存与文件系统同步
- **启动加载**: 系统启动时自动加载规则
- **变更通知**: 规则变更通知相关组件

### 9.3 验证机制
- **语法验证**: DSL 语法检查
- **逻辑验证**: 规则逻辑验证
- **执行验证**: 规则执行前验证

## 10. 扩展性设计

### 10.1 插件化架构
- **规则工厂**: 支持动态添加新规则
- **存储抽象**: 支持多种存储后端
- **DSL 扩展**: 支持新的语法特性

### 10.2 多语言支持
- **语言检测**: 自动识别编程语言
- **语言适配**: 针对性规则适配
- **语法树适配**: 不同语言的 AST 处理

### 10.3 配置化
- **外部配置**: 规则行为可配置
- **环境变量**: 运行时配置调整
- **动态加载**: 支持热重载配置

## 总结

该系统采用分层存储架构，结合文件系统、内存缓存和双数据库存储，提供了完整的 tree-sitter 规则管理解决方案。核心特点包括：

1. **多层次存储**: 文件系统持久化 + 内存缓存 + 双数据库存储
2. **规则完整生命周期**: 从定义到执行的全流程管理
3. **丰富的预构建规则**: 40+ 覆盖多种编程语言和框架
4. **高性能**: 缓存、批量操作、索引优化
5. **高可靠性**: 事务协调、数据一致性保证
6. **高扩展性**: 插件化、配置化、多语言支持

这种架构设计确保了系统在功能完整性、性能、可靠性和扩展性方面的平衡，为智能代码分析提供了强大的规则引擎支持。