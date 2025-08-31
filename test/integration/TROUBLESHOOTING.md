# 集成测试故障排除指南

## 快速诊断

运行诊断脚本：
```powershell
.\start-services.ps1 -CleanStart -WaitTime 30
```

## 常见错误及解决方案

### 1. 连接错误

#### ❌ ECONNREFUSED 127.0.0.1:6333
**症状**: 无法连接到Qdrant
**原因**: Qdrant服务未启动或端口错误
**解决方案**:
```powershell
# 检查Qdrant状态
docker ps | findstr qdrant

# 重启Qdrant
docker stop qdrant-test
docker rm qdrant-test
.\start-services.ps1 -SkipNebula -SkipMonitoring
```

#### ❌ ECONNREFUSED 127.0.0.1:9669
**症状**: 无法连接到NebulaGraph
**原因**: NebulaGraph服务未完全启动
**解决方案**:
```powershell
# 检查NebulaGraph状态
cd docs\docker\nebula
docker-compose -f docker-compose..yml ps

# 查看日志
docker-compose -f docker-compose..yml logs

# 重启服务
docker-compose -f docker-compose..yml restart
```

### 2. 认证错误

#### ❌ 401 Unauthorized (嵌入服务)
**症状**: API密钥无效
**解决方案**:
1. 检查 `.env.test` 文件中的API密钥
2. 验证密钥是否有效：
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" https://api.siliconflow.cn/v1/models
   ```
3. 检查账户余额和配额

#### ❌ NebulaGraph认证失败
**症状**: 用户名/密码错误
**解决方案**:
```bash
# 使用默认凭据登录测试
docker run --rm --network host vesoft/nebula-console:v3.8.0 \
  -addr localhost -port 9669 -u root -p nebula \
  -e "SHOW HOSTS;"
```

### 3. 数据库初始化问题

#### ❌ Collection not found
**症状**: Qdrant集合不存在
**解决方案**:
```bash
# 手动创建集合
curl -X PUT "http://localhost:6333/collections/code-snippets" \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

#### ❌ Space not found
**症状**: NebulaGraph空间不存在
**解决方案**:
```bash
# 创建图空间
docker run --rm --network host vesoft/nebula-console:v3.8.0 \
  -addr localhost -port 9669 -u root -p nebula \
  -e "CREATE SPACE IF NOT EXISTS codebase_index(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(256)); USE codebase_index;"
```

### 4. 维度不匹配错误

#### ❌ Vector dimension mismatch
**症状**: 向量维度与配置不符
**解决方案**:
1. 检查嵌入模型输出的维度
2. 重新创建Qdrant集合：
   ```bash
   curl -X DELETE "http://localhost:6333/collections/code-snippets"
   ```
3. 重新运行测试，系统会自动创建正确维度的集合

### 5. 内存不足

#### ❌ JavaScript heap out of memory
**症状**: Node.js内存不足
**解决方案**:
```powershell
# 增加Node.js内存限制
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm test -- snippet-storage-retrieval.test.ts
```

### 6. 端口冲突

#### ❌ Port already in use
**症状**: 端口被其他进程占用
**解决方案**:
```powershell
# 检查端口占用
netstat -ano | findstr :6333
netstat -ano | findstr :9669

# 停止占用端口的进程
taskkill /PID <进程ID> /F

# 或使用不同端口并修改.env.test
```

## 性能调优

### 1. Docker资源限制
```powershell
# 检查Docker设置
# 建议配置：
# - CPUs: 4+
# - Memory: 4GB+
# - Swap: 1GB
```

### 2. 测试运行优化
```powershell
# 只运行特定测试
npm test -- snippet-storage-retrieval.test.ts -t "should create index"

# 增加超时时间
npm test -- snippet-storage-retrieval.test.ts --testTimeout=60000
```

## 日志收集

### 1. 收集所有日志
```powershell
# 创建日志目录
mkdir logs

# Qdrant日志
docker logs qdrant-test > logs/qdrant.log 2>&1

# NebulaGraph日志
cd docs\docker\nebula
docker-compose -f docker-compose..yml logs > ..\..\..\logs\nebula.log 2>&1
```

### 2. 调试模式运行
```powershell
$env:LOG_LEVEL="debug"
$env:DEBUG="*"
npm test -- snippet-storage-retrieval.test.ts 2>&1 | Tee-Object logs/test-debug.log
```

## 网络诊断

### 1. 检查网络连通性
```powershell
# 测试Qdrant
Test-NetConnection -ComputerName localhost -Port 6333

# 测试NebulaGraph
Test-NetConnection -ComputerName localhost -Port 9669
```

### 2. 容器网络检查
```powershell
# 检查容器网络
docker network ls
docker inspect bridge
```

## 重置环境

### 完全重置
```powershell
# 停止所有容器
docker stop $(docker ps -q)

# 移除测试容器
docker rm qdrant-test
cd docs\docker\nebula
docker-compose -f docker-compose..yml down -v

# 清理数据卷
docker volume prune -f

# 重新启动
.\start-services.ps1 -CleanStart
```

## 测试验证

### 快速验证脚本
创建 `validate-environment.ps1`:

```powershell
Write-Host "=== 环境验证 ===" -ForegroundColor Green

# 验证环境文件
if (Test-Path ".env.test") {
    Write-Host "✅ .env.test 文件存在" -ForegroundColor Green
} else {
    Write-Host "❌ .env.test 文件不存在" -ForegroundColor Red
    exit 1
}

# 验证服务
$services = @(
    @{Name="Qdrant"; Url="http://localhost:6333/"; Type="http"},
    @{Name="NebulaGraph"; Command="docker run --rm --network host vesoft/nebula-console:v3.8.0 -addr localhost -port 9669 -u root -p nebula -e 'SHOW HOSTS;'"; Type="docker"}
)

foreach ($service in $services) {
    Write-Host "检查 $($service.Name)..." -ForegroundColor Cyan
    
    if ($service.Type -eq "http") {
        try {
            $response = Invoke-RestMethod -Uri $service.Url -TimeoutSec 5
            Write-Host "✅ $($service.Name): 运行正常" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ $($service.Name): 连接失败" -ForegroundColor Red
        }
    }
    elseif ($service.Type -eq "docker") {
        $result = Invoke-Expression $service.Command
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $($service.Name): 运行正常" -ForegroundColor Green
        }
        else {
            Write-Host "❌ $($service.Name): 连接失败" -ForegroundColor Red
        }
    }
}

Write-Host "验证完成！" -ForegroundColor Green
```

## 获取帮助

### 1. 查看详细日志
```powershell
# 运行测试并收集日志
npm test -- snippet-storage-retrieval.test.ts --verbose 2>&1 | Tee-Object logs/full-test.log
```

### 2. 提交问题
当遇到无法解决的问题时：
1. 收集所有相关日志
2. 记录错误信息和重现步骤
3. 包含环境信息：
   ```powershell
   docker --version
   node --version
   npm --version
   $PSVersionTable.PSVersion
   ```