# 图数据库从Neo4j迁移至NebulaGraph实施计划

## 1. 连接器模块迁移

### 1.1 配置管理
- 将`src/config/ConfigService.ts`中的Neo4j配置替换为NebulaGraph配置
- 更新环境变量配置，将NEO4J_*相关变量替换为NEBULA_*变量
- 修改配置验证逻辑，适配NebulaGraph的连接参数

### 1.2 连接管理
- 替换`src/database/neo4j/Neo4jConnectionManager.ts`为NebulaGraph连接管理器
- 实现NebulaGraph的连接池管理
- 实现会话管理机制
- 实现连接健康检查和重试机制

### 1.3 服务接口
- 替换`src/database/Neo4jService.ts`为NebulaGraph服务
- 保持现有的服务接口方法签名，确保对上层调用透明
- 实现节点和关系的创建、查询、更新、删除操作
- 实现事务管理接口

## 2. 数据访问层迁移

### 2.1 查询语言适配
- 将Cypher查询语句转换为nGQL查询语句
- 更新查询构建器，适配nGQL语法
- 实现参数化查询支持

### 2.2 数据模型映射
- 映射Neo4j的标签(label)到NebulaGraph的标签(tag)
- 映射Neo4j的关系(type)到NebulaGraph的边类型(edge type)
- 实现数据类型转换，特别是处理Neo4j的复杂数据类型

## 3. 测试模块更新

### 3.1 单元测试
- 更新`src/database/test/neo4j/Neo4jConnectionManager.test.ts`为NebulaGraph连接管理器测试
- 更新`src/database/test/neo4j/Neo4jService.test.ts`为NebulaGraph服务测试
- 更新集成测试`src/database/test/neo4j/Neo4jIntegration.test.ts`

### 3.2 测试环境
- 更新`src/database/test/neo4j/setup-test-database.ps1`为NebulaGraph测试环境搭建脚本
- 更新`src/database/test/neo4j/drop-test-database.ps1`为NebulaGraph测试环境清理脚本

## 4. 部署配置更新

### 4.1 Docker配置
- 更新`docs/docker/neo4j.md`为NebulaGraph部署指南
- 更新docker-compose配置文件，替换Neo4j服务为NebulaGraph服务
- 更新环境变量配置

### 4.2 系统集成
- 更新系统架构文档，反映NebulaGraph的集成
- 更新监控和日志配置，适配NebulaGraph的监控指标