# LSP工作流集成详细方案

## 概述

本文档详细描述了LSP如何集成到Codebase Index的主要业务流程中，包括索引流程、搜索流程、增量更新和实时监控等核心工作流。

## 工作流架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Core Workflows                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Index     │  │    Search    │  │   Incremental        │   │
│  │  Workflow   │  │  Workflow    │  │   Update Workflow    │   │
│  └─────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│        │                 │                    │               │
│  ┌─────┴─────────────────┴────────────────────┴───────────┐   │
│  │              LSP Integration Layer                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  Diagnostic  │  │   Symbol     │  │   Type       │  │   │
│  │  │   Service    │  │  Service     │  │  Service     │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 1. 索引工作流集成

### 1.1 标准索引流程（带LSP增强）

```typescript
class EnhancedIndexWorkflow {
  async executeIndex(projectPath: string, options: IndexOptions): Promise<IndexResult> {
    const workflow = new IndexWorkflowBuilder()
      .withLSP(options.enableLSP)
      .withCaching(options.cacheLSP)
      .build();
    
    return await workflow.execute(projectPath);
  }
}

class LSPEnhancedIndexWorkflow {
  private phases = [
    new DiscoveryPhase(),
    new ParsePhase(),
    new LSPEnhancementPhase(), // 新增LSP增强阶段
    new EmbeddingPhase(),
    new StoragePhase()
  ];
  
  async execute(projectPath: string): Promise<IndexResult> {
    const context = new IndexContext(projectPath);
    
    for (const phase of this.phases) {
      await phase.execute(context);
    }
    
    return context.getResult();
  }
}
```

### 1.2 LSP增强阶段详细实现

```typescript
class LSPEnhancementPhase implements IndexPhase {
  constructor(
    private lspManager: LSPManager,
    private cache: LSPResponseCache
  ) {}
  
  async execute(context: IndexContext): Promise<void> {
    const files = context.getParsedFiles();
    const enhancements = new Map<string, LSPEnhancement>();
    
    // 批量处理，避免内存溢出
    const batchSize = 20;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchEnhancements = await this.processBatch(batch);
      
      // 合并到上下文
      for (const [filePath, enhancement] of batchEnhancements) {
        context.addLSPEnhancement(filePath, enhancement);
        enhancements.set(filePath, enhancement);
      }
    }
    
    context.setLSPEnhancements(enhancements);
  }
  
  private async processBatch(files: ParsedFile[]): Promise<Map<string, LSPEnhancement>> {
    const results = new Map<string, LSPEnhancement>();
    
    const promises = files.map(async (file) => {
      try {
        const enhancement = await this.lspManager.enhanceFile(file.path, file.content);
        results.set(file.path, enhancement);
      } catch (error) {
        // 失败时降级到基础解析
        this.logger.warn(`LSP enhancement failed for ${file.path}`, error);
        results.set(file.path, { failed: true, error: error.message });
      }
    });
    
    await Promise.allSettled(promises);
    return results;
  }
}
```

### 1.3 项目初始化时的LSP设置

```typescript
class LSPProjectInitializer {
  async setupForProject(projectPath: string): Promise<LSPSetupResult> {
    const setup = new LSPSetupBuilder()
      .withProjectPath(projectPath)
      .detectLanguages()
      .configureServers()
      .validateSetup();
    
    return await setup.execute();
  }
}

class LSPSetupBuilder {
  private config: LSPSetupConfig = {};
  
  detectLanguages(): this {
    const languages = this.detectProjectLanguages();
    this.config.languages = languages;
    return this;
  }
  
  configureServers(): this {
    for (const lang of this.config.languages) {
      const serverConfig = this.getServerConfig(lang);
      if (serverConfig) {
        this.config.servers[lang] = serverConfig;
      }
    }
    return this;
  }
  
  validateSetup(): this {
    // 检查语言服务器是否可用
    for (const [lang, config] of Object.entries(this.config.servers)) {
      const isAvailable = await this.checkServerAvailability(lang, config);
      if (!isAvailable) {
        this.logger.warn(`Language server for ${lang} not available, will use Tree-sitter only`);
        delete this.config.servers[lang];
      }
    }
    return this;
  }
}
```

## 2. 搜索工作流集成

### 2.1 语义搜索增强

