# LSP集成示例文档

本文档提供LSP集成的实际使用示例，帮助开发者快速上手。

## 基础使用示例

### 1. 初始化LSP管理器

```typescript
import { LSPManager } from '../src/services/lsp';

async function initializeLSP() {
  const lspManager = LSPManager.getInstance();
  
  try {
    await lspManager.initialize();
    console.log('LSP initialized successfully');
  } catch (error) {
    console.error('Failed to initialize LSP:', error);
  }
}
```

### 2. 获取文件诊断信息

```typescript
import { LSPManager } from '../src/services/lsp';

async function getFileDiagnostics(filePath: string) {
  const lspManager = LSPManager.getInstance();
  
  try {
    const diagnostics = await lspManager.getDiagnostics(filePath);
    
    diagnostics.forEach(diagnostic => {
      console.log(`Line ${diagnostic.range.start.line + 1}: ${diagnostic.message}`);
      console.log(`Severity: ${diagnostic.severity}`);
    });
    
    return diagnostics;
  } catch (error) {
    console.error('Failed to get diagnostics:', error);
    return [];
  }
}

// 使用示例
const diagnostics = await getFileDiagnostics('/path/to/file.ts');
```

### 3. 获取文件符号信息

```typescript
import { LSPManager } from '../src/services/lsp';

async function getFileSymbols(filePath: string) {
  const lspManager = LSPManager.getInstance();
  
  try {
    const symbols = await lspManager.getSymbols(filePath);
    
    symbols.forEach(symbol => {
      console.log(`${symbol.kind}: ${symbol.name} at line ${symbol.location.range.start.line + 1}`);
    });
    
    return symbols;
  } catch (error) {
    console.error('Failed to get symbols:', error);
    return [];
  }
}
```

## 高级使用示例

### 1. 批量处理多个文件

```typescript
import { LSPManager } from '../src/services/lsp';
import * as fs from 'fs';
import * as path from 'path';

async function processProjectFiles(projectPath: string) {
  const lspManager = LSPManager.getInstance();
  
  // 预加载工作区
  await lspManager.preloadWorkspaces([projectPath]);
  
  // 获取项目中的所有TypeScript文件
  const tsFiles = await getAllTypeScriptFiles(projectPath);
  
  // 批量处理文件
  const results = await Promise.allSettled(
    tsFiles.map(async (filePath) => {
      const diagnostics = await lspManager.getDiagnostics(filePath);
      const symbols = await lspManager.getSymbols(filePath);
      
      return {
        filePath,
        diagnostics,
        symbols,
      };
    })
  );
  
  // 处理结果
  return results.filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<any>).value);
}

async function getAllTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scan(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dir);
  return files;
}
```

### 2. 集成到索引服务

```typescript
import { LSPManager } from '../src/services/lsp';
import { IndexService } from '../src/services/IndexService';

class EnhancedIndexService {
  private lspManager: LSPManager;
  private indexService: IndexService;

  constructor() {
    this.lspManager = LSPManager.getInstance();
    this.indexService = new IndexService();
  }

  async initialize() {
    await Promise.all([
      this.lspManager.initialize(),
      this.indexService.initialize(),
    ]);
  }

  async indexFileWithLSP(filePath: string) {
    try {
      // 获取LSP提供的符号信息
      const symbols = await this.lspManager.getSymbols(filePath);
      
      // 获取诊断信息用于质量评估
      const diagnostics = await this.lspManager.getDiagnostics(filePath);
      
      // 创建增强的索引数据
      const enhancedData = {
        filePath,
        symbols: symbols.map(symbol => ({
          name: symbol.name,
          kind: symbol.kind,
          location: symbol.location,
          documentation: symbol.documentation,
        })),
        quality: {
          hasErrors: diagnostics.length > 0,
          errorCount: diagnostics.length,
          severity: Math.max(...diagnostics.map(d => d.severity || 0), 0),
        },
      };
      
      // 存储到索引
      await this.indexService.createIndex(enhancedData);
      
      return enhancedData;
    } catch (error) {
      console.error('Failed to index file with LSP:', error);
      
      // 降级到基础索引
      return this.indexService.createBasicIndex(filePath);
    }
  }
}
```

### 3. 实时监控和更新

