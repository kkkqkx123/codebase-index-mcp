# 集成测试依赖服务文档

## 概述

`snippet-storage-retrieval.test.ts` 是一个综合性的集成测试，它依赖于多个外部服务。本文档详细说明了所有必需的服务、配置要求以及启动步骤。

## 必需的外部服务

### 1. Qdrant - 向量数据库
**作用**: 存储代码片段的向量嵌入，支持语义搜索
**版本**: v1.15.1+ (使用 `@qdrant/js-client-rest`)
**端口**: 6333 (HTTP API), 6334 (gRPC)
**配置要求**:
- 集合名称: `code-snippets` (可在 .env 中配置)
- 向量维度: 根据嵌入模型配置 (1024维用于 BAAI/bge-m3)

**启动命令**:
```bash
# 快速启动
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest
```

### 2. NebulaGraph - 图数据库
**作用**: 存储代码片段之间的关系、依赖关系、引用关系等图结构数据
**版本**: v3.8.0
**端口**: 9669 (Graph服务), 9559 (Meta服务), 9779 (Storage服务)
**配置要求**:
- 用户名: root (默认)
- 密码: nebula (默认)
- 图空间: codebase_index

**完整部署** (需要多个服务):
```bash
# 使用提供的docker-compose配置
cd docs/docker/nebula
docker-compose -f docker-compose..yml up -d

# 等待服务启动完成 (约1-2分钟)
docker-compose -f docker-compose..yml ps
```

### 3. 嵌入模型服务
测试需要配置以下之一:

#### 选项A: SiliconFlow (推荐)
- **模型**: BAAI/bge-m3
- **维度**: 1024
- **配置**:
  ```env
  EMBEDDING_PROVIDER=siliconflow
  SILICONFLOW_API_KEY=your-api-key
  SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
  SILICONFLOW_MODEL=BAAI/bge-m3
  SILICONFLOW_DIMENSIONS=1024
  ```

#### 选项B: OpenAI
- **模型**: text-embedding-ada-002
- **维度**: 1536
- **配置**:
  ```env
  EMBEDDING_PROVIDER=openai
  OPENAI_API_KEY=your-openai-key
  OPENAI_BASE_URL=https://api.openai.com
  OPENAI_MODEL=text-embedding-ada-002
  OPENAI_DIMENSIONS=1536
  ```

#### 选项C: Ollama (本地)
- **模型**: nomic-embed-text
- **维度**: 768
- **配置**:
  ```env
  EMBEDDING_PROVIDER=ollama
  OLLAMA_BASE_URL=http://localhost:11434
  OLLAMA_MODEL=nomic-embed-text
  OLLAMA_DIMENSIONS=768
  ```

### 4. 监控服务 (可选但推荐)
**Prometheus**: 指标收集
**Grafana**: 可视化监控
**AlertManager**: 告警管理

```bash
cd docs/docker/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## 环境配置步骤

### 1. 创建环境文件
```bash
cp .env.example .env
```

### 2. 配置必要的环境变量
编辑 `.env` 文件，确保以下配置:

```env
# 数据库配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=code-snippets

NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_SPACE=codebase_index

# 嵌入服务配置
EMBEDDING_PROVIDER=siliconflow
SILICONFLOW_API_KEY=your-actual-key-here

# 日志配置
LOG_LEVEL=debug
LOG_FORMAT=json
```

### 3. 验证服务状态

#### 检查Qdrant
```bash
curl http://localhost:6333/
```

#### 检查NebulaGraph
```bash
# 使用Nebula Console
docker run --rm -it --network host vesoft/nebula-console:v3.8.0 -addr localhost -port 9669 -u root -p nebula -e "SHOW HOSTS;"
```

#### 检查嵌入服务
```bash
# 测试SiliconFlow
curl https://api.siliconflow.cn/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 常见测试失败原因及解决方案

### 1. 连接失败
**症状**: `ECONNREFUSED` 或连接超时错误
**解决方案**:
- 确保所有服务都已启动
- 检查端口是否被占用
- 验证防火墙设置

### 2. 认证失败
**症状**: 401/403 错误或嵌入模型访问被拒绝
**解决方案**:
- 检查API密钥是否正确
- 确认账户是否有足够的配额
- 验证API密钥是否有访问相应模型的权限

### 3. 数据库初始化问题
**症状**: 表/集合不存在或权限错误
**解决方案**:
- 等待NebulaGraph完全启动 (约1-2分钟)
- 手动创建必要的图空间:
  ```bash
  docker run --rm -it --network host vesoft/nebula-console:v3.8.0 -addr localhost -port 9669 -u root -p nebula
  
  # 在console中执行:
  CREATE SPACE IF NOT EXISTS codebase_index(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256));
  USE codebase_index;
  ```

### 4. 嵌入维度不匹配
**症状**: 向量维度错误
**解决方案**:
- 确保Qdrant集合的维度与嵌入模型匹配
- 删除并重新创建集合:
  ```bash
  curl -X DELETE http://localhost:6333/collections/code-snippets
  ```

## 一键启动脚本

创建 `start-test-services.sh`:

```bash
#!/bin/bash

echo "启动集成测试所需服务..."

# 启动Qdrant
echo "启动 Qdrant..."
docker run -d --name qdrant-test \
  -p 6333:6333 \
  -p 6334:6334 \
  -v qdrant_test_storage:/qdrant/storage \
  qdrant/qdrant:latest

# 启动NebulaGraph
echo "启动 NebulaGraph..."
cd docs/docker/nebula
docker-compose -f docker-compose..yml up -d

echo "等待服务启动..."
sleep 30

# 验证服务状态
echo "验证服务状态..."
curl -s http://localhost:6333/ > /dev/null && echo "✓ Qdrant 运行正常" || echo "✗ Qdrant 未启动"

# 检查NebulaGraph
docker run --rm --network host vesoft/nebula-console:v3.8.0 \
  -addr localhost -port 9669 -u root -p nebula \
  -e "SHOW HOSTS;" > /dev/null 2>&1 \
  && echo "✓ NebulaGraph 运行正常" \
  || echo "✗ NebulaGraph 未启动"

echo "服务启动完成！"
```

## 测试运行

### 运行单个测试
```bash
npm test -- snippet-storage-retrieval.test.ts
```

### 运行所有集成测试
```bash
npm run test:integration
```

### 调试模式
```bash
LOG_LEVEL=debug npm test -- snippet-storage-retrieval.test.ts
```

## 清理环境

```bash
# 停止并清理测试服务
docker stop qdrant-test
docker rm qdrant-test
docker volume rm qdrant_test_storage

cd docs/docker/nebula
docker-compose -f docker-compose..yml down
```

## 故障排除

### 查看日志
```bash
# Qdrant日志
docker logs qdrant-test

# NebulaGraph日志
cd docs/docker/nebula
docker-compose -f docker-compose..yml logs
```

### 性能优化
- 对于大量测试，建议使用SSD存储
- 增加Docker内存限制 (至少4GB)
- 使用本地嵌入模型减少网络延迟

### 网络问题
- 确保Docker网络配置正确
- 检查主机防火墙设置
- 验证端口映射是否生效