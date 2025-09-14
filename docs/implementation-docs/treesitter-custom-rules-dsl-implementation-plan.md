# Tree-sitter 自定义规则 DSL 和编辑器实现方案

## 概述

本方案将详细规划 Tree-sitter 自定义规则 DSL 和可视化编辑器的实现步骤，为系统提供用户自定义规则的能力。

## 设计思路

### 架构设计原则
1. **模块化设计**：将自定义规则 DSL 作为独立模块，通过接口与现有规则系统集成
2. **向后兼容**：确保新实现与现有规则系统完全兼容
3. **可扩展性**：设计灵活的 DSL 语法，支持未来功能扩展
4. **用户体验**：提供直观的可视化编辑器，降低用户使用门槛

### 技术选型考量
- **DSL 解析器**：使用 ANTLR 或类似的解析器生成工具
- **前端框架**：React + Monaco Editor 用于可视化编辑器
- **数据存储**：利用现有配置体系和数据库存储自定义规则
- **验证框架**：基于现有 SnippetValidationService 扩展

## 工作流设计

### 自定义规则创建工作流
```
用户定义规则 → 可视化编辑器 → DSL 解析 → 规则验证 → 存储到数据库 → 可供使用
```

### 自定义规则使用工作流
```
用户请求 → 规则加载 → 规则编译 → 与现有规则合并 → Tree-sitter 分析 → 返回结果
```

## 目录结构规划

### 新增服务目录
```
src/services/treesitter-dsl/
├── DSLLexer.ts              # DSL 词法分析器
├── DSLParser.ts             # DSL 语法分析器
├── DSLCompiler.ts           # DSL 编译器
├── CustomRuleService.ts     # 自定义规则服务
├── RuleValidationService.ts # 规则验证服务
└── test/
    └── DSLParser.test.ts

src/services/treesitter-editor/
├── RuleEditorComponent.tsx  # 规则编辑器组件
├── RulePreviewComponent.tsx # 规则预览组件
├── RuleTestingComponent.tsx # 规则测试组件
└── test/
    └── RuleEditorComponent.test.tsx

src/models/
├── CustomRuleTypes.ts       # 自定义规则相关类型定义
```

### 新增配置类型
在 `src/config/ConfigTypes.ts` 中扩展：
- `CustomRuleConfig`：自定义规则相关配置
- `RuleEditorConfig`：规则编辑器配置

## 文件说明

### 核心服务文件
1. **DSLLexer.ts**：DSL 词法分析器，负责将 DSL 文本分解为词法单元
2. **DSLParser.ts**：DSL 语法分析器，负责解析 DSL 语法结构
3. **DSLCompiler.ts**：DSL 编译器，将 DSL 规则编译为可执行的 Tree-sitter 规则
4. **CustomRuleService.ts**：自定义规则服务，管理规则的创建、存储和加载

### 编辑器文件
1. **RuleEditorComponent.tsx**：规则编辑器主界面组件
2. **RulePreviewComponent.tsx**：规则预览组件，实时显示 DSL 解析结果
3. **RuleTestingComponent.tsx**：规则测试组件，允许用户测试自定义规则

### 工具类文件
1. **RuleValidationService.ts**：规则验证服务，确保自定义规则的有效性

## 文件依赖关系

### 内部依赖
- 依赖现有 `EnhancedRuleFactory` 进行规则集成
- 依赖 `SnippetValidationService` 进行规则验证
- 依赖现有配置体系进行参数管理
- 依赖 `LoggerService` 进行日志记录
- 依赖 `ErrorHandlerService` 进行错误处理

### 外部依赖
- ANTLR 或其他解析器生成工具
- Monaco Editor 用于可视化编辑器
- React 用于前端组件开发

## 接口设计

### DSL 解析器接口
```typescript
interface IDSLParser {
  parse(dslText: string): CustomRuleDefinition;
  validate(dslText: string): ValidationResult;
}

interface CustomRuleDefinition {
  name: string;
  description: string;
  targetType: string;
  pattern: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

interface RuleCondition {
  type: 'nodeType' | 'contentPattern' | 'complexity' | 'languageFeature';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}

interface RuleAction {
  type: 'extract' | 'highlight' | 'report';
  parameters: Record<string, any>;
}
```

### 自定义规则服务接口
```typescript
interface ICustomRuleService {
  createRule(ruleDefinition: CustomRuleDefinition): Promise<CustomRule>;
  saveRule(rule: CustomRule): Promise<void>;
  loadRule(ruleId: string): Promise<CustomRule>;
  deleteRule(ruleId: string): Promise<void>;
  listRules(): Promise<CustomRule[]>;
  validateRule(rule: CustomRule): Promise<ValidationResult>;
}
```

## DSL 语法设计

### 基本语法结构
```dsl
rule "规则名称" {
  description: "规则描述"
  target: "function_declaration"
  
  condition {
    contentPattern: ".*async.*"
    complexity: greaterThan(5)
  }
  
  action {
    type: extract
    parameters: {
      includeComments: true
      includeMetadata: true
    }
  }
}
```

