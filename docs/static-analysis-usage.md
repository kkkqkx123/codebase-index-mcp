# 静态分析功能使用指南

## 概述

本项目集成了Semgrep静态代码分析工具，提供自动化的安全漏洞检测、代码质量分析和自定义规则管理功能。

## 功能特性

- **自动扫描**: 支持文件变更触发和项目索引完成触发
- **多语言支持**: JavaScript、TypeScript、Python、Java、Go、PHP、Ruby、C#
- **规则管理**: 内置安全规则 + 自定义规则支持
- **结果存储**: 图数据库(Nebula) + 向量数据库(Qdrant)双重存储
- **REST API**: 完整的API接口用于扫描控制和结果查询
- **实时搜索**: 基于向量的语义搜索功能

## 快速开始

### 1. 启动服务

```bash
# 启动主服务
npm run dev

# 或生产环境
npm start
```

### 2. 检查Semgrep安装

```bash
# 检查Semgrep是否可用
semgrep --version

# 如果未安装，使用以下命令安装
pip install semgrep
```

### 3. 基本使用

#### 扫描项目

```bash
curl -X POST http://localhost:3000/api/v1/analysis/scan \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "./src",
    "options": {
      "includeTests": false,
      "severity": ["high", "critical"],
      "maxFindings": 100
    }
  }'
```

#### 获取扫描结果

```bash
# 获取扫描状态
curl http://localhost:3000/api/v1/analysis/scan/{scanId}/status

# 获取扫描结果
curl http://localhost:3000/api/v1/analysis/scan/{scanId}/results
```

#### 搜索发现

```bash
curl -X POST http://localhost:3000/api/v1/analysis/findings/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SQL injection",
    "severity": ["high", "critical"],
    "limit": 10
  }'
```

## API 端点

### 扫描管理

- `POST /api/v1/analysis/scan` - 启动项目扫描
- `GET /api/v1/analysis/scan/:id/status` - 获取扫描状态
- `GET /api/v1/analysis/scan/:id/results` - 获取扫描结果
- `GET /api/v1/analysis/scan/:id/history` - 获取项目扫描历史

### 规则管理

- `GET /api/v1/analysis/rules` - 获取可用规则
- `POST /api/v1/analysis/rules` - 添加自定义规则
- `POST /api/v1/analysis/rules/validate` - 验证规则
- `DELETE /api/v1/analysis/rules/:id` - 删除规则

### 发现管理

- `GET /api/v1/analysis/findings` - 获取所有发现
- `POST /api/v1/analysis/findings/search` - 搜索发现
- `GET /api/v1/analysis/findings/:id` - 获取特定发现详情
- `POST /api/v1/analysis/findings/group` - 分组发现

### 系统状态

- `GET /api/v1/analysis/status` - 获取系统状态
- `GET /api/v1/analysis/health` - 健康检查

## 配置说明

配置文件位置: `config/static-analysis.json`

### Semgrep配置

```json
{
  "semgrep": {
    "binaryPath": "semgrep",
    "timeout": 30000,
    "configPaths": ["auto", "p/security-audit", "p/secrets"],
    "excludePatterns": ["node_modules", ".git", "dist"],
    "includePatterns": ["*.js", "*.ts", "*.py"]
  }
}
```

### 规则配置

#### 内置规则
- `p/security-audit` - 安全审计规则
- `p/secrets` - 密钥泄露检测
- `p/owasp-top-ten` - OWASP Top 10
- `p/javascript` - JavaScript专用规则
- `p/python` - Python专用规则

#### 自定义规则

创建文件: `config/semgrep-rules/custom-rule.yaml`

```yaml
rules:
  - id: custom-no-console-log
    pattern: console.log(...)
    message: "Avoid using console.log in production code"
    languages: [javascript, typescript]
    severity: WARNING
```

## 使用示例

### 1. 扫描TypeScript项目

```javascript
const axios = require('axios');

async function scanTypeScriptProject() {
  const response = await axios.post('http://localhost:3000/api/v1/analysis/scan', {
    projectPath: './src',
    options: {
      rules: ['typescript'],
      severity: ['high', 'medium'],
      includeTests: false
    }
  });
  
  console.log('Scan ID:', response.data.scanId);
  return response.data.scanId;
}
```