```typescript
class LSPEnhancedSearchService {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // 并行执行基础搜索和LSP搜索
    const [baseResults, lspResults] = await Promise.allSettled([
      this.baseSearch.search(query, options),
      options.enableLSP ? this.lspSearch.search(query, options) : Promise.resolve([])
    ]);
    
    const results = [];
    
    if (baseResults.status === 'fulfilled') {
      results.push(...baseResults.value);
    }
    
    if (lspResults.status === 'fulfilled' && lspResults.value.length > 0) {
      results.push(...this.mergeSearchResults(results, lspResults.value));
    }
    
    return this.deduplicateAndRank(results);
  }
}

class LSPSearchService {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const searchStrategies = [
      new SymbolSearchStrategy(),
      new TypeSearchStrategy(),
      new DefinitionSearchStrategy()
    ];
    
    const results: SearchResult[] = [];
    
    for (const strategy of searchStrategies) {
      if (strategy.isApplicable(query, options)) {
        const strategyResults = await strategy.search(query, options);
        results.push(...strategyResults);
      }
    }
    
    return results;
  }
}
```

### 2.2 符号搜索策略

```typescript
class SymbolSearchStrategy implements SearchStrategy {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const symbols = await this.lspManager.findSymbols(query);
    
    return symbols.map(symbol => ({
      type: 'lsp-symbol',
      filePath: symbol.location.uri,
      range: symbol.location.range,
      name: symbol.name,
      kind: symbol.kind,
      score: this.calculateRelevanceScore(symbol, query),
      metadata: {
        symbolType: symbol.kind,
        containerName: symbol.containerName,
        source: 'lsp'
      }
    }));
  }
  
  private calculateRelevanceScore(symbol: SymbolInformation, query: string): number {
    const nameScore = this.calculateNameMatch(symbol.name, query);
    const containerScore = symbol.containerName ? 
      this.calculateContainerMatch(symbol.containerName, query) : 0;
    
    return nameScore * 0.7 + containerScore * 0.3;
  }
}
```

## 3. 增量更新工作流

### 3.1 文件变更监听

```typescript
class LSPIncrementalUpdater {
  constructor(
    private fileWatcher: FileWatcherService,
    private lspManager: LSPManager,
    private cache: LSPResponseCache
  ) {
    this.setupFileWatchers();
  }
  
  private setupFileWatchers(): void {
    this.fileWatcher.onFileChange(async (event) => {
      switch (event.type) {
        case 'changed':
          await this.handleFileChange(event.filePath);
          break;
        case 'created':
          await this.handleFileCreate(event.filePath);
          break;
        case 'deleted':
          await this.handleFileDelete(event.filePath);
          break;
      }
    });
  }
  
  private async handleFileChange(filePath: string): Promise<void> {
    // 1. 使缓存失效
    this.cache.invalidate(filePath);
    
    // 2. 重新获取LSP数据
    try {
      const enhancement = await this.lspManager.enhanceFile(filePath);
      
      // 3. 更新索引
      await this.updateIndexWithLSP(filePath, enhancement);
      
    } catch (error) {
      this.logger.error(`Failed to update LSP data for ${filePath}`, error);
    }
  }
}
```

### 3.2 批量增量处理

```typescript
class LSPBatchUpdater {
  private updateQueue: string[] = [];
  private processing = false;
  
  async queueUpdate(filePaths: string[]): Promise<void> {
    this.updateQueue.push(...filePaths);
    
    if (!this.processing) {
      this.processing = true;
      await this.processUpdateQueue();
    }
  }
  
  private async processUpdateQueue(): Promise<void> {
    const batchSize = 50;
    
    while (this.updateQueue.length > 0) {
      const batch = this.updateQueue.splice(0, batchSize);
      
      try {
        await this.processBatchUpdate(batch);
      } catch (error) {
        this.logger.error('Batch update failed', error);
        // 可以重试失败的文件
        this.updateQueue.unshift(...batch);
      }
      
      // 避免CPU过载
      await this.sleep(100);
    }
    
    this.processing = false;
  }
  
  private async processBatchUpdate(files: string[]): Promise<void> {
    const enhancements = await this.lspManager.enhanceBatch(files);
    
    for (const [filePath, enhancement] of enhancements) {
      if (!enhancement.failed) {
        await this.updateIndex(filePath, enhancement);
      }
    }
  }
}
```

## 4. 实时监控工作流

### 4.1 实时诊断监控

