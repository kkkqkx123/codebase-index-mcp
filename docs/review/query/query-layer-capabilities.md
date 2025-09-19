# 查询层能力文档

## 概述

查询层是代码库索引系统的核心组件，负责协调和执行各种类型的查询请求。它提供了统一的接口来处理语义搜索、图搜索、混合搜索等多种查询方式，并支持智能查询优化、结果融合和性能监控。

## 支持的查询类型

### 1. 语义搜索 (Semantic Search)
- **描述**: 基于向量嵌入的语义相似性搜索
- **实现**: <mcfile name="SemanticSearchService.ts" path="src/services/search/SemanticSearchService.ts"></mcfile>
- **能力**:
  - 查询嵌入生成和向量相似性计算
  - 多维度过滤（语言、文件类型、路径）
  - 结果增强和排序（语义分数、上下文相关性、时效性、流行度）
  - 概念扩展和查询建议

### 2. 图搜索 (Graph Search)
- **描述**: 基于代码知识图谱的关系和路径搜索
- **实现**: <mcfile name="GraphSearchService.ts" path="src/services/storage/graph/GraphSearchService.ts"></mcfile>
- **能力**:
  - 语义搜索（节点内容匹配）
  - 关系搜索（依赖关系、调用关系）
  - 路径搜索（节点间路径查找）
  - 模糊搜索（近似匹配）
  - 支持节点类型、关系类型、文件路径过滤

### 3. 混合搜索 (Hybrid Search)
- **描述**: 结合多种搜索策略的综合性搜索
- **实现**: <mcfile name="HybridSearchService.ts" path="src/services/search/HybridSearchService.ts"></mcfile>
- **能力**:
  - 并行执行语义、关键词、模糊、结构搜索
  - 基于权重的结果融合算法
  - 用户反馈驱动的权重调整
  - 搜索结果解释和匹配详情生成

### 4. 查询协调服务 (Query Coordination)
- **描述**: 统一查询入口和协调器
- **实现**: <mcfile name="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts"></mcfile>
- **能力**:
  - 统一查询接口 <mcsymbol name="QueryRequest" filename="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts" startline="8" type="interface"></mcsymbol>
  - 智能查询路由和并行执行
  - 结果缓存和性能监控
  - 批量查询处理

## 查询优化能力

### 查询分析 <mcsymbol name="QueryAnalysis" filename="QueryOptimizer.ts" path="src/services/query/QueryOptimizer.ts" startline="35" type="interface"></mcsymbol>
- **查询类型识别**: 关键词、语义、结构、混合
- **意图分析**: 搜索、分析、导航、调试
- **实体提取**: 文件、函数、类、变量、概念
- **上下文分析**: 代码特定性、项目特定性、图分析需求

### 查询优化策略 <mcsymbol name="OptimizedQuery" filename="QueryOptimizer.ts" path="src/services/query/QueryOptimizer.ts" startline="17" type="interface"></mcsymbol>
- **查询扩展**: 同义词和关联概念生成
- **过滤器优化**: 智能过滤器推荐和调整
- **搜索策略选择**: 基于查询复杂度的策略决策
- **性能预估**: 延迟、复杂度、资源使用评估

### 优化策略类型
1. **语义优先策略**: 适用于概念性查询
2. **混合策略**: 适用于结构化和语义混合查询
3. **图优先策略**: 适用于关系密集型查询
4. **多阶段策略**: 适用于复杂组合查询

## 查询参数和过滤条件

### 基本参数 <mcsymbol name="QueryRequest" filename="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts" startline="8" type="interface"></mcsymbol>
```typescript
interface QueryRequest {
  query: string;           // 查询文本
  projectId: string;       // 项目标识
  options?: {
    limit?: number;        // 结果数量限制
    threshold?: number;    // 相似度阈值
    includeGraph?: boolean; // 是否包含图信息
    filters?: {
      language?: string[];  // 语言过滤
      fileType?: string[]; // 文件类型过滤
      path?: string[];     // 路径过滤
    };
    searchType?: 'semantic' | 'hybrid' | 'graph'; // 搜索类型
  };
}
```

