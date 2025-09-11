# TreeSitterService 重构执行计划

## 当前问题分析
TreeSitterService.ts 文件规模过大（1261行），包含过多功能：
- 解析器初始化和管理
- 多种代码片段提取规则
- 复杂的私有工具方法
- AST 节点处理逻辑

## 重构目标
1. 分离规则到独立目录
2. 提取非核心逻辑到单独文件
3. 创建工具类封装私有方法
4. 提高代码可维护性和可测试性

## 执行步骤

### 第一阶段：目录结构调整
1. **创建规则目录**
   ```
   src/services/parser/treesitter-rule/
   ├── ControlStructureRule.ts
   ├── ErrorHandlingRule.ts
   ├── FunctionCallChainRule.ts
   ├── CommentMarkedRule.ts
   ├── LogicBlockRule.ts
   ├── ExpressionSequenceRule.ts
   ├── ObjectArrayLiteralRule.ts
   ├── ArithmeticLogicalRule.ts
   ├── TemplateLiteralRule.ts
   └── DestructuringAssignmentRule.ts
   ```

2. **定义规则接口**
   ```typescript
   export interface SnippetExtractionRule {
     name: string;
     extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[];
     supportedNodeTypes: Set<string>;
   }
   ```

### 第二阶段：核心逻辑分离
1. **创建 TreeSitterCoreService**
   - 包含解析器初始化、语言检测、基础解析功能
   - 保留核心公共方法：parseCode, parseFile, getSupportedLanguages, detectLanguage

2. **创建 SnippetExtractionService**
   - 负责协调各种规则进行代码片段提取
   - 实现 extractSnippets 方法，调用各个规则

### 第三阶段：工具类提取
1. **创建 TreeSitterUtils 工具类**
   ```typescript
   export class TreeSitterUtils {
     static getNodeText(node: Parser.SyntaxNode, sourceCode: string): string;
     static getNodeLocation(node: Parser.SyntaxNode): LocationInfo;
     static findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[];
     static generateSnippetId(content: string, startLine: number): string;
     static simpleHash(str: string): string;
   }
   ```

2. **创建 SnippetValidationUtils 工具类**
   ```typescript
   export class SnippetValidationUtils {
     static isValidSnippet(content: string, snippetType: string): boolean;
     static analyzeLanguageFeatures(content: string): LanguageFeatures;
     static calculateComplexity(content: string): number;
     static isStandaloneSnippet(content: string, snippetType: string): boolean;
     static hasSideEffects(content: string): boolean;
   }
   ```

### 第四阶段：依赖注入配置
1. **更新 inversify.config.ts**
   ```typescript
   container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService);
   container.bind<SnippetExtractionService>(TYPES.SnippetExtractionService).to(SnippetExtractionService);
   container.bind<SnippetExtractionRule[]>(TYPES.SnippetExtractionRules).toConstantValue([
     new ControlStructureRule(),
     new ErrorHandlingRule(),
     // ... 其他规则
   ]);
   ```

## 文件迁移计划

### 需要创建的新文件：
1. `src/services/parser/TreeSitterCoreService.ts` - 核心解析功能
2. `src/services/parser/SnippetExtractionService.ts` - 片段提取协调
3. `src/services/parser/TreeSitterUtils.ts` - 工具方法
4. `src/services/parser/SnippetValidationUtils.ts` - 验证工具
5. `src/services/parser/treesitter-rule/` 目录下的各个规则文件

### 需要修改的文件：
1. `src/services/parser/TreeSitterService.ts` - 改为 facade 模式，依赖注入其他服务
2. `src/inversify.config.ts` - 更新依赖绑定
3. 相关测试文件 - 更新导入路径和测试策略

## 测试策略
1. 保持现有测试用例不变
2. 为每个新创建的规则和服务添加单元测试
3. 确保重构后功能完整性

