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

其中 `projectId` 为项目路径的 SHA256 哈希值的前16位。

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

## 集合/空间管理策略

### 1. Qdrant 集合管理

#### 集合生命周期管理
为每个项目创建独立的 Qdrant 集合，并提供完整的生命周期管理：

```typescript
class QdrantCollectionManager {
  private client: QdrantClient;
  
  async createCollection(projectId: string, config: VectorConfig): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      await this.client.createCollection(collectionName, {
        vectors: {
          size: config.vectorSize,
          distance: config.distance
        }
      });
      return true;
    } catch (error) {
      // 集合可能已存在，检查是否存在
      const collections = await this.client.getCollections();
      return collections.collections.some(c => c.name === collectionName);
    }
  }
  
  async deleteCollection(projectId: string): Promise<boolean> {
    const collectionName = this.generateCollectionName(projectId);
    try {
      await this.client.deleteCollection(collectionName);
      return true;
    } catch (error) {
      console.error(`Failed to delete collection ${collectionName}:`, error);
      return false;
    }
  }
  
  async listCollections(): Promise<string[]> {
    const collections = await this.client.getCollections();
    return collections.collections.map(c => c.name);
  }
  
  async getCollectionInfo(projectId: string): Promise<CollectionInfo> {
    const collectionName = this.generateCollectionName(projectId);
    return await this.client.getCollection(collectionName);
  }
}
```

#### 集合状态监控
实现集合级别的监控指标：

```typescript
// 集合大小监控
qdrant_collection_size_bytes{collection="project-{projectId}", project_id="{projectId}"}

// 集合向量数量监控
qdrant_collection_vectors_count{collection="project-{projectId}", project_id="{projectId}"}

// 集合分片状态监控
qdrant_collection_shards_status{collection="project-{projectId}", project_id="{projectId}", status="active|inactive"}
```

### 2. Nebula Graph 空间管理

#### 空间生命周期管理
为每个项目创建独立的 Nebula Graph 空间，并提供完整的生命周期管理：

```typescript
class NebulaSpaceManager {
  private client: NebulaClient;
  
  async createSpace(projectId: string, config: GraphConfig): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // 创建空间
      await this.client.execute(`
        CREATE SPACE IF NOT EXISTS ${spaceName} (
          partition_num = ${config.partitionNum || 10},
          replica_factor = ${config.replicaFactor || 1},
          vid_type = ${config.vidType || 'FIXED_STRING(32)'}
        )
      `);
      
      // 等待空间创建完成
      await this.waitForSpaceReady(spaceName);
      
      // 使用空间
      await this.client.execute(`USE ${spaceName}`);
      
      // 创建图结构
      await this.createGraphSchema();
      
      return true;
    } catch (error) {
      console.error(`Failed to create space ${spaceName}:`, error);
      return false;
    }
  }
  
  async deleteSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      await this.client.execute(`DROP SPACE IF EXISTS ${spaceName}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete space ${spaceName}:`, error);
      return false;
    }
  }
  
  async listSpaces(): Promise<string[]> {
    const result = await this.client.execute('SHOW SPACES');
    return result.data.map(row => row[0]);
  }
  
  async getSpaceInfo(projectId: string): Promise<SpaceInfo> {
    const spaceName = this.generateSpaceName(projectId);
    const result = await this.client.execute(`DESCRIBE SPACE ${spaceName}`);
    return result.data[0];
  }
}
```

#### 空间状态监控
实现空间级别的监控指标：

```typescript
// 空间状态监控
nebula_space_status{space="project_{projectId}", project_id="{projectId}", status="active|inactive"}

// 空间分区状态监控
nebula_space_partitions_count{space="project_{projectId}", project_id="{projectId}", status="ok|error"}

// 空间数据量监控
nebula_space_data_size_bytes{space="project_{projectId}", project_id="{projectId}"}
```

## 项目映射和标识

### 1. 项目标识符管理

#### 项目ID生成和映射
实现统一的项目标识符管理机制：

