# DI容器迁移指南

## 概述

本指南提供将 `inversify.config.ts` 合并到 `DIContainer.ts` 的详细步骤，实现依赖注入配置的统一化。

## 迁移前检查清单

- [ ] 备份当前代码
- [ ] 确认所有测试可以正常运行
- [ ] 记录当前的服务绑定状态

## 详细迁移步骤

### 步骤1：分析现有配置

#### 1.1 对比TYPES定义

**DIContainer.ts中的TYPES：**
```typescript
export const TYPES = {
  Logger: Symbol.for('Logger'),
  HttpClient: Symbol.for('HttpClient'),
  DatabaseClient: Symbol.for('DatabaseClient'),
  VectorStore: Symbol.for('VectorStore'),
  GraphClient: Symbol.for('GraphClient'),
  FileSystemService: Symbol.for('FileSystemService'),
  CodeParser: Symbol.for('CodeParser'),
  CodeIndexer: Symbol.for('CodeIndexer'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  PathIndex: Symbol.for('PathIndex'),
  SnippetService: Symbol.for('SnippetService'),
  GraphService: Symbol.for('GraphService'),
  BatchProcessor: Symbol.for('BatchProcessor'),
  WorkspaceManager: Symbol.for('WorkspaceManager'),
  ProjectService: Symbol.for('ProjectService'),
} as const;
```

**inversify.config.ts中的TYPES：**
```typescript
export const TYPES = {
  SemanticAnalysisOrchestrator: Symbol.for('SemanticAnalysisOrchestrator'),
  CallGraphService: Symbol.for('CallGraphService'),
  SemanticSemgrepService: Symbol.for('SemanticSemgrepService'),
} as const;
```

#### 1.2 对比服务绑定

**DIContainer.ts中的绑定：**
- 基础服务：Logger、HttpClient、DatabaseClient
- 存储服务：VectorStore、GraphClient
- 文件服务：FileSystemService
- 解析服务：CodeParser、CodeIndexer
- 嵌入服务：EmbeddingService
- 索引服务：PathIndex、SnippetService
- 图服务：GraphService
- 批处理：BatchProcessor
- 项目管理：WorkspaceManager、ProjectService

**inversify.config.ts中的绑定：**
- 语义分析：SemanticAnalysisOrchestrator
- 调用图：CallGraphService
- 语义检查：SemanticSemgrepService

### 步骤2：合并TYPES定义

更新 `DIContainer.ts` 中的TYPES常量：

```typescript
// 在DIContainer.ts中添加以下类型定义
export const TYPES = {
  // 原有类型保持不变
  Logger: Symbol.for('Logger'),
  HttpClient: Symbol.for('HttpClient'),
  DatabaseClient: Symbol.for('DatabaseClient'),
  VectorStore: Symbol.for('VectorStore'),
  GraphClient: Symbol.for('GraphClient'),
  FileSystemService: Symbol.for('FileSystemService'),
  CodeParser: Symbol.for('CodeParser'),
  CodeIndexer: Symbol.for('CodeIndexer'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  PathIndex: Symbol.for('PathIndex'),
  SnippetService: Symbol.for('SnippetService'),
  GraphService: Symbol.for('GraphService'),
  BatchProcessor: Symbol.for('BatchProcessor'),
  WorkspaceManager: Symbol.for('WorkspaceManager'),
  ProjectService: Symbol.for('ProjectService'),
  
  // 新增来自inversify.config.ts的类型
  SemanticAnalysisOrchestrator: Symbol.for('SemanticAnalysisOrchestrator'),
  CallGraphService: Symbol.for('CallGraphService'),
  SemanticSemgrepService: Symbol.for('SemanticSemgrepService'),
} as const;
```

### 步骤3：添加服务绑定

在 `DIContainer.ts` 的相应模块中添加服务绑定：

#### 3.1 更新servicesModule

```typescript
const servicesModule = new ContainerModule((bind) => {
  // 原有绑定保持不变
  bind(TYPES.BatchProcessor)
    .to(BatchProcessor)
    .inSingletonScope();
  bind(TYPES.WorkspaceManager)
    .to(WorkspaceManager)
    .inSingletonScope();
  bind(TYPES.ProjectService)
    .to(ProjectService)
    .inSingletonScope();
  
  // 新增来自inversify.config.ts的绑定
  bind(TYPES.SemanticAnalysisOrchestrator)
    .to(SemanticAnalysisOrchestrator)
    .inSingletonScope();
  bind(TYPES.CallGraphService)
    .to(CallGraphService)
    .inSingletonScope();
  bind(TYPES.SemanticSemgrepService)
    .to(SemanticSemgrepService)
    .inSingletonScope();
});
```