### 条件表达式
- `nodeType`: 匹配特定的 AST 节点类型
- `contentPattern`: 使用正则表达式匹配节点内容
- `complexity`: 匹配代码复杂度
- `languageFeature`: 匹配特定语言特性（如 async、generator 等）

### 动作定义
- `extract`: 提取代码片段
- `highlight`: 高亮显示匹配的代码
- `report`: 生成报告

## 配置扩展详情

### CustomRuleConfig 配置结构
```typescript
interface CustomRuleConfig {
  enabled: boolean;
  storagePath: string;
  maxRules: number;
  validation: {
    enabled: boolean;
    strictMode: boolean;
  };
}

interface RuleEditorConfig {
  enabled: boolean;
  theme: 'light' | 'dark';
  autosave: boolean;
  preview: {
    enabled: boolean;
    delay: number;
  };
}
```

### 环境变量配置示例
```bash
# 自定义规则配置
CUSTOM_RULES_ENABLED=true
CUSTOM_RULES_STORAGE_PATH=./data/custom-rules
CUSTOM_RULES_MAX_COUNT=100

# 规则编辑器配置
RULE_EDITOR_ENABLED=true
RULE_EDITOR_THEME=dark
RULE_EDITOR_AUTOSAVE=true
```

## 任务分解

### 任务1. DSL 基础设施准备
- 创建 DSL 服务目录结构
- 配置解析器生成工具
- 准备基础 DSL 语法定义

### 任务2. DSL 核心服务开发
- 实现 DSLLexer 词法分析器
- 实现 DSLParser 语法分析器
- 实现 DSLCompiler 编译器
- 创建规则验证服务

### 任务3. 可视化编辑器开发
- 实现规则编辑器主界面组件
- 开发规则预览组件
- 创建规则测试组件
- 集成 Monaco Editor

### 任务4. 自定义规则服务开发
- 实现 CustomRuleService 核心类
- 开发规则存储和加载机制
- 实现规则版本管理功能
- 创建规则共享机制

### 任务5. 系统集成
- 集成自定义规则服务与 EnhancedRuleFactory
- 扩展现有数据模型以支持自定义规则
- 实现规则加载和编译机制
- 开发增量更新功能

### 任务6. 测试与验证
- 建立 DSL 解析和编译测试
- 准确性验证测试
- 与现有功能对比分析
- 试点项目验证

### 任务7. 监控与配置管理
- 配置自定义规则的运行参数
- 建立性能监控指标
- 设置告警机制
- 完善日志记录功能

### 任务8. 文档与规范制定
- 编写自定义规则 DSL 技术文档
- 制定 DSL 语法编写规范
- 更新 API 文档
- 创建用户使用手册

## 实施路线图

### 第一阶段：基础设施准备 (1周)
1. **环境准备**：安装解析器生成工具
2. **目录创建**：建立服务目录结构和配置文件
3. **依赖配置**：配置外部工具路径和环境变量

### 第二阶段：核心服务开发 (2-3周)
1. **DSL 解析器**：实现词法和语法分析器
2. **DSL 编译器**：开发规则编译和验证逻辑
3. **规则服务**：实现自定义规则管理功能

### 第三阶段：可视化编辑器开发 (2周)
1. **编辑器界面**：实现规则编辑和预览功能
2. **测试组件**：开发规则测试和验证功能
3. **用户体验优化**：完善编辑器交互和视觉效果

### 第四阶段：系统集成 (1周)
1. **服务集成**：与现有规则系统集成
2. **数据存储**：实现规则存储和加载机制
3. **API 扩展**：扩展现有 API 支持自定义规则

### 第五阶段：测试优化 (1周)
1. **功能测试**：建立完整的测试套件
2. **性能测试**：验证大规模规则集的处理能力
3. **优化调整**：根据测试结果进行性能优化

## 性能考量

### 资源消耗评估
- **内存使用**：DSL 解析和编译通常需要较少内存
- **CPU 使用**：规则编译过程可能需要一定 CPU 资源
- **磁盘使用**：规则存储占用较小空间

### 性能优化策略
1. **规则缓存**：缓存常用规则减少重复编译
2. **并行处理**：利用多核 CPU 并行处理多个规则
3. **增量编译**：只对变更的规则进行重新编译
4. **懒加载**：按需加载规则，减少启动时间

### 监控指标
- 规则编译时间
- 内存使用峰值
- 规则匹配效率
- 错误率和重试次数

## 预期成果

通过以上8个子任务的实施，我们将成功实现 Tree-sitter 自定义规则 DSL 和可视化编辑器，为系统提供用户自定义规则的能力。

### 具体成果指标
1. **功能覆盖**：支持完整的自定义规则定义和管理
2. **性能指标**：单个规则编译时间控制在100ms以内
3. **准确性**：规则解析和编译准确率100%
4. **集成度**：与现有规则系统无缝集成
5. **可扩展性**：支持自定义规则的灵活扩展