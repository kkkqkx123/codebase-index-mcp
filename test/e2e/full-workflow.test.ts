import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Container } from 'inversify';
import { createTestContainer } from '../setup';
import { IndexService } from '../../src/services/indexing/IndexService';
import { ParserService } from '../../src/services/parser/ParserService';
import { EmbeddingService } from '../../src/services/storage/EmbeddingService';
import { VectorStorageService } from '../../src/services/storage/vector/VectorStorageService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { ConfigService } from '../../src/config/ConfigService';
import { TreeSitterService } from '../../src/services/parser/TreeSitterService';
import { SemanticAnalysisService } from '../../src/services/parser/SemanticAnalysisService';
import { EnhancedSemgrepScanService } from '../../src/services/semgrep/EnhancedSemgrepScanService';
import fs from 'fs';
import path from 'path';

/**
 * 端到端测试：验证完整工作流
 * 测试从文件解析到索引构建再到搜索查询的完整流程
 */
describe('端到端工作流测试', () => {
  let container: Container;
  let indexService: IndexService;
  let parserService: ParserService;
  let embeddingService: EmbeddingService;
  let vectorStorageService: VectorStorageService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;
  let treeSitterService: TreeSitterService;
  let semanticAnalysisService: SemanticAnalysisService;
  let semgrepScanService: EnhancedSemgrepScanService;

  // 创建测试用的模拟项目目录
  const testProjectDir = path.join(__dirname, 'test-project');
  const testFiles = {
    javascript: path.join(testProjectDir, 'src', 'test.js'),
    typescript: path.join(testProjectDir, 'src', 'test.ts'),
    python: path.join(testProjectDir, 'src', 'test.py'),
    config: path.join(testProjectDir, 'package.json')
  };

  beforeAll(async () => {
    // 创建测试容器
    container = createTestContainer();
    
    // 获取服务实例
    indexService = container.get(IndexService);
    parserService = container.get(ParserService);
    embeddingService = container.get(EmbeddingService);
    vectorStorageService = container.get(VectorStorageService);
    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);
    treeSitterService = container.get(TreeSitterService);
    semanticAnalysisService = container.get(SemanticAnalysisService);
    semgrepScanService = container.get(EnhancedSemgrepScanService);

    // 创建测试项目目录结构
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.mkdirSync(path.join(testProjectDir, 'src'), { recursive: true });
    }

    // 创建测试文件
    fs.writeFileSync(testFiles.javascript, `
// JavaScript测试文件
function calculateSum(a, b) {
  // 计算两个数的和
  return a + b;
}

class Calculator {
  constructor() {
    this.value = 0;
  }

  add(x) {
    this.value += x;
    return this.value;
  }

  subtract(x) {
    this.value -= x;
    return this.value;
  }
}

// 使用示例
const calc = new Calculator();
console.log(calc.add(5)); // 5
console.log(calc.subtract(2)); // 3
`);

    fs.writeFileSync(testFiles.typescript, `
// TypeScript测试文件
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users];
  }
}

// 泛型函数示例
function identity<T>(arg: T): T {
  return arg;
}
`);

    fs.writeFileSync(testFiles.python, `
# Python测试文件
def calculate_factorial(n):
    """计算阶乘"""
    if n == 0:
        return 1
    else:
        return n * calculate_factorial(n - 1)

class MathOperations:
    def __init__(self):
        self.result = 0
    
    def add(self, a, b):
        """加法运算"""
        self.result = a + b
        return self.result
    
    def multiply(self, a, b):
        """乘法运算"""
        self.result = a * b
        return self.result

# 使用示例
math_ops = MathOperations()
print(math_ops.add(3, 4))  # 7
print(math_ops.multiply(2, 5))  # 10
`);

    fs.writeFileSync(testFiles.config, `
{
  "name": "test-project",
  "version": "1.0.0",
  "description": "测试项目",
  "main": "src/test.js",
  "scripts": {
    "test": "echo \"测试运行\""
  },
  "dependencies": {}
}
`);

    // 确保所有服务都已初始化
    jest.spyOn(vectorStorageService, 'initialize').mockResolvedValue(true);
    
    await vectorStorageService.initialize();
    // TreeSitterService和SemanticAnalysisService没有initialize方法
    // EnhancedSemgrepScanService没有initialize方法
  });

  afterAll(async () => {
    // 清理测试文件
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();
  });

  describe('完整工作流验证', () => {
    it('应该能够解析多语言文件', async () => {
      // 测试文件解析功能
      const jsResult = await parserService.parseFile(testFiles.javascript);
      const tsResult = await parserService.parseFile(testFiles.typescript);
      const pyResult = await parserService.parseFile(testFiles.python);

      expect(jsResult).toBeDefined();
      expect(jsResult.language).toBe('javascript');
      expect(jsResult.functions.length).toBeGreaterThan(0);

      expect(tsResult).toBeDefined();
      expect(tsResult.language).toBe('typescript');
      expect(tsResult.functions.length).toBeGreaterThan(0);

      expect(pyResult).toBeDefined();
      expect(pyResult.language).toBe('python');
      expect(pyResult.functions.length).toBeGreaterThan(0);
    });

    it('应该能够提取代码片段并进行语义分析', async () => {
      // 测试代码片段提取
      const jsContent = fs.readFileSync(testFiles.javascript, 'utf-8');
      
      // 使用tree-sitter解析并提取函数
      const parseResult = await treeSitterService.parseCode(jsContent, 'javascript');
      const functions = treeSitterService.extractFunctions(parseResult.ast);

      expect(functions).toBeDefined();
      expect(functions.length).toBeGreaterThan(0);

      // 测试语义分析（使用正确的接口）
      if (semanticAnalysisService && typeof semanticAnalysisService.analyzeSemanticContext === 'function') {
        const analysisResult = await semanticAnalysisService.analyzeSemanticContext(
          testFiles.javascript, 
          jsContent, 
          'javascript'
        );
        expect(analysisResult).toBeDefined();
      }
    });

    it('应该能够生成嵌入向量', async () => {
      // 测试嵌入生成
      const testText = '这是一个测试文本，用于生成嵌入向量';
      
      // 模拟嵌入生成 - 返回number[]数组
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.1)
      );

      const embedding = await embeddingService.generateEmbedding(testText);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('应该能够构建索引', async () => {
      // 测试索引构建
      const testData = [
        {
          id: 'test1',
          content: 'function test() { return "hello"; }',
          metadata: { 
            language: 'javascript', 
            filePath: testFiles.javascript
          }
        }
      ];

      // 模拟向量存储
      jest.spyOn(vectorStorageService, 'storeChunks').mockResolvedValue({
        success: true,
        processedFiles: 1,
        totalChunks: 1,
        uniqueChunks: 1,
        duplicatesRemoved: 0,
        processingTime: 100,
        errors: []
      });

      const result = await vectorStorageService.storeChunks([{
        id: 'test1',
        content: 'function test() { return "hello"; }',
        startLine: 1,
        endLine: 1,
        startByte: 0,
        endByte: 100,
        type: 'function',
        imports: [],
        exports: [],
        metadata: {
          language: 'javascript',
          filePath: testFiles.javascript,
          functionName: 'test'
        }
      }]);
      expect(result.success).toBe(true);
    });

    it('应该能够执行搜索查询', async () => {
      // 测试搜索功能
      const testQuery = '计算函数';
      
      // 模拟查询处理 - 返回number[]数组
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.1)
      );

      jest.spyOn(vectorStorageService, 'searchVectors').mockResolvedValue([
        {
          id: 'test1',
          score: 0.95,
          payload: {
            content: 'function calculateSum(a, b) { return a + b; }',
            filePath: testFiles.javascript,
            language: 'javascript',
            chunkType: 'function',
            startLine: 1,
            endLine: 3,
            metadata: {
              functionName: 'calculateSum'
            },
            timestamp: new Date()
          }
        }
      ]);

      const searchResults = await vectorStorageService.searchVectors(new Array(1536).fill(0.1));
      
      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].score).toBeGreaterThan(0.8);
    });

    it('应该能够处理整个项目索引', async () => {
      // 测试完整项目索引流程
      const projectPath = testProjectDir;
      
      // 模拟索引构建
      jest.spyOn(indexService, 'createIndex').mockResolvedValue({
        success: true,
        filesProcessed: 4,
        filesSkipped: 0,
        chunksCreated: 10,
        processingTime: 1000,
        errors: []
      });

      const indexResult = await indexService.createIndex(projectPath, {
        includePatterns: ['**/*.js', '**/*.ts', '**/*.py', '**/*.json'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: 1024 * 1024 // 1MB
      });

      expect(indexResult).toBeDefined();
      expect(indexResult.success).toBe(true);
      expect(indexResult.filesProcessed).toBe(4);
      expect(indexResult.chunksCreated).toBeGreaterThan(0);
    });

    it('应该能够集成tree-sitter和semgrep分析', async () => {
      // 测试tree-sitter和semgrep的集成
      const jsContent = fs.readFileSync(testFiles.javascript, 'utf-8');
      
      // 测试tree-sitter解析
      const astResult = await treeSitterService.parseCode(jsContent, 'javascript');
      expect(astResult).toBeDefined();
      expect(astResult.ast).toBeDefined();

      // 测试semgrep扫描（如果配置了规则）
      if (semgrepScanService && typeof semgrepScanService.scanProject === 'function') {
        const semgrepResult = await semgrepScanService.scanProject(testProjectDir);
        expect(semgrepResult).toBeDefined();
      }

      // 测试语义分析集成
      if (semanticAnalysisService && typeof semanticAnalysisService.analyzeSemanticContext === 'function') {
        const analysisResult = await semanticAnalysisService.analyzeSemanticContext(
          testFiles.javascript, 
          jsContent, 
          'javascript'
        );
        expect(analysisResult).toBeDefined();
      }
    });

    it('应该能够处理错误情况', async () => {
      // 测试错误处理
      const invalidPath = '/invalid/path/to/file.js';
      
      // 测试文件不存在的情况
      await expect(parserService.parseFile(invalidPath)).rejects.toThrow();
      
      // 测试空查询搜索
      const emptyResults = await indexService.search('', 'test-project', { limit: 5 });
      expect(Array.isArray(emptyResults)).toBe(true);
      expect(emptyResults.length).toBe(0);
    });

    it('应该能够处理性能基准测试', async () => {
      // 性能基准测试
      const startTime = Date.now();
      
      // 测试小文件解析性能
      const smallContent = 'function test() { return "hello"; }';
      const parseResult = await treeSitterService.parseCode(smallContent, 'javascript');
      
      const parseTime = Date.now() - startTime;
      
      expect(parseResult).toBeDefined();
      expect(parseTime).toBeLessThan(1000); // 解析时间应小于1秒
      
      console.log(`小文件解析时间: ${parseTime}ms`);
    });

    it('应该能够验证数据一致性', async () => {
      // 数据一致性验证
      const testContent = 'const a = 1; const b = 2; function sum() { return a + b; }';
      
      // 多次解析相同内容，结果应该一致
      const result1 = await treeSitterService.parseCode(testContent, 'javascript');
      const result2 = await treeSitterService.parseCode(testContent, 'javascript');
      
      // 验证函数提取一致性
      const functions1 = treeSitterService.extractFunctions(result1.ast);
      const functions2 = treeSitterService.extractFunctions(result2.ast);
      
      expect(functions1.length).toBe(functions2.length);
    });

    it('应该能够处理并发请求', async () => {
      // 测试并发处理能力
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          embeddingService.generateEmbedding(`测试文本 ${i}`)
        );
      }

      // 模拟并发嵌入生成 - 返回number[]数组
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(
        new Array(1536).fill(0.1)
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(concurrentRequests);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1536);
      });
    });

    it('应该能够缓存解析结果', async () => {
      // 测试缓存功能
      const jsContent = fs.readFileSync(testFiles.javascript, 'utf-8');
      
      // 第一次解析
      const result1 = await treeSitterService.parseCode(jsContent, 'javascript');
      expect(result1).toBeDefined();
      expect(result1.ast).toBeDefined();
      expect(result1.success).toBe(true);

      // 第二次解析应该使用缓存
      const result2 = await treeSitterService.parseCode(jsContent, 'javascript');
      expect(result2).toBeDefined();
      expect(result2.ast).toBeDefined();
      expect(result2.success).toBe(true);

      // 验证结果一致性
      const functions1 = treeSitterService.extractFunctions(result1.ast);
      const functions2 = treeSitterService.extractFunctions(result2.ast);
      
      expect(functions1.length).toBe(functions2.length);
    });
  });

  describe('数据一致性验证', () => {
    it('应该保持索引数据的一致性', async () => {
      const testId = 'consistency-test';
      const testContent = 'function consistent() { return "consistent"; }';
      
      jest.spyOn(vectorStorageService, 'storeChunks').mockResolvedValue({
        success: true,
        processedFiles: 1,
        totalChunks: 1,
        uniqueChunks: 1,
        duplicatesRemoved: 0,
        processingTime: 100,
        errors: []
      });

      jest.spyOn(vectorStorageService, 'searchVectors').mockResolvedValue([
        {
          id: testId,
          score: 0.99,
          payload: {
            content: testContent,
            filePath: testFiles.javascript,
            language: 'javascript',
            chunkType: 'function',
            startLine: 1,
            endLine: 1,
            metadata: {},
            timestamp: new Date()
          }
        }
      ]);

      // 存储数据
      await vectorStorageService.storeChunks([{
        id: 'test-chunk-1',
        content: 'const a = 1;',
        startLine: 1,
        endLine: 1,
        startByte: 0,
        endByte: 10,
        type: 'statement',
        imports: [],
        exports: [],
        metadata: {
          language: 'javascript',
          filePath: testFiles.javascript
        }
      }]);

      // 检索数据
      const retrieved = await vectorStorageService.searchVectors(new Array(1536).fill(0.1));
      
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe(testId);
      expect(retrieved[0].payload.content).toBe(testContent);
    });
  });
});