```typescript
class LSPDiagnosticMonitor {
  private activeMonitors: Map<string, DiagnosticMonitor> = new Map();
  
  async startMonitoring(projectPath: string): Promise<void> {
    if (this.activeMonitors.has(projectPath)) {
      return; // 已在监控
    }
    
    const monitor = new DiagnosticMonitor(projectPath, this.lspManager);
    await monitor.start();
    
    this.activeMonitors.set(projectPath, monitor);
    
    // 设置事件监听
    monitor.on('diagnostics', (diagnostics) => {
      this.handleDiagnosticsUpdate(projectPath, diagnostics);
    });
  }
  
  private handleDiagnosticsUpdate(projectPath: string, diagnostics: Diagnostic[]): void {
    // 1. 更新存储的诊断信息
    this.updateStoredDiagnostics(projectPath, diagnostics);
    
    // 2. 触发实时通知
    this.emitDiagnosticUpdate({
      projectPath,
      diagnostics,
      timestamp: Date.now()
    });
    
    // 3. 更新搜索索引
    this.updateSearchIndexWithDiagnostics(projectPath, diagnostics);
  }
}

class DiagnosticMonitor {
  private watchingFiles: Set<string> = new Set();
  
  async start(): Promise<void> {
    // 获取项目中的所有文件
    const files = await this.getProjectFiles();
    
    // 为每个文件启动诊断监控
    for (const file of files) {
      await this.startFileMonitoring(file);
    }
  }
  
  private async startFileMonitoring(filePath: string): Promise<void> {
    if (this.watchingFiles.has(filePath)) {
      return;
    }
    
    const client = await this.lspManager.getClient(filePath);
    if (!client) return;
    
    // 监听诊断变化
    client.on('diagnostics', (params) => {
      if (params.uri === filePath) {
        this.emit('diagnostics', {
          filePath,
          diagnostics: params.diagnostics
        });
      }
    });
    
    this.watchingFiles.add(filePath);
  }
}
```

### 4.2 性能监控

```typescript
class LSPPerformanceMonitor {
  private metrics = {
    responseTime: new Histogram('lsp_response_time'),
    cacheHitRate: new Gauge('lsp_cache_hit_rate'),
    activeConnections: new Gauge('lsp_active_connections'),
    errorRate: new Gauge('lsp_error_rate')
  };
  
  async monitorOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      this.metrics.responseTime.observe(Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.metrics.errorRate.inc();
      throw error;
    }
  }
  
  async collectMetrics(): Promise<LSPMetrics> {
    return {
      responseTime: await this.metrics.responseTime.get(),
      cacheHitRate: await this.metrics.cacheHitRate.get(),
      activeConnections: await this.metrics.activeConnections.get(),
      errorRate: await this.metrics.errorRate.get()
    };
  }
}
```

## 5. 错误处理和恢复

### 5.1 工作流错误处理

```typescript
class LSPWorkflowErrorHandler {
  async handleIndexingError(
    error: Error,
    context: IndexContext
  ): Promise<IndexResult> {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'lsp-server-unavailable':
        return await this.handleServerUnavailable(context);
      
      case 'lsp-timeout':
        return await this.handleTimeout(context);
      
      case 'lsp-parse-error':
        return await this.handleParseError(context);
      
      default:
        throw error; // 重新抛出未知错误
    }
  }
  
  private async handleServerUnavailable(context: IndexContext): Promise<IndexResult> {
    this.logger.warn('LSP server unavailable, falling back to Tree-sitter');
    
    // 禁用LSP并重新索引
    context.disableLSP();
    return await this.reindexWithoutLSP(context);
  }
  
  private async handleTimeout(context: IndexContext): Promise<IndexResult> {
    this.logger.warn('LSP timeout, using cached data');
    
    // 使用缓存数据
    const cachedEnhancements = await this.cache.getCachedEnhancements(context.getFiles());
    context.useCachedEnhancements(cachedEnhancements);
    
    return context.getResult();
  }
}
```

### 5.2 自动恢复机制