### 高级过滤条件
- **语言过滤**: TypeScript、JavaScript、Python等
- **文件类型过滤**: .ts、.js、.py、.md等
- **路径过滤**: 基于文件路径的模式匹配
- **自定义过滤**: 字段级别的精确匹配、范围匹配等

## 结果处理和融合

### 结果格式 <mcsymbol name="QueryResult" filename="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts" startline="25" type="interface"></mcsymbol>
```typescript
interface QueryResult {
  id: string;                    // 结果唯一标识
  score: number;                 // 综合得分
  filePath: string;              // 文件路径
  content: string;               // 匹配内容
  startLine: number;             // 起始行号
  endLine: number;               // 结束行号
  language: string;              // 语言类型
  chunkType: string;             // 代码块类型
  metadata: Record<string, any>; // 元数据
  graphContext?: {               // 图上下文信息
    dependencies: string[];      // 依赖关系
    relationships: Array<{       // 关联关系
      type: string;              // 关系类型
      target: string;            // 目标节点
      strength: number;          // 关系强度
    }>;
  };
}
```

### 融合算法
- **权重计算**: 基于搜索策略类型分配权重
- **分数归一化**: 不同搜索类型的分数标准化
- **去重处理**: 相同结果的合并和去重
- **排序优化**: 基于综合得分的最终排序

## 性能监控和缓存

### 性能指标 <mcsymbol name="QueryMetrics" filename="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts" startline="47" type="interface"></mcsymbol>
- **执行时间**: 总执行时间、向量搜索时间、图搜索时间、融合时间
- **吞吐量**: 每秒处理的结果数量
- **延迟**: 查询响应时间
- **成功率**: 查询成功比例
- **缓存命中率**: 缓存使用效率

### 缓存策略
- **激进缓存**: 适用于简单查询
- **适度缓存**: 默认策略
- **保守缓存**: 适用于复杂查询

## 使用示例

### 基本语义搜索
```typescript
const result = await queryService.executeQuery({
  query: "find all React components",
  projectId: "project-123",
  options: {
    limit: 10,
    filters: {
      language: ["typescript"],
      fileType: ["tsx"]
    }
  }
});
```

### 混合搜索
```typescript
const result = await queryService.executeQuery({
  query: "how to handle authentication in Next.js",
  projectId: "project-123",
  options: {
    searchType: "hybrid",
    includeGraph: true
  }
});
```

### 批量查询
```typescript
const batchResult = await queryService.executeBatchQueries([
  { query: "user authentication", projectId: "project-123" },
  { query: "database connection", projectId: "project-123" }
]);
```

## 扩展能力

### 自定义搜索策略
系统支持通过实现自定义搜索策略来扩展查询能力

### 插件机制
可以通过插件机制集成第三方搜索服务

### 机器学习优化
查询优化器支持基于历史数据的机器学习优化

## 性能考虑

1. **查询复杂度**: 复杂查询可能需要更多计算资源
2. **缓存策略**: 根据查询模式调整缓存策略
3. **并行执行**: 充分利用多核CPU进行并行搜索
4. **内存管理**: 大型结果集的内存优化处理

## 限制和约束

1. **图搜索依赖**: 需要配置图数据库服务
2. **嵌入模型**: 依赖预训练的嵌入模型
3. **内存使用**: 大规模索引需要足够内存
4. **并发限制**: 高并发场景下的性能考虑

## 未来扩展

1. **多模态搜索**: 支持代码、文档、图像等多模态搜索
2. **实时搜索**: 支持实时索引和搜索
3. **联邦搜索**: 支持跨多个代码库的联合搜索
4. **个性化搜索**: 基于用户行为的个性化结果排序