### 2. 创建自定义规则

```javascript
const customRule = {
  id: 'no-eval-usage',
  name: 'No eval() usage',
  description: 'Prohibit usage of eval() for security reasons',
  severity: 'high',
  language: 'javascript',
  pattern: 'eval(...)',
  metadata: {
    category: 'security',
    cwe: 'CWE-95'
  }
};

const response = await axios.post('http://localhost:3000/api/v1/analysis/rules', {
  rule: customRule
});
```

### 3. 搜索特定类型的漏洞

```javascript
const searchResponse = await axios.post('http://localhost:3000/api/v1/analysis/findings/search', {
  query: 'SQL injection vulnerability',
  severity: ['critical', 'high'],
  fileTypes: ['.js', '.ts'],
  limit: 50
});
```

## 集成开发工作流

### 1. 文件变更自动扫描

当文件保存时，系统会自动触发增量扫描：

```json
{
  "analysis": {
    "autoScanOnFileChange": true,
    "batchSize": 50
  }
}
```

### 2. Git Hook集成

在 `.husky/pre-commit` 中添加：

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 扫描提交的文件
npx semgrep --config=auto --error --json $(git diff --cached --name-only)
```

### 3. CI/CD集成

GitHub Actions示例:

```yaml
name: Static Analysis
on: [push, pull_request]
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Semgrep
        run: |
          curl -X POST "${{ secrets.ANALYSIS_API_URL }}/scan" \
            -H "Authorization: Bearer ${{ secrets.ANALYSIS_TOKEN }}" \
            -d '{"projectPath": "."}'
```

## 性能优化

### 1. 并行扫描

```json
{
  "semgrep": {
    "jobs": 4,
    "maxConcurrentScans": 3
  }
}
```

### 2. 缓存配置

```json
{
  "semgrep": {
    "cacheEnabled": true,
    "cacheTtl": 3600
  }
}
```

### 3. 排除大文件

```json
{
  "semgrep": {
    "excludePatterns": [
      "*.min.js",
      "*.bundle.js",
      "vendor/**",
      "node_modules/**"
    ],
    "maxTargetBytes": 1000000
  }
}
```

## 故障排除

### 常见问题

1. **Semgrep未找到**
   ```bash
   # Windows
   pip install semgrep
   
   # macOS/Linux
   brew install semgrep
   ```

2. **扫描超时**
   - 增加timeout配置
   - 排除大文件
   - 减少并发任务

3. **内存不足**
   - 减少maxMemory配置
   - 分批扫描大项目

### 日志调试

```bash
# 查看详细日志
DEBUG=semgrep:* npm start

# 查看API日志
tail -f logs/api.log
```

## 扩展开发

### 1. 添加新的分析工具

实现 `IAnalysisTool` 接口：

```typescript
interface IAnalysisTool {
  scan(projectPath: string, options: ScanOptions): Promise<ScanResult>;
  validateConfig(): Promise<boolean>;
  getAvailableRules(): Promise<SecurityRule[]>;
}
```

### 2. 自定义结果处理器

扩展 `ResultProcessor` 类：

```typescript
class CustomResultProcessor extends ResultProcessor {
  async processResult(rawResult: any): Promise<ProcessedResult> {
    // 自定义处理逻辑
  }
}
```

### 3. 集成通知系统

```javascript
// 扫描完成通知
const onScanComplete = async (scanId, results) => {
  if (results.findings.length > 0) {
    await sendNotification({
      type: 'security_alert',
      findings: results.findings
    });
  }
};
```

## 监控指标

- **扫描成功率**: 成功扫描/总扫描次数
- **平均扫描时间**: 每次扫描耗时
- **发现密度**: 每千行代码的发现数
- **规则覆盖率**: 启用的规则/总规则数
- **误报率**: 误报/总发现数

## 安全最佳实践

1. **规则验证**: 所有自定义规则必须通过验证
2. **权限控制**: API访问需要身份验证
3. **敏感信息**: 扫描结果中过滤敏感信息
4. **定期更新**: 保持规则和工具版本最新
5. **审计日志**: 记录所有扫描和规则变更操作