```typescript
import { LSPManager } from '../src/services/lsp';
import { EventEmitter } from 'events';

class LSPMonitor extends EventEmitter {
  private lspManager: LSPManager;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.lspManager = LSPManager.getInstance();
  }

  startMonitoring(projectPath: string, intervalMs: number = 5000) {
    if (this.watchInterval) {
      this.stopMonitoring();
    }

    this.watchInterval = setInterval(async () => {
      try {
        const status = this.lspManager.getStatus();
        
        // 检查连接状态
        if (!status.isHealthy) {
          this.emit('error', new Error('LSP connection unhealthy'));
          return;
        }

        // 获取统计信息
        this.emit('status', status);

        // 检查是否有新的诊断信息
        const files = await this.getChangedFiles(projectPath);
        for (const file of files) {
          const diagnostics = await this.lspManager.getDiagnostics(file);
          if (diagnostics.length > 0) {
            this.emit('diagnostics', { file, diagnostics });
          }
        }
      } catch (error) {
        this.emit('error', error);
      }
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  private async getChangedFiles(projectPath: string): Promise<string[]> {
    // 实现文件变更检测逻辑
    // 这里简化处理，实际应用中应该使用文件系统监控
    return []; // 返回变更的文件列表
  }
}

// 使用示例
const monitor = new LSPMonitor();

monitor.on('status', (status) => {
  console.log('LSP Status:', status);
});

monitor.on('diagnostics', ({ file, diagnostics }) => {
  console.log(`New diagnostics for ${file}:`, diagnostics);
});

monitor.on('error', (error) => {
  console.error('LSP Monitor error:', error);
});

monitor.startMonitoring('/path/to/project');
```

## 配置示例

### 1. 配置文件 (lsp-config.yml)

```yaml
# LSP配置示例
languages:
  typescript:
    command: "typescript-language-server"
    args: ["--stdio"]
    extensions: [".ts", ".tsx"]
    configFiles: ["tsconfig.json", "package.json"]
    
  javascript:
    command: "typescript-language-server"
    args: ["--stdio"]
    extensions: [".js", ".jsx"]
    configFiles: ["package.json", "jsconfig.json"]
    
  python:
    command: "pylsp"
    args: ["--stdio"]
    extensions: [".py"]
    configFiles: ["pyproject.toml", "setup.py", "requirements.txt"]
    
  rust:
    command: "rust-analyzer"
    args: []
    extensions: [".rs"]
    configFiles: ["Cargo.toml"]

settings:
  maxConnections: 10
  initialConnections: 2
  idleTimeout: 30000
  timeout: 5000
  retryAttempts: 3
  
  # 降级配置
  fallback:
    enabled: true
    strategy: "tree-sitter"
    
  # 熔断器配置
  circuitBreaker:
    threshold: 5
    timeout: 30000
```

### 2. 环境变量配置

```bash
# .env文件示例
LSP_DEBUG=true
LSP_LOG_LEVEL=debug
LSP_TIMEOUT=10000
LSP_MAX_CONNECTIONS=5
```

## 错误处理示例

```typescript
import { LSPManager, LSPError } from '../src/services/lsp';

async function robustLSPUsage() {
  const lspManager = LSPManager.getInstance();
  
  try {
    await lspManager.initialize();
  } catch (error) {
    if (error instanceof LSPError) {
      switch (error.type) {
        case 'CONNECTION_ERROR':
          console.warn('LSP连接失败，使用降级方案');
          return await useTreeSitterFallback();
        case 'TIMEOUT_ERROR':
          console.warn('LSP请求超时，增加超时时间');
          return await retryWithIncreasedTimeout();
        default:
          console.error('LSP错误:', error.message);
          throw error;
      }
    }
    throw error;
  }
}

async function useTreeSitterFallback() {
  // 实现Tree-sitter降级方案
  console.log('使用Tree-sitter进行代码分析');
}

async function retryWithIncreasedTimeout() {
  // 实现重试逻辑
  console.log('增加超时时间后重试');
}
```

## 性能优化示例

```typescript
import { LSPManager } from '../src/services/lsp';

class OptimizedLSPProcessor {
  private lspManager: LSPManager;
  private cache = new Map<string, any>();

  constructor() {
    this.lspManager = LSPManager.getInstance();
  }

  async processFilesWithCache(filePaths: string[]) {
    const results = [];
    
    // 批量预加载工作区
    const workspaces = [...new Set(
      filePaths.map(file => this.lspManager.findWorkspaceRoot(file))
    )];
    await this.lspManager.preloadWorkspaces(workspaces);
    
    // 并行处理文件
    const batches = this.createBatches(filePaths, 5); // 每批5个文件
    
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (filePath) => {
          // 检查缓存
          if (this.cache.has(filePath)) {
            return this.cache.get(filePath);
          }
          
          // 获取LSP数据
          const [diagnostics, symbols] = await Promise.all([
            this.lspManager.getDiagnostics(filePath),
            this.lspManager.getSymbols(filePath),
          ]);
          
          const result = { filePath, diagnostics, symbols };
          this.cache.set(filePath, result);
          
          return result;
        })
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

这些示例展示了LSP集成的各种使用场景，从基础的单文件处理到复杂的批量操作和性能优化。开发者可以根据实际需求选择合适的示例进行参考和扩展。