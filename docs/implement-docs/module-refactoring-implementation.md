# 模块重构执行文档

## 重构目标
优化服务层结构，减少模块耦合，提升可维护性和性能

## 第一阶段：架构重构（1-2周）

### 1.1 创建新的模块结构
```bash
# 创建新的服务目录结构
mkdir -p src/services/{indexing,storage,processing,search,monitoring,infrastructure}
```

### 1.2 核心服务迁移

#### Indexing 模块
```typescript
// src/services/indexing/IndexService.ts
export class IndexService implements IIndexService {
  constructor(
    private indexCoordinator: IndexCoordinator,
    private storageCoordinator: StorageCoordinator
  ) {}
  
  async createIndex(projectPath: string, options?: IndexOptions) {
    return this.indexCoordinator.createIndex(projectPath, options);
  }
}

// src/services/indexing/IndexCoordinator.ts
export class IndexCoordinator {
  constructor(
    private changeDetection: ChangeDetectionService,
    private parser: ParserService,
    private storage: StorageCoordinator
  ) {}
  
  async createIndex(projectPath: string, options: IndexOptions) {
    const changes = await this.changeDetection.detectChanges(projectPath);
    const parsedFiles = await this.parser.parseFiles(changes);
    await this.storage.store(parsedFiles);
  }
}
```

#### Storage 模块
```typescript
// src/services/storage/StorageCoordinator.ts
export class StorageCoordinator {
  constructor(
    private vectorStorage: VectorStorageService,
    private graphStorage: GraphStorageService,
    private transactionCoordinator: TransactionCoordinator
  ) {}
  
  async store(files: ParsedFile[]) {
    await this.transactionCoordinator.execute(async () => {
      await this.vectorStorage.store(files);
      await this.graphStorage.store(files);
    });
  }
}
```

### 1.3 提取公共组件

#### BatchProcessingEngine
```typescript
// src/services/processing/BatchProcessor.ts
export class BatchProcessor {
  async processInBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: BatchOptions
  ): Promise<R[]> {
    // 统一的批处理逻辑
  }
}
```

#### MemoryMonitor
```typescript
// src/services/processing/MemoryManager.ts
export class MemoryManager {
  checkMemoryUsage(threshold: number = 80): boolean {
    const usage = process.memoryUsage();
    return (usage.heapUsed / usage.heapTotal) * 100 <= threshold;
  }
}
```

### 1.4 配置管理优化

#### 分层配置接口
```typescript
// src/config/ConfigTypes.ts
export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
}

export interface ServiceConfig {
  database: DatabaseConfig;
  embedding: EmbeddingConfig;
}

export interface FeatureConfig {
  batch: BatchConfig;
  monitoring: MonitoringConfig;
}
```

#### 配置工厂
```typescript
// src/config/ConfigFactory.ts
export class ConfigFactory {
  static getConfig<T>(section: string): T {
    return container.get<ConfigService>(ConfigService).get(section) as T;
  }
}
```

## 第二阶段：性能优化（1周）

### 2.1 异步流水线
```typescript
// src/services/processing/AsyncPipeline.ts
export class AsyncPipeline {
  private steps: Array<(data: any) => Promise<any>> = [];
  
  addStep(step: (data: any) => Promise<any>) {
    this.steps.push(step);
    return this;
  }
  
  async execute(initialData: any) {
    return this.steps.reduce(
      (promise, step) => promise.then(step),
      Promise.resolve(initialData)
    );
  }
}
```

### 2.2 对象池优化
```typescript
// src/utils/ObjectPool.ts
export class ObjectPool<T> {
  private pool: T[] = [];
  
  acquire(creator: () => T): T {
    return this.pool.pop() || creator();
  }
  
  release(obj: T) {
    this.pool.push(obj);
  }
}
```

## 第三阶段：测试验证（1周）

### 3.1 测试策略
- 单元测试：每个新模块的独立测试
- 集成测试：模块间协作测试
- 性能测试：基准测试和负载测试

### 3.2 迁移计划
1. 创建新模块并测试
2. 逐步将功能从旧服务迁移到新模块
3. 更新依赖注入配置
4. 删除旧代码

## 风险控制

1. **渐进式迁移**：逐个模块替换，避免大规模重构
2. **测试保障**：确保每个迁移步骤都有对应测试
3. **回滚方案**：保留旧代码直到新模块稳定

## 验收标准

1. ✅ 服务层目录结构优化完成
2. ✅ IndexService 依赖从9个减少到2-3个
3. ✅ 批处理逻辑统一实现
4. ✅ 性能提升20%以上
5. ✅ 测试覆盖率保持或提升

## 相关文件

- 架构分析：`docs/review/module-architecture-analysis.md`
- 配置规范：`src/config/ConfigTypes.ts`
- 依赖配置：`src/inversify.config.ts`