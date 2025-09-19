# 查询接口聚合方案

## 概述

本文档描述了代码库索引系统中查询接口的聚合方案，旨在提供一个统一、高效且可扩展的查询接口层，整合现有的多种搜索服务能力。

## 当前架构分析

### 现有搜索服务

系统目前包含以下主要搜索服务：

1. **<mcsymbol name="HybridSearchService" filename="HybridSearchService.ts" path="src/services/search/HybridSearchService.ts" startline="84" type="class"></mcsymbol>**
   - 提供混合搜索能力，支持语义、关键词、模糊和结构化搜索
   - 接口：`search(params: HybridSearchParams)`
   - 支持权重调整和策略配置

2. **<mcsymbol name="SemanticSearchService" filename="SemanticSearchService.ts" path="src/services/search/SemanticSearchService.ts" startline="73" type="class"></mcsymbol>**
   - 提供纯语义搜索能力
   - 接口：`search(params: SemanticSearchParams)`
   - 支持概念搜索和代码片段搜索

3. **<mcsymbol name="GraphSearchService" filename="GraphSearchService.ts" path="src/services/storage/graph/GraphSearchService.ts" startline="158" type="class"></mcsymbol>**
   - 提供图搜索能力（当前实现不完整）
   - 接口：`semanticSearch()` 和 `relationshipSearch()`

4. **<mcsymbol name="QueryCoordinationService" filename="QueryCoordinationService.ts" path="src/services/query/QueryCoordinationService.ts" startline="174" type="class"></mcsymbol>**
   - 提供查询协调能力
   - 当前仅协调向量和图搜索，功能有限

### API端点现状

当前API端点分散在多个路由中：
- `/api/v1/search/hybrid` - 混合搜索
- `/api/v1/search/semantic` - 语义搜索  
- `/api/v1/search/keyword` - 关键词搜索
- `/api/v1/search/suggest` - 搜索建议
- `/api/v1/search/history` - 搜索历史
- `/api/v1/search/advanced` - 高级搜索

## 聚合方案设计

### 1. 统一查询接口定义

```typescript
// 统一查询请求接口
export interface UnifiedQueryRequest {
  // 基础参数
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  
  // 搜索策略配置
  strategies?: SearchStrategy[];
  weights?: StrategyWeights;
  
  // 过滤条件
  filters?: SearchFilters;
  
  // 高级选项
  context?: QueryContext;
  optimization?: QueryOptimizationOptions;
}

// 搜索策略类型
export type SearchStrategy = 
  | 'semantic' 
  | 'keyword' 
  | 'fuzzy' 
  | 'structural'
  | 'graph'
  | 'vector';

// 策略权重配置
export interface StrategyWeights {
  semantic?: number;
  keyword?: number;
  fuzzy?: number;
  structural?: number;
  graph?: number;
  vector?: number;
}
```

### 2. 聚合服务实现

创建新的聚合服务类：<mcfile name="QueryAggregationService.ts" path="src/services/query/QueryAggregationService.ts"></mcfile>

```typescript
@injectable()
export class QueryAggregationService {
  constructor(
    @inject(TYPES.HybridSearchService) private hybridSearch: HybridSearchService,
    @inject(TYPES.SemanticSearchService) private semanticSearch: SemanticSearchService,
    @inject(TYPES.GraphSearchService) private graphSearch: GraphSearchService,
    @inject(TYPES.QueryOptimizer) private queryOptimizer: QueryOptimizer,
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async executeQuery(request: UnifiedQueryRequest): Promise<UnifiedQueryResult> {
    // 1. 查询优化和分析
    const optimizedQuery = await this.queryOptimizer.optimize({
      query: request.query,
      context: request.context,
      strategies: request.strategies
    });

    // 2. 并行执行搜索策略
    const searchResults = await this.executeStrategiesInParallel(
      optimizedQuery,
      request
    );

    // 3. 结果融合和排名
    const fusedResults = await this.fuseResults(searchResults, request);

    // 4. 返回统一格式结果
    return {
      results: fusedResults,
      metrics: this.calculateMetrics(searchResults),
      optimization: optimizedQuery
    };
  }

  private async executeStrategiesInParallel(
    optimizedQuery: OptimizedQuery,
    request: UnifiedQueryRequest
  ): Promise<StrategyResults> {
    const strategies = optimizedQuery.recommendedStrategies;
    const promises: Promise<StrategyResult>[] = [];

    strategies.forEach(strategy => {
      switch (strategy) {
        case 'semantic':
          promises.push(this.executeSemanticSearch(optimizedQuery, request));
          break;
        case 'hybrid':
          promises.push(this.executeHybridSearch(optimizedQuery, request));
          break;
        case 'graph':
          promises.push(this.executeGraphSearch(optimizedQuery, request));
          break;
        // ... 其他策略
      }
    });

    return Promise.all(promises);
  }
}
```