```typescript
class LSPAutoRecovery {
  private recoveryAttempts = new Map<string, number>();
  private maxRetries = 3;
  
  async attemptRecovery(
    failedFiles: string[],
    error: Error
  ): Promise<{ recovered: string[], stillFailed: string[] }> {
    const recovered: string[] = [];
    const stillFailed: string[] = [];
    
    for (const file of failedFiles) {
      const attempts = this.recoveryAttempts.get(file) || 0;
      
      if (attempts >= this.maxRetries) {
        stillFailed.push(file);
        continue;
      }
      
      try {
        await this.retryFileEnhancement(file);
        recovered.push(file);
        this.recoveryAttempts.delete(file);
      } catch (error) {
        this.recoveryAttempts.set(file, attempts + 1);
        stillFailed.push(file);
      }
    }
    
    return { recovered, stillFailed };
  }
  
  private async retryFileEnhancement(filePath: string): Promise<void> {
    // 重启LSP服务器
    await this.lspManager.restartServerForFile(filePath);
    
    // 重试增强
    await this.lspManager.enhanceFile(filePath);
  }
}
```

## 6. 配置和调优

### 6.1 工作流配置

```typescript
interface LSPWorkflowConfig {
  indexing: {
    enableLSP: boolean;
    batchSize: number;
    timeout: number;
    retryAttempts: number;
    cacheTTL: number;
  };
  
  search: {
    enableLSP: boolean;
    maxResults: number;
    includeDiagnostics: boolean;
    includeTypes: boolean;
  };
  
  monitoring: {
    enableRealtime: boolean;
    diagnosticUpdateInterval: number;
    performanceMetrics: boolean;
  };
}

const defaultConfig: LSPWorkflowConfig = {
  indexing: {
    enableLSP: true,
    batchSize: 20,
    timeout: 30000,
    retryAttempts: 3,
    cacheTTL: 1800
  },
  
  search: {
    enableLSP: true,
    maxResults: 100,
    includeDiagnostics: true,
    includeTypes: true
  },
  
  monitoring: {
    enableRealtime: true,
    diagnosticUpdateInterval: 5000,
    performanceMetrics: true
  }
};
```

### 6.2 性能调优参数

```typescript
class LSPPerformanceTuner {
  async tuneForProject(projectPath: string): Promise<TuningResult> {
    const projectStats = await this.analyzeProject(projectPath);
    
    const tuning = new TuningConfiguration()
      .basedOnFileCount(projectStats.fileCount)
      .basedOnLanguages(projectStats.languages)
      .basedOnSize(projectStats.totalSize);
    
    return {
      batchSize: tuning.getOptimalBatchSize(),
      cacheSize: tuning.getOptimalCacheSize(),
      connectionLimit: tuning.getOptimalConnectionLimit(),
      timeout: tuning.getOptimalTimeout()
    };
  }
}
```

## 7. 监控和告警

### 7.1 工作流监控仪表板

```typescript
class LSPWorkflowDashboard {
  async getWorkflowMetrics(): Promise<WorkflowMetrics> {
    return {
      indexing: {
        totalFiles: await this.getTotalFilesProcessed(),
        lspEnhancedFiles: await this.getLSPEnhancedFiles(),
        averageEnhancementTime: await this.getAverageEnhancementTime(),
        errorRate: await this.getIndexingErrorRate()
      },
      
      search: {
        totalQueries: await this.getTotalQueries(),
        lspEnhancedQueries: await this.getLSPEnhancedQueries(),
        averageResponseTime: await this.getAverageSearchTime(),
        cacheHitRate: await this.getCacheHitRate()
      },
      
      system: {
        activeConnections: await this.getActiveConnections(),
        memoryUsage: await this.getMemoryUsage(),
        cacheSize: await this.getCacheSize()
      }
    };
  }
}
```

### 7.2 告警规则

```yaml
alerts:
  lsp_high_error_rate:
    condition: "lsp_error_rate > 0.1"
    severity: "warning"
    message: "LSP error rate is high"
    
  lsp_high_response_time:
    condition: "lsp_response_time > 5000ms"
    severity: "warning"
    message: "LSP response time is too high"
    
  lsp_server_down:
    condition: "lsp_active_connections == 0"
    severity: "critical"
    message: "All LSP servers are down"
```

## 总结

LSP工作流集成采用**非侵入式**设计，通过以下方式实现：

1. **阶段化集成**: 将LSP增强作为独立阶段插入现有工作流
2. **异步处理**: 避免阻塞主要业务流程
3. **缓存优化**: 减少重复计算，提升响应速度
4. **降级机制**: 确保LSP故障时系统仍能正常工作
5. **实时监控**: 提供完整的性能和错误监控

这种设计确保了LSP功能的无缝集成，同时保持了系统的稳定性和可扩展性。