```typescript
class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
  private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
  
  async generateProjectId(projectPath: string): Promise<string> {
    // 使用SHA256哈希生成项目ID
    const hash = await HashUtils.calculateDirectoryHash(projectPath);
    const projectId = hash.substring(0, 16);
    
    // 建立映射关系
    this.projectIdMap.set(projectPath, projectId);
    
    // 生成对应的集合和空间名称
    const collectionName = `project-${projectId}`;
    const spaceName = `project_${projectId}`;
    
    this.collectionMap.set(projectId, collectionName);
    this.spaceMap.set(projectId, spaceName);
    
    return projectId;
  }
  
  getProjectId(projectPath: string): string | undefined {
    return this.projectIdMap.get(projectPath);
  }
  
  getCollectionName(projectId: string): string | undefined {
    return this.collectionMap.get(projectId);
  }
  
  getSpaceName(projectId: string): string | undefined {
    return this.spaceMap.get(projectId);
  }
  
  // 持久化映射关系
 async saveMapping(): Promise<void> {
    const mapping = {
      projectIdMap: Object.fromEntries(this.projectIdMap),
      collectionMap: Object.fromEntries(this.collectionMap),
      spaceMap: Object.fromEntries(this.spaceMap)
    };
    
    await fs.writeFile('/data/project-mapping.json', JSON.stringify(mapping, null, 2));
  }
  
  // 加载映射关系
  async loadMapping(): Promise<void> {
    try {
      const data = await fs.readFile('/data/project-mapping.json', 'utf8');
      const mapping = JSON.parse(data);
      
      this.projectIdMap = new Map(Object.entries(mapping.projectIdMap));
      this.collectionMap = new Map(Object.entries(mapping.collectionMap));
      this.spaceMap = new Map(Object.entries(mapping.spaceMap));
    } catch (error) {
      console.warn('Failed to load project mapping:', error);
    }
  }
}
```

### 2. 反向查找机制

#### 通过集合/空间名称查找项目
实现从集合或空间名称反向查找对应项目的功能：

```typescript
class ProjectLookupService {
  private projectIdManager: ProjectIdManager;
  
  async getProjectIdByCollection(collectionName: string): Promise<string | null> {
    // 从集合名称解析项目ID
    if (collectionName.startsWith('project-')) {
      return collectionName.substring(8); // 移除 'project-' 前缀
    }
    return null;
  }
  
  async getProjectIdBySpace(spaceName: string): Promise<string | null> {
    // 从空间名称解析项目ID
    if (spaceName.startsWith('project_')) {
      return spaceName.substring(8); // 移除 'project_' 前缀
    }
    return null;
  }
  
  async getProjectPathByProjectId(projectId: string): Promise<string | null> {
    // 需要维护项目路径到项目ID的反向映射
    // 这可以通过扫描项目目录或查询数据库实现
    const mapping = await this.loadProjectPathMapping();
    return mapping.get(projectId) || null;
  }
  
  private async loadProjectPathMapping(): Promise<Map<string, string>> {
    // 从持久化存储加载项目路径映射
    // 实现细节取决于具体的存储方案
    return new Map();
  }
}
```

## 监控模块集成

### 1. Prometheus 集成

#### 动态监控目标发现
配置 Prometheus 动态发现和监控每个项目的集合和空间：

```yaml
# prometheus.yml
scrape_configs:
  # 现有的监控配置
  - job_name: 'qdrant'
    static_configs:
      - targets: ['qdrant:6333']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'nebula-graph'
    static_configs:
      - targets: ['graphd:9669']
    scrape_interval: 30s

  # 项目级别的监控配置（通过文件发现）
  - job_name: 'qdrant-projects'
    file_sd_configs:
      - files:
          - '/etc/prometheus/qdrant-projects.json'
    metrics_path: '/collections/*/points/count'  # 动态路径
    scrape_interval: 60s

 - job_name: 'nebula-projects'
    file_sd_configs:
      - files:
          - '/etc/prometheus/nebula-projects.json'
    scrape_interval: 60s
```

#### 项目监控指标生成
实现项目级别的监控指标生成服务：

