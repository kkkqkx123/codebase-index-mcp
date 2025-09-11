# 内存优化指南

## 问题描述

当系统可用内存不足时，索引创建可能会失败，错误日志显示：
```
Step 'memory-check' failed after 2 attempts: Insufficient memory for indexing operation
```

## 解决方案

### 1. 环境变量配置

使用内存优化的环境变量：

```bash
# 复制内存优化配置
cp .env.memory-optimized .env

# 或者手动设置环境变量
export MEMORY_THRESHOLD=85
export BATCH_MEMORY_THRESHOLD=85
export MAX_MEMORY_MB=1024
export INDEX_BATCH_SIZE=25
export CHUNK_SIZE=500
```

### 2. 启动选项

使用内存优化的启动命令：

```bash
# 开发环境
npm run dev:memory

# 生产环境
npm run start:memory

# 完全内存优化模式
npm run start:memory-optimized
```

### 3. 手动调整内存限制

```bash
# 增加 Node.js 内存限制
node --max-old-space-size=4096 dist/main.js

# 使用 dotenv 和内存限制
dotenv -e .env.memory-optimized node --max-old-space-size=2048 dist/main.js
```

### 4. 配置参数说明

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MEMORY_THRESHOLD` | 75 | 内存检查阈值（百分比） |
| `BATCH_MEMORY_THRESHOLD` | 75 | 批处理内存阈值 |
| `MAX_MEMORY_MB` | 1024 | 最大内存限制（MB） |
| `INDEX_BATCH_SIZE` | 25 | 索引批处理大小 |
| `CHUNK_SIZE` | 500 | 文本块大小 |
| `OVERLAP_SIZE` | 100 | 文本重叠大小 |
| `MAX_FILE_SIZE` | 5242880 | 最大文件大小（字节） |

### 5. 系统级优化

#### Windows
```powershell
# 检查可用内存
Get-ComputerInfo | Select-Object WindowsTotalVisibleMemorySize,WindowsFreePhysicalMemory

# 增加虚拟内存（如果需要）
# 控制面板 -> 系统 -> 高级系统设置 -> 性能设置 -> 高级 -> 虚拟内存
```

#### Linux/macOS
```bash
# 检查可用内存
free -h

# 检查交换空间
swapon -s

# 增加交换空间（如果需要）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 6. 监控内存使用

```bash
# 实时监控内存使用
npm run dev:memory

# 查看日志中的内存状态
tail -f logs/combined.log | grep memory
```

### 7. 故障排除

如果仍然遇到内存问题：

1. **减少批处理大小**：
   ```bash
   export INDEX_BATCH_SIZE=10
   export CHUNK_SIZE=250
   ```

2. **降低文件大小限制**：
   ```bash
   export MAX_FILE_SIZE=2621440  # 2.5MB
   ```

3. **使用更小的嵌入模型**：
   ```bash
   export EMBEDDING_PROVIDER=ollama
   export OLLAMA_MODEL=nomic-embed-text
   export OLLAMA_DIMENSIONS=768
   ```

4. **禁用非必要功能**：
   ```bash
   export SEMGREP_ENABLED=false
   export MONITORING_ENABLED=false
   ```

### 8. 性能权衡

内存优化可能会影响处理速度，建议根据系统配置选择合适的参数：

| 系统内存 | 推荐配置 |
|----------|----------|
| 4GB | INDEX_BATCH_SIZE=10, CHUNK_SIZE=250 |
| 8GB | INDEX_BATCH_SIZE=25, CHUNK_SIZE=500 |
| 16GB+ | INDEX_BATCH_SIZE=50, CHUNK_SIZE=1000 |

## 验证修复

运行以下命令验证内存优化是否生效：

```bash
# 使用内存优化配置启动
npm run start:memory-optimized

# 测试小项目索引
curl -X POST http://localhost:3000/api/index \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"./test/mock-folder/project1"}'
```

如果索引成功完成且没有内存错误，说明优化生效。