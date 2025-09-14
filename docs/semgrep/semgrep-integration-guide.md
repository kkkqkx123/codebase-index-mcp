# Semgrep 集成使用指南

## 概述

本文档说明如何在项目中使用已集成的 Semgrep 静态分析服务。

## 快速开始

### 1. 安装依赖

```bash
npm install --save-dev semgrep
```

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
SEMGREP_ENABLED=true
SEMGREP_CLI_PATH=semgrep
SEMGREP_RULES_DIR=./config/semgrep-rules
SEMGREP_TIMEOUT=300
SEMGREP_MAX_CONCURRENT_SCANS=5
```

### 3. 启动服务

```bash
npm start
```

## 使用方式

### 命令行扫描

```bash
# 扫描整个项目
npx semgrep scan --config=./config/semgrep-rules/javascript-security.yaml src/

# 扫描特定文件
npx semgrep scan --config=./config/semgrep-rules/python-security.yaml src/**/*.py
```

### API 调用

```typescript
import { StaticAnalysisServiceFactory } from './src/services/static-analysis';

// 创建协调器实例
const coordinator = StaticAnalysisServiceFactory.createCoordinator(
  logger,
  configService,
  nebulaService,
  qdrantService
);

// 执行扫描
const results = await coordinator.scanProject('/path/to/project', {
  rules: ['javascript-security.yaml', 'python-security.yaml'],
  severity: ['ERROR', 'WARNING'],
  exclude: ['node_modules/**', '*.test.js']
});
```

### 自定义规则

创建自定义规则文件：

```yaml
# config/semgrep-rules/custom-rule.yaml
rules:
  - id: custom-no-console-log
    message: Do not use console.log in production code
    severity: WARNING
    languages:
      - javascript
      - typescript
    pattern: console.log(...)
```

## 规则说明

### 已提供的规则

- **javascript-security.yaml**: JavaScript/TypeScript 安全规则
- **python-security.yaml**: Python 安全规则

### 规则分类

- **ERROR**: 高危漏洞（如 SQL 注入、XSS）
- **WARNING**: 潜在风险（如不安全反序列化、弱加密）
- **INFO**: 代码质量问题

## 集成特性

### 1. 自动触发扫描

- 文件变更时自动扫描
- 项目索引完成后批量扫描

### 2. 结果融合

- 与图数据库集成（NebulaGraph）
- 与向量搜索集成（Qdrant）
- 生成增强分析报告

### 3. 历史追踪

- 保存扫描历史记录
- 支持按时间、严重性过滤
- 趋势分析报告

## 配置选项

### 全局配置

```json
{
  "staticAnalysis": {
    "enabled": true,
    "scanOnChange": true,
    "batchSize": 50,
    "resultRetentionDays": 30
  }
}
```

### 规则配置

```json
{
  "semgrep": {
    "timeout": 300,
    "maxTargetBytes": 1000000,
    "maxConcurrentScans": 5,
    "cacheEnabled": true
  }
}
```

## 故障排除

### 常见问题

1. **Semgrep 未找到**
   - 确保已安装：`npm install --save-dev semgrep`
   - 检查 CLI 路径配置

2. **规则加载失败**
   - 检查规则文件路径是否正确
   - 验证 YAML 语法

3. **扫描超时**
   - 增加 timeout 配置值
   - 减少并发扫描数量

### 调试模式

```bash
LOG_LEVEL=debug npm start
```

## 性能优化

### 1. 缓存配置

```bash
SEMGREP_CACHE_ENABLED=true
SEMGREP_CACHE_TTL=3600
```

### 2. 并发控制

```bash
SEMGREP_MAX_CONCURRENT_SCANS=3
```

### 3. 文件过滤

```json
{
  "exclude": [
    "node_modules/**",
    "*.test.js",
    "dist/**",
    "build/**"
  ]
}
```

## 监控指标

- 扫描时间
- 发现的问题数量
- 规则覆盖率
- 误报率

## 后续扩展

1. **自定义报告格式**
2. **IDE 插件集成**
3. **CI/CD 流水线集成**
4. **更多语言支持**