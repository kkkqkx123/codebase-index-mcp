**已合并到其他文档中**

# 代码库结构分析 - 调用关系图功能架构设计

## 🎯 功能概述

为Kode项目新增代码调用关系图功能，通过静态代码分析提取函数/方法、变量、类等的调用关系，构建图结构并存储到Neo4j图数据库。

## 🏗️ 架构设计

### 核心组件

#### 1. 代码解析器 (Code Parser)
- **职责**: 解析源代码文件，提取代码实体和调用关系
- **技术选择**: TypeScript AST解析器（如ts-morph）
- **输出**: 代码实体节点和关系边

#### 2. 图构建器 (Graph Builder) 
- **职责**: 将解析结果转换为图结构数据
- **功能**: 实体去重、关系规范化、图结构优化
- **输出**: Neo4j兼容的Cypher查询语句

#### 3. Neo4j连接器 (Neo4j Connector)
- **职责**: 管理与Neo4j数据库的连接和数据操作
- **技术选择**: Neo4j JavaScript官方驱动
- **功能**: 批量导入、查询优化、连接池管理

#### 4. 查询服务 (Query Service)
- **职责**: 提供图结构查询接口
- **功能**: 路径查询、关系分析、可视化数据导出

### 数据模型

#### 节点类型 (Node Labels)
- `Function` - 函数/方法
- `Class` - 类/接口  
- `Variable` - 变量/常量
- `File` - 源代码文件
- `Module` - 模块/包

#### 关系类型 (Relationship Types)
- `CALLS` - 函数调用关系
- `EXTENDS` - 类继承关系
- `IMPLEMENTS` - 接口实现关系  
- `REFERENCES` - 变量引用关系
- `CONTAINS` - 文件包含关系

### 技术栈

| 组件 | 技术选择 | 版本 |
|------|----------|------|
| 图数据库 | Neo4j | 5.x (Docker部署) |
| 数据库驱动 | neo4j-driver | 5.x |
| AST解析 | ts-morph | 最新版 |
| 语言支持 | TypeScript/JavaScript | 原生支持 |

## 🔄 工作流程

### 1. 代码分析阶段
```
源代码文件 → AST解析 → 实体提取 → 关系识别 → 图数据生成
```

### 2. 数据存储阶段  
```
图数据 → Cypher查询生成 → 批量导入Neo4j → 索引构建
```

### 3. 查询服务阶段
```
用户查询 → Cypher查询执行 → 结果处理 → 可视化输出
```

## 📊 集成方案

### 与现有架构集成

#### 服务层扩展
```typescript
// 新增服务模块
src/services/graph/
├── neo4j.ts          # Neo4j连接管理
├── parser.ts         # 代码解析器
├── builder.ts        # 图构建器
└── query.ts         # 查询服务
```

#### 命令行集成
```typescript
// 新增命令
src/commands/graph.ts
- graph:analyze      # 分析代码库并构建图
- graph:query        # 执行图查询
- graph:visualize    # 生成可视化数据
```

### 环境依赖

#### 新增依赖
```json
{
  "dependencies": {
    "neo4j-driver": "^5.0.0",
    "ts-morph": "^20.0.0"
  }
}
```

#### Docker配置
```yaml
# docker-compose.graph.yml
services:
  neo4j:
    image: neo4j:5.0
    ports:
      - "7474:7474"  # Browser UI
      - "7687:7687"  # Bolt protocol
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
```

## 🚀 核心特性

### 静态分析能力
- 函数/方法调用链分析
- 类继承关系追踪  
- 变量引用关系映射
- 跨文件依赖分析

### 查询功能
- 最短调用路径查找
- 影响范围分析
- 依赖关系可视化
- 代码变更影响评估

### 性能优化
- 增量更新机制
- 批量导入优化
- 查询缓存策略
- 内存使用控制

## 📈 扩展性考虑

### 多语言支持
- 初始支持 TypeScript/JavaScript
- 可扩展支持 Python、Java等其他语言

### 分布式处理
- 支持大型代码库的分布式分析
- 多线程/多进程解析优化

### 实时更新
- 文件变更监听和自动更新
- Git集成和变更追踪

## 🔗 与向量搜索集成

### 数据关联
- 图节点与向量存储文档关联
- 联合查询支持（图关系 + 语义搜索）

### 增强搜索
- 基于调用关系的语义搜索增强
- 上下文感知的代码推荐

---

*最后更新: 2024-12-20*  
*版本: v1.0.0*  
*状态: 架构设计完成*

**下一步**: 详细技术调研和依赖分析