#### 3.2 确保导入正确

在 `DIContainer.ts` 顶部添加必要的导入：

```typescript
// 确保以下导入存在
import { SemanticAnalysisOrchestrator } from './services/orchestrator/SemanticAnalysisOrchestrator';
import { CallGraphService } from './services/parser/CallGraphService';
import { SemanticSemgrepService } from './services/semgrep/SemanticSemgrepService';
```

### 步骤4：更新引用文件

#### 4.1 更新 SemanticAnalysisOrchestrator.ts

```typescript
// 原文件：src/services/SemanticAnalysisOrchestrator.ts
// 修改第2行的导入
// 从：
import { TYPES } from '../inversify.config';

// 改为：
import { TYPES } from '../core/DIContainer';
```

#### 4.2 更新 CallGraphService.ts

```typescript
// 原文件：src/services/parser/CallGraphService.ts
// 修改第4行的导入
// 从：
import { TYPES } from '../../inversify.config';

// 改为：
import { TYPES } from '../../core/DIContainer';
```

#### 4.3 更新 SemanticSemgrepService.ts

```typescript
// 原文件：src/services/semgrep/SemanticSemgrepService.ts
// 修改第5行的导入
// 从：
import { TYPES } from '../../inversify.config';

// 改为：
import { TYPES } from '../../core/DIContainer';
```

### 步骤5：验证配置

#### 5.1 检查类型一致性

运行TypeScript编译检查：

```bash
npx tsc --noEmit
```

#### 5.2 运行测试

确保所有测试通过：

```bash
npm test
```

#### 5.3 验证服务解析

创建验证脚本 `test-di-validation.ts`：

```typescript
import { DIContainer } from './src/core/DIContainer';
import { TYPES } from './src/core/DIContainer';

async function validateContainer() {
  const container = DIContainer.getInstance();
  
  // 验证所有服务都能正确解析
  const services = [
    TYPES.SemanticAnalysisOrchestrator,
    TYPES.CallGraphService,
    TYPES.SemanticSemgrepService,
  ];
  
  for (const serviceType of services) {
    try {
      const service = container.get(serviceType);
      console.log(`✅ ${serviceType.toString()} resolved successfully`);
    } catch (error) {
      console.error(`❌ Failed to resolve ${serviceType.toString()}:`, error);
    }
  }
}

validateContainer().catch(console.error);
```

### 步骤6：清理工作

#### 6.1 删除inversify.config.ts

```bash
rm src/inversify.config.ts
```

#### 6.2 检查残留引用

确保没有文件再引用inversify.config.ts：

```bash
# 在Windows PowerShell中
Get-ChildItem -Path src -Recurse -Filter *.ts | 
  Select-String -Pattern "inversify\.config" |
  Select-Object Filename, LineNumber, Line
```

## 回滚计划

如果迁移过程中遇到问题，可以按照以下步骤回滚：

1. 恢复备份的 `inversify.config.ts` 文件
2. 恢复引用文件的导入语句
3. 回滚 `DIContainer.ts` 的修改
4. 重新运行测试验证

## 验证清单

迁移完成后，请检查以下项目：

- [ ] 所有测试通过
- [ ] TypeScript编译无错误
- [ ] 应用启动正常
- [ ] 核心功能正常工作
- [ ] 没有残留的inversify.config.ts引用
- [ ] 服务容器验证脚本运行成功

## 注意事项

1. **依赖检查**：确保所有新增的服务都有正确的依赖注入配置
2. **循环依赖**：检查是否存在循环依赖问题
3. **作用域**：确认所有服务的作用域设置正确（singleton/transient）
4. **错误处理**：添加适当的错误处理和日志记录

## 常见问题解答

### Q: 迁移后服务无法解析怎么办？
A: 检查以下几点：
- 服务类是否正确导入
- 绑定配置是否正确
- 服务构造函数是否有未满足的依赖

### Q: 如何处理循环依赖？
A: 考虑以下解决方案：
- 使用工厂模式
- 重构服务拆分
- 使用延迟注入（Lazy Injection）

### Q: 迁移后性能有影响吗？
A: 配置合并应该不会影响性能，反而可能因为减少配置查找而略微提升性能。

## 后续优化建议

迁移完成后，可以考虑以下优化：

1. **模块化改进**：将大模块拆分为更小的功能模块
2. **配置外部化**：将部分配置移到外部配置文件
3. **监控增强**：添加容器健康检查和监控
4. **文档完善**：更新开发者文档，说明新的配置结构