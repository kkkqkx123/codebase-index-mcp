# Tree-sitter 可视化规则编辑器使用指南

## 概述

Tree-sitter 可视化规则编辑器是一个基于 React 的 Web 界面，用于创建、编辑和测试自定义的 Tree-sitter 解析规则。该编辑器提供了直观的用户界面，让用户无需编写复杂的 DSL 代码即可创建自定义的代码分析规则。

## 当前状态

### 已完成的组件

1. **RuleEditorComponent** - 规则编辑器
2. **RulePreviewComponent** - 规则预览器
3. **RuleTestingComponent** - 规则测试器
4. **DSL 编译器** - 支持规则编译到可执行格式
5. **DSL 解析器** - 支持文本 DSL 解析为规则对象
6. **规则验证服务** - 提供语法和逻辑验证

### 缺失的组件

1. **主应用程序入口** - 需要创建一个主 App 组件来整合所有编辑器组件
2. **样式表** - 需要添加 CSS 样式以提供良好的用户体验
3. **集成层** - 需要将编辑器与现有的 MCP 服务集成
4. **HTTP 端点** - 需要创建 API 端点来服务编辑器界面

## 核心组件架构

### 1. 规则编辑器 (RuleEditorComponent)

**位置**: `src/services/treesitter-editor/RuleEditorComponent.tsx`

**功能**:
- 提供表单界面用于创建和编辑规则
- 支持规则名称、描述、目标类型和 DSL 文本输入
- 实时语法验证和错误提示
- 规则保存和取消操作

**主要接口**:
```typescript
interface RuleEditorProps {
  onSave: (rule: CustomRuleDefinition) => void;
  onCancel: () => void;
}
```

**使用示例**:
```tsx
<RuleEditorComponent
  onSave={(rule) => handleSaveRule(rule)}
  onCancel={() => setEditing(false)}
/>
```

### 2. 规则预览器 (RulePreviewComponent)

**位置**: `src/services/treesitter-editor/RulePreviewComponent.tsx`

**功能**:
- 显示规则的详细信息
- 展示规则的条件和动作
- 生成 DSL 格式的规则表示

**主要接口**:
```typescript
interface RulePreviewProps {
  rule: CustomRuleDefinition;
}
```

**使用示例**:
```tsx
<RulePreviewComponent rule={currentRule} />
```

### 3. 规则测试器 (RuleTestingComponent)

**位置**: `src/services/treesitter-editor/RuleTestingComponent.tsx`

**功能**:
- 提供测试代码输入界面
- 执行规则测试并显示结果
- 显示匹配的代码片段和行号

**主要接口**:
```typescript
interface RuleTestingProps {
  rule: CustomRuleDefinition;
}
```

**使用示例**:
```tsx
<RuleTestingComponent rule={currentRule} />
```

## 数据模型

### CustomRuleDefinition

```typescript
export interface CustomRuleDefinition {
  name: string;
  description: string;
  targetType: string;
  pattern: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}
```

### RuleCondition

```typescript
export interface RuleCondition {
  type: 'nodeType' | 'contentPattern' | 'complexity' | 'languageFeature';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}
```

### RuleAction

```typescript
export interface RuleAction {
  type: 'extract' | 'highlight' | 'report';
  parameters: Record<string, any>;
}
```

## DSL 语法示例

### 基本规则格式

```
rule "function_finder" {
  description: "查找所有函数定义"
  target: "function_declaration"

  condition {
    nodeType: "function_declaration"
    complexity: greaterThan(3)
  }

  action {
    type: "extract"
    parameters: {
      includeComments: true
      includeImports: false
    }
  }
}
```

### 支持的条件类型

1. **nodeType** - 匹配 AST 节点类型
2. **contentPattern** - 匹配内容模式
3. **complexity** - 匹配代码复杂度
4. **languageFeature** - 匹配语言特性

### 支持的动作类型

1. **extract** - 提取代码片段
2. **highlight** - 高亮显示
3. **report** - 生成报告

## 使用方法

### 1. 创建新的主应用程序

需要创建一个主 App 组件来整合所有编辑器功能：

```tsx
// src/services/treesitter-editor/TreeSitterEditorApp.tsx
import * as React from 'react';
import RuleEditorComponent from './RuleEditorComponent';
import RulePreviewComponent from './RulePreviewComponent';
import RuleTestingComponent from './RuleTestingComponent';
import { CustomRuleDefinition } from '../../models/CustomRuleTypes';

const TreeSitterEditorApp: React.FC = () => {
  const [currentRule, setCurrentRule] = React.useState<CustomRuleDefinition | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  const handleSaveRule = (rule: CustomRuleDefinition) => {
    setCurrentRule(rule);
    setIsEditing(false);
  };

  return (
    <div className="treesitter-editor-app">
      <header>
        <h1>Tree-sitter 规则编辑器</h1>
      </header>

      <main>
        {isEditing ? (
          <RuleEditorComponent
            onSave={handleSaveRule}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div>
            <button onClick={() => setIsEditing(true)}>
              创建新规则
            </button>

            {currentRule && (
              <div className="rule-viewer">
                <RulePreviewComponent rule={currentRule} />
                <RuleTestingComponent rule={currentRule} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default TreeSitterEditorApp;
```

### 2. 添加样式支持

