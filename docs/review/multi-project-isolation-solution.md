# 多项目隔离解决方案

## 概述

基于对当前项目隔离机制的分析，本方案提出了一套完整的多项目隔离解决方案，通过物理隔离的方式为每个项目创建独立的数据库资源，从而解决当前实现中存在的资源共享、性能影响和安全性不足等问题。

## 设计目标

1. **物理隔离**：为每个项目创建独立的数据库资源
2. **性能优化**：避免项目间资源竞争，提升查询性能
3. **安全性增强**：实现项目级别的数据隔离和访问控制
4. **管理便利**：支持独立的项目数据管理、备份和迁移
5. **向后兼容**：确保现有功能不受影响，支持平滑迁移

## 解决方案设计

### 1. Qdrant 向量数据库隔离

#### 集合命名策略
为每个项目创建独立的 Qdrant 集合，命名规则如下：
```
project-{projectId}
```

其中 `projectId` 为项目路径的 SHA256 哈希值的前16位。

#### 实现方案
修改 `VectorStorageService` 类，动态生成集合名称：

```typescript
private generateCollectionName(projectId: string): string {
  return `project-${projectId}`;
}
```

在初始化时，根据项目ID创建或连接到对应的集合：

```typescript
async initialize(projectId: string): Promise<boolean> {
  const collectionName = this.generateCollectionName(projectId);
  this.currentCollection = collectionName;
  
  // 其他初始化逻辑保持不变
  // ...
}
```

#### 配置管理
为每个项目维护独立的配置，支持项目级别的配置定制：

```typescript
interface ProjectVectorConfig {
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  recreateCollection: boolean;
}
```

### 2. Nebula Graph 图数据库隔离

#### 空间命名策略
为每个项目创建独立的 Nebula Graph 空间，命名规则如下：
```
project_{projectId}
```

#### 实现方案
修改图数据库相关服务，动态创建和管理项目空间：

```typescript
private generateSpaceName(projectId: string): string {
  return `project_${projectId}`;
}
```

在初始化时，根据项目ID创建或连接到对应的图空间：

```typescript
async initializeProjectSpace(projectId: string): Promise<boolean> {
  const spaceName = this.generateSpaceName(projectId);
  this.currentSpace = spaceName;
  
  // 检查空间是否存在，如果不存在则创建
  const spaceExists = await this.checkSpaceExists(spaceName);
  if (!spaceExists) {
    await this.createSpace(spaceName);
  }
  
  // 切换到项目空间
  await this.useSpace(spaceName);
  
  return true;
}
```

### 3. 存储协调器改造

#### 项目资源管理
修改 `StorageCoordinator` 类，支持项目级别的资源管理：

```typescript
class StorageCoordinator {
  private projectResources: Map<string, {
    vectorStorage: VectorStorageService;
    graphStorage: GraphPersistenceService;
  }> = new Map();
  
  async initializeProject(projectId: string): Promise<void> {
    // 初始化项目专用的向量存储服务
    const vectorStorage = new VectorStorageService(/* 配置 */);
    await vectorStorage.initialize(projectId);
    
    // 初始化项目专用的图存储服务
    const graphStorage = new GraphPersistenceService(/* 配置 */);
    await graphStorage.initializeProjectSpace(projectId);
    
    // 保存项目资源
    this.projectResources.set(projectId, {
      vectorStorage,
      graphStorage
    });
  }
  
  async getProjectResources(projectId: string): Promise<{
    vectorStorage: VectorStorageService;
    graphStorage: GraphPersistenceService;
  }> {
    if (!this.projectResources.has(projectId)) {
      await this.initializeProject(projectId);
    }
    
    return this.projectResources.get(projectId)!;
  }
}
```

### 4. 索引协调器改造

#### 项目上下文管理
修改 `IndexCoordinator` 类，确保所有操作都在正确的项目上下文中执行：

```typescript
class IndexCoordinator {
  async createIndex(projectPath: string, options: IndexOptions = {}): Promise<IndexResult> {
    const projectId = await HashUtils.calculateDirectoryHash(projectPath);
    
    // 获取项目专用资源
    const { vectorStorage, graphStorage } = await this.storageCoordinator.getProjectResources(projectId);
    
    // 在项目上下文中执行索引操作
    // ...
  }
  
  async search(query: string, projectId: string, options: any = {}): Promise<any[]> {
    // 获取项目专用资源
    const { vectorStorage, graphStorage } = await this.storageCoordinator.getProjectResources(projectId);
    
    // 在项目上下文中执行搜索操作
    // ...
  }
}
```

## 迁移策略

### 1. 渐进式迁移
支持新旧方案并存，逐步迁移现有数据：

1. **新项目**：直接使用新的物理隔离方案
2. **现有项目**：提供数据迁移工具，将数据从共享集合/空间迁移到项目专用资源