```typescript
class ProjectMetricsExporter {
  private projectIdManager: ProjectIdManager;
  private qdrantClient: QdrantClient;
  private nebulaClient: NebulaClient;
  
  async collectMetrics(): Promise<void> {
    // 收集所有项目的指标
    const projects = await this.projectIdManager.listAllProjects();
    
    for (const projectId of projects) {
      // 收集 Qdrant 集合指标
      await this.collectQdrantMetrics(projectId);
      
      // 收集 Nebula Graph 空间指标
      await this.collectNebulaMetrics(projectId);
    }
  }
  
  private async collectQdrantMetrics(projectId: string): Promise<void> {
    try {
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) return;
      
      const collectionInfo = await this.qdrantClient.getCollection(collectionName);
      
      // 输出 Prometheus 格式的指标
      console.log(`qdrant_collection_size_bytes{collection="${collectionName}", project_id="${projectId}"} ${collectionInfo.size}`);
      console.log(`qdrant_collection_vectors_count{collection="${collectionName}", project_id="${projectId}"} ${collectionInfo.vectors_count}`);
    } catch (error) {
      console.error(`Failed to collect Qdrant metrics for project ${projectId}:`, error);
    }
  }
  
  private async collectNebulaMetrics(projectId: string): Promise<void> {
    try {
      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) return;
      
      await this.nebulaClient.execute(`USE ${spaceName}`);
      const result = await this.nebulaClient.execute('SHOW STATS');
      
      // 解析结果并输出指标
      // 实现细节取决于 Nebula Graph 的具体统计信息格式
    } catch (error) {
      console.error(`Failed to collect Nebula metrics for project ${projectId}:`, error);
    }
  }
}
```

### 2. Grafana 集成

#### 项目监控仪表板
创建支持项目筛选的 Grafana 仪表板：

```json
{
  "dashboard": {
    "id": null,
    "title": "Codebase Index - Multi-Project Monitoring",
    "tags": ["codebase-index", "multi-project", "monitoring"],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "templating": {
      "list": [
        {
          "name": "project",
          "type": "query",
          "datasource": "Prometheus",
          "label": "Project",
          "query": "label_values(qdrant_collection_size_bytes, project_id)",
          "refresh": 1,
          "sort": 1
        }
      ]
    },
    "panels": [
      {
        "id": 1,
        "type": "graph",
        "title": "Project Collection Size",
        "gridPos": {
          "x": 0,
          "y": 0,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "qdrant_collection_size_bytes{project_id=\"$project\"}",
            "legendFormat": "{{collection}}",
            "refId": "A"
          }
        ],
        "yaxes": [
          {
            "format": "bytes",
            "label": "Size"
          },
          {
            "format": "short"
          }
        ]
      },
      {
        "id": 2,
        "type": "graph",
        "title": "Project Vector Count",
        "gridPos": {
          "x": 12,
          "y": 0,
          "w": 12,
          "h": 6
        },
        "targets": [
          {
            "expr": "qdrant_collection_vectors_count{project_id=\"$project\"}",
            "legendFormat": "{{collection}}",
            "refId": "A"
          }
        ],
        "yaxes": [
          {
            "format": "short",
            "label": "Vectors"
          },
          {
            "format": "short"
          }
        ]
      }
    ]
  }
}
```

### 3. 告警规则更新

#### 项目级别的告警规则
更新告警规则以支持项目级别的监控：

```yaml
# alerts/codebase-index-alerts.yml
groups:
- name: codebase-index-project-alerts
  rules:
  # 项目集合大小告警
  - alert: ProjectCollectionTooLarge
    expr: qdrant_collection_size_bytes > 1073741824  # 1GB
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Project collection is too large"
      description: "Collection {{ $labels.collection }} for project {{ $labels.project_id }} is larger than 1GB."

  # 项目向量数量告警
  - alert: ProjectTooManyVectors
    expr: qdrant_collection_vectors_count > 10000000  # 10M vectors
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Project has too many vectors"
      description: "Collection {{ $labels.collection }} for project {{ $labels.project_id }} has more than 10M vectors."

  # 项目空间状态告警
  - alert: ProjectSpaceInactive
    expr: nebula_space_status{status="inactive"} == 1
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Project space is inactive"
      description: "Space {{ $labels.space }} for project {{ $labels.project_id }} is inactive."
```
本方案通过物理隔离的方式解决了当前项目隔离机制中存在的问题，提供了更好的性能、安全性和管理便利性。通过渐进式迁移策略，可以确保现有功能不受影响，同时逐步实现完整的多项目隔离支持。