创建样式文件：

```css
/* src/services/treesitter-editor/styles.css */
.treesitter-editor-app {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.rule-editor {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.dsl-editor {
  font-family: 'Courier New', monospace;
  background: #2d2d2d;
  color: #f8f8f2;
  border: none;
}

.errors {
  color: #dc3545;
  margin-top: 10px;
}

.warnings {
  color: #ffc107;
  margin-top: 10px;
}

.editor-actions button {
  margin-right: 10px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
  background: #28a745;
  color: white;
}

.validate-btn {
  background: #17a2b8;
  color: white;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.test-btn {
  background: #007bff;
  color: white;
  padding: 10px 20px;
  margin-top: 10px;
}

.results-list {
  list-style: none;
  padding: 0;
}

.result-item {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 4px;
}

.result-item.passed {
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.result-item.failed {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

.status {
  font-weight: bold;
  margin-right: 10px;
}

.status.success {
  color: #155724;
}

.status.error {
  color: #721c24;
}

.matched-code {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  margin-top: 5px;
}

.matched-code pre {
  margin: 0;
  white-space: pre-wrap;
}

.line-number {
  color: #6c757d;
  font-size: 0.9em;
}
```

### 3. 集成到现有系统

创建 HTTP 端点来服务编辑器：

```typescript
// src/api/TreeSitterEditorRoutes.ts
import express from 'express';
import * as path from 'path';
import { ConfigService } from '../config/ConfigService';

const router = express.Router();

export function setupTreeSitterEditorRoutes(app: express.Application, config: ConfigService) {
  // 服务编辑器 HTML 页面
  app.get('/treesitter-editor', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/treesitter-editor.html'));
  });

  // 服务静态资源
  app.use('/treesitter-editor/static', express.static(path.join(__dirname, '../../public')));

  // API 端点
  app.post('/api/treesitter-rules', async (req, res) => {
    try {
      // 处理规则保存逻辑
      res.json({ success: true, ruleId: 'generated-id' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/treesitter-rules', async (req, res) => {
    try {
      // 获取所有规则
      res.json({ rules: [] });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/treesitter-rules/test', async (req, res) => {
    try {
      // 测试规则
      const { rule, testCode } = req.body;
      // 执行测试逻辑
      res.json({ results: [] });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
```

### 4. 创建 HTML 入口页面

```html
<!-- public/treesitter-editor.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tree-sitter 规则编辑器</title>
    <link rel="stylesheet" href="/treesitter-editor/static/styles.css">
</head>
<body>
    <div id="root"></div>

    <script src="/treesitter-editor/static/bundle.js"></script>
</body>
</html>
```

## 部署和运行

### 1. 构建前端代码

```bash
# 安装前端构建工具
npm install --save-dev webpack webpack-cli ts-loader css-loader style-loader

# 创建 webpack 配置
# webpack.config.js
const path = require('path');

module.exports = {
  entry: './src/services/treesitter-editor/TreeSitterEditorApp.tsx',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  mode: 'development'
};
```

### 2. 启动服务器

```bash
# 构建项目
npm run build

# 启动服务器
npm start

# 访问编辑器
# 打开浏览器访问 http://localhost:3000/treesitter-editor
```

## 高级用法

### 1. 自定义规则验证

```typescript
// 创建自定义验证器
class CustomRuleValidator extends RuleValidationService {
  validateCustomCondition(condition: RuleCondition): ValidationResult {
    // 自定义验证逻辑
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }
}
```

### 2. 扩展动作类型

```typescript
// 添加新的动作类型
interface CustomRuleAction extends RuleAction {
  type: 'custom_action';
  parameters: {
    customParam: string;
  };
}
```

### 3. 集成外部系统

```typescript
// 集成到代码索引系统
class TreeSitterRuleIndexer {
  async indexWithCustomRules(codebase: Codebase, rules: CustomRuleDefinition[]) {
    // 使用自定义规则进行索引
  }
}
```

## 故障排除

### 常见问题

1. **TypeScript 编译错误**
   - 确保已安装 React 类型定义
   - 检查 tsconfig.json 中的 JSX 配置

2. **样式不生效**
   - 确保正确导入 CSS 文件
   - 检查 CSS 选择器优先级

3. **规则测试失败**
   - 检查 DSL 语法是否正确
   - 确认目标 AST 节点类型是否存在

4. **HTTP 端点无法访问**
   - 确保路由配置正确
   - 检查服务器启动状态

### 调试技巧

1. 使用浏览器开发者工具检查 React 组件状态
2. 查看 TypeScript 编译错误日志
3. 使用 network 面板检查 API 请求
4. 在组件中添加 console.log 进行调试

## 扩展计划

### 短期目标
1. 创建主应用程序入口
2. 添加样式支持
3. 集成 HTTP 服务
4. 提供完整的部署指南

### 长期目标
1. 添加更多高级规则类型
2. 支持规则导入/导出
3. 集成版本控制
4. 提供团队协作功能

## 相关文档

- [Tree-sitter 官方文档](https://tree-sitter.github.io/tree-sitter/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [MCP 协议文档](./MCP/)

## 贡献指南

1. Fork 项目仓库
2. 创建功能分支
3. 提交代码更改
4. 创建 Pull Request

## 许可证

该项目遵循 MIT 许可证。