### 2. 数据迁移工具
开发专门的数据迁移工具，支持以下功能：

```typescript
class DataMigrationService {
  async migrateProjectData(oldProjectId: string, newProjectId: string): Promise<boolean> {
    // 从共享集合中提取项目数据
    // 将数据导入到项目专用集合中
    // 验证数据完整性
    // 更新元数据
    // 删除原集合中的项目数据（可选）
  }
  
  async migrateAllProjects(): Promise<void> {
    // 批量迁移所有项目数据
  }
}
```

### 3. 配置管理
提供配置选项控制迁移过程：

```yaml
multiProject:
  enabled: true
  migration:
    autoMigrate: false
    batchSize: 1000
    concurrency: 5
```

## 性能优化

### 1. 资源池化
为避免频繁创建和销毁数据库连接，实现资源池化：

```typescript
class ResourcePool {
  private vectorClients: Map<string, QdrantClient> = new Map();
  private graphClients: Map<string, NebulaClient> = new Map();
  
  async getVectorClient(projectId: string): Promise<QdrantClient> {
    if (!this.vectorClients.has(projectId)) {
      const client = new QdrantClient(/* 配置 */);
      this.vectorClients.set(projectId, client);
    }
    
    return this.vectorClients.get(projectId)!;
  }
}
```

### 2. 缓存机制
实现项目级别的缓存，提升访问性能：

```typescript
class ProjectCache {
  private projectCaches: Map<string, LRUCache> = new Map();
  
  async get(projectId: string, key: string): Promise<any> {
    if (!this.projectCaches.has(projectId)) {
      this.projectCaches.set(projectId, new LRUCache({ max: 100 }));
    }
    
    return this.projectCaches.get(projectId)!.get(key);
  }
}
```

## 安全性增强

### 1. 访问控制
实现项目级别的访问控制：

```typescript
class AccessControlService {
  async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    // 验证用户是否有访问该项目的权限
  }
  
  async enforceProjectAccess(userId: string, projectId: string): Promise<void> {
    const hasAccess = await this.checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw new UnauthorizedError('Access denied to project');
    }
  }
}
```

### 2. 数据加密
支持项目数据的加密存储：

```typescript
class EncryptionService {
  async encryptProjectData(projectId: string, data: any): Promise<string> {
    // 使用项目专用密钥加密数据
  }
  
  async decryptProjectData(projectId: string, encryptedData: string): Promise<any> {
    // 使用项目专用密钥解密数据
  }
}
```

## 监控和管理

### 1. 项目资源监控
实现项目级别的资源使用监控：

```typescript
class ProjectMonitoringService {
  async getProjectMetrics(projectId: string): Promise<ProjectMetrics> {
    return {
      vectorStorage: await this.getVectorStorageMetrics(projectId),
      graphStorage: await this.getGraphStorageMetrics(projectId),
      performance: await this.getPerformanceMetrics(projectId)
    };
  }
}
```

### 2. 管理接口
提供项目资源管理的 REST API：

```typescript
// 获取项目列表
GET /api/projects

// 获取项目详情
GET /api/projects/{projectId}

// 删除项目
DELETE /api/projects/{projectId}

// 备份项目
POST /api/projects/{projectId}/backup

// 恢复项目
POST /api/projects/{projectId}/restore
```

## 实施计划

### 阶段一：核心功能实现（2-3周）
1. 实现 Qdrant 集合隔离机制
2. 实现 Nebula Graph 空间隔离机制
3. 改造 StorageCoordinator 支持项目资源管理
4. 改造 IndexCoordinator 支持项目上下文

### 阶段二：迁移和兼容性（1-2周）
1. 开发数据迁移工具
2. 实现新旧方案兼容
3. 提供配置管理选项

### 阶段三：性能优化和安全增强（1-2周）
1. 实现资源池化
2. 实现缓存机制
3. 实现访问控制和数据加密

### 阶段四：监控和管理（1周）
1. 实现项目资源监控
2. 提供管理接口
3. 完善文档和测试

## 风险评估和缓解措施

### 1. 性能风险
**风险**：大量项目可能导致资源消耗过大
**缓解措施**：
- 实现资源池化和缓存机制
- 提供资源使用监控和告警
- 支持项目资源的动态伸缩

### 2. 数据一致性风险
**风险**：迁移过程中可能出现数据丢失或不一致
**缓解措施**：
- 实现数据校验机制
- 提供回滚功能
- 进行充分的测试验证

### 3. 兼容性风险
**风险**：新方案可能与现有功能不兼容
**缓解措施**：
- 提供新旧方案并存机制
- 进行充分的兼容性测试
- 提供详细的迁移文档

## 总结

本方案通过物理隔离的方式解决了当前项目隔离机制中存在的问题，提供了更好的性能、安全性和管理便利性。通过渐进式迁移策略，可以确保现有功能不受影响，同时逐步实现完整的多项目隔离支持。