### 3. 统一结果格式

```typescript
export interface UnifiedQueryResult {
  results: UnifiedSearchResult[];
  metrics: QueryMetrics;
  optimization?: QueryOptimizationInfo;
}

export interface UnifiedSearchResult {
  id: string;
  score: number;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
  
  // 策略贡献度分析
  strategyContributions: {
    semantic?: number;
    keyword?: number;
    fuzzy?: number;
    structural?: number;
    graph?: number;
  };
  
  // 匹配高亮信息
  matchHighlights: MatchHighlight[];
  
  // 上下文信息
  context?: ResultContext;
}
```

### 4. API路由整合

创建统一查询端点：

```typescript
// 在 SearchRoutes 中添加统一查询端点
this.router.post('/unified', this.unifiedSearch.bind(this));

private async unifiedSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params: UnifiedQueryRequest = req.body;

    if (!params.query || !params.projectId) {
      res.status(400).json({
        success: false,
        error: 'query and projectId are required',
      });
      return;
    }

    const results = await this.queryAggregationService.executeQuery(params);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
}
```

## 实施步骤

### 阶段一：接口统一和基础聚合
1. 定义统一查询接口 `UnifiedQueryRequest`
2. 创建 `QueryAggregationService` 基础框架
3. 实现语义搜索和混合搜索的聚合
4. 添加统一API端点 `/api/v1/search/unified`

### 阶段二：策略扩展和优化
1. 完善图搜索策略集成
2. 实现智能策略选择和权重调整
3. 添加查询优化器集成
4. 实现高级结果融合算法

### 阶段三：高级功能和性能优化
1. 添加缓存策略优化
2. 实现实时性能监控
3. 添加A/B测试框架
4. 实现自适应学习机制

## 优势和价值

### 对开发者的价值
1. **简化接口调用**：单一端点替代多个分散接口
2. **智能策略选择**：自动选择最优搜索策略组合
3. **统一结果格式**：标准化返回结果格式
4. **性能优化**：智能缓存和并行执行

### 对系统的价值
1. **可扩展性**：易于添加新的搜索策略
2. **可维护性**：集中化的查询逻辑
3. **可观测性**：统一的监控和日志
4. **灵活性**：支持动态策略配置

## 性能考虑

1. **并行执行**：利用Promise.all并行执行不同策略
2. **缓存策略**：多级缓存（查询级、策略级、结果级）
3. **超时控制**：为每个策略设置合理的超时时间
4. **资源限制**：根据系统负载动态调整并行度

## 监控和日志

```typescript
interface QueryMetrics {
  queryId: string;
  executionTime: number;
  strategyTimes: Record<string, number>;
  resultCount: number;
  cacheHit: boolean;
  strategyDistribution: Record<string, number>;
  errorCount: number;
}
```

## 后续扩展

1. **机器学习集成**：基于用户反馈自动调整策略权重
2. **个性化搜索**：基于用户历史偏好优化搜索结果
3. **多模态搜索**：支持代码、文档、图像等多模态内容搜索
4. **联邦搜索**：支持跨多个代码库的联合搜索

## 总结

本聚合方案通过统一的接口层整合了系统现有的多种搜索能力，提供了更加智能、高效和易用的查询体验。方案采用分阶段实施策略，确保平稳过渡和持续优化。