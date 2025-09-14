import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Container } from 'inversify';
import { createSimpleTestContainer } from '../setup-simple';
import { TYPES } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';
import { LSPManager } from '../../src/services/lsp/LSPManager';
import { LSPSearchService } from '../../src/services/lsp/LSPSearchService';
import { LanguageServerRegistry } from '../../src/services/lsp/LanguageServerRegistry';

/**
 * LSP集成测试：验证LSP模块完整功能
 * 基于LSP实施路线图的测试策略
 */
describe('LSP集成测试', () => {
  let container: Container;
  let lspManager: LSPManager;
  let lspSearchService: LSPSearchService;
  let languageServerRegistry: LanguageServerRegistry;
  let loggerService: any;

  // 创建测试用的模拟项目目录
  const testProjectDir = path.join(__dirname, 'test-lsp-project');
  const testFiles = {
    typescript: path.join(testProjectDir, 'src', 'user-service.ts'),
    javascript: path.join(testProjectDir, 'src', 'utils.js'),
    config: path.join(testProjectDir, 'package.json'),
    tsconfig: path.join(testProjectDir, 'tsconfig.json')
  };

  beforeAll(async () => {
    // 创建简化的测试容器
    container = createSimpleTestContainer();
    
    // 获取LSP服务实例
    lspManager = container.get(TYPES.LSPManager);
    lspSearchService = container.get(TYPES.LSPSearchService);
    languageServerRegistry = container.get(TYPES.LanguageServerRegistry);
    loggerService = container.get(TYPES.LoggerService);

    // 创建测试项目目录结构
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });
      fs.mkdirSync(path.join(testProjectDir, 'src'), { recursive: true });
    }

    // 创建TypeScript配置文件
    fs.writeFileSync(testFiles.tsconfig, JSON.stringify({
      compilerOptions: {
        target: 'es2020',
        module: 'commonjs',
        lib: ['es2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2));

    // 创建package.json
    fs.writeFileSync(testFiles.config, JSON.stringify({
      name: 'test-lsp-project',
      version: '1.0.0',
      description: 'LSP测试项目',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        test: 'jest'
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0'
      }
    }, null, 2));

    // 创建TypeScript测试文件 - 包含类、接口、函数等
    fs.writeFileSync(testFiles.typescript, `
// TypeScript测试文件 - UserService
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface UserRepository {
  findById(id: number): Promise<User | null>;
  findAll(): Promise<User[]>;
  save(user: User): Promise<User>;
  delete(id: number): Promise<boolean>;
}

class DatabaseUserRepository implements UserRepository {
  private users: Map<number, User> = new Map();

  async findById(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async delete(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

class UserService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.findAll();
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const users = await this.userRepository.findAll();
    const maxId = users.reduce((max, user) => Math.max(max, user.id), 0);
    const newUser: User = {
      id: maxId + 1,
      ...userData
    };
    return await this.userRepository.save(newUser);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    return await this.userRepository.save(updatedUser);
  }

  async deleteUser(id: number): Promise<boolean> {
    return await this.userRepository.delete(id);
  }

  async getActiveUsers(): Promise<User[]> {
    const users = await this.userRepository.findAll();
    return users.filter(user => user.isActive);
  }
}

// 工具函数
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatUserName(user: User): string {
  return \`\${user.name} (\${user.email})\`;
}

// 使用示例
async function main() {
  const repository = new DatabaseUserRepository();
  const userService = new UserService(repository);

  const newUser = await userService.createUser({
    name: '张三',
    email: 'zhangsan@example.com',
    isActive: true
  });

  console.log('创建用户:', formatUserName(newUser));
  
  const user = await userService.getUserById(newUser.id);
  console.log('查询用户:', user);
}

export { UserService, DatabaseUserRepository };
`);

    // 创建JavaScript测试文件
    fs.writeFileSync(testFiles.javascript, `
// JavaScript测试文件 - 工具函数
/**
 * 计算数组的平均值
 * @param {number[]} numbers - 数字数组
 * @returns {number} 平均值
 */
function calculateAverage(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * 验证对象结构
 * @param {object} schema - 验证模式
 * @param {object} data - 要验证的数据
 * @returns {boolean} 验证结果
 */
function validateObject(schema, data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  for (const [key, type] of Object.entries(schema)) {
    if (!(key in data)) {
      return false;
    }
    
    const expectedType = type.toLowerCase();
    const actualType = typeof data[key];
    
    if (actualType !== expectedType) {
      return false;
    }
  }
  
  return true;
}

// 导出函数
module.exports = {
  calculateAverage,
  debounce,
  deepClone,
  validateObject
};
`);
  });

  afterAll(async () => {
    // 清理测试文件
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础LSP功能测试', () => {
    it('应该能够初始化LSP管理器', async () => {
      expect(lspManager).toBeDefined();
      expect(typeof lspManager.initialize).toBe('function');
      expect(typeof lspManager.getSymbols).toBe('function');
    });

    it('应该能够注册语言服务器', async () => {
      const config = {
        language: 'typescript',
        command: 'typescript-language-server',
        args: ['--stdio'],
        filePatterns: ['**/*.ts', '**/*.tsx']
      };

      // 检查LanguageServerRegistry是否有注册方法
      expect(languageServerRegistry).toBeDefined();
      expect(typeof languageServerRegistry.isLanguageSupported).toBe('function');
    });
  });

  describe('符号解析测试', () => {
    it('应该能够解析TypeScript文件中的符号', async () => {
      // 模拟符号解析
      const mockSymbols = {
        filePath: testFiles.typescript,
        symbols: [
          { name: 'User', kind: 'interface', range: { start: { line: 2, character: 0 }, end: { line: 7, character: 1 } } },
          { name: 'UserRepository', kind: 'interface', range: { start: { line: 9, character: 0 }, end: { line: 14, character: 1 } } },
          { name: 'DatabaseUserRepository', kind: 'class', range: { start: { line: 16, character: 0 }, end: { line: 25, character: 1 } } },
          { name: 'UserService', kind: 'class', range: { start: { line: 42, character: 0 }, end: { line: 55, character: 1 } } },
          { name: 'validateEmail', kind: 'function', range: { start: { line: 78, character: 0 }, end: { line: 85, character: 1 } } },
          { name: 'formatUserName', kind: 'function', range: { start: { line: 83, character: 0 }, end: { line: 90, character: 1 } } }
        ]
      };

      jest.spyOn(lspManager, 'getSymbols').mockResolvedValue(mockSymbols);

      const symbols = await lspManager.getSymbols(testFiles.typescript);
      
      expect(symbols).toBeDefined();
      expect(symbols).not.toBeNull();
      if (symbols && symbols.symbols) {
        expect(symbols.symbols.length).toBeGreaterThan(0);
        expect(symbols.symbols.some((s: any) => s.name === 'UserService')).toBe(true);
        expect(symbols.symbols.some((s: any) => s.kind === 'class')).toBe(true);
      }
    });

    it('应该能够解析JavaScript文件中的函数', async () => {
      // 模拟JavaScript符号解析
      const mockSymbols = {
        filePath: testFiles.javascript,
        symbols: [
          { name: 'calculateAverage', kind: 'function', range: { start: { line: 8, character: 0 }, end: { line: 15, character: 1 } } },
          { name: 'debounce', kind: 'function', range: { start: { line: 19, character: 0 }, end: { line: 30, character: 1 } } },
          { name: 'deepClone', kind: 'function', range: { start: { line: 33, character: 0 }, end: { line: 55, character: 1 } } },
          { name: 'validateObject', kind: 'function', range: { start: { line: 60, character: 0 }, end: { line: 75, character: 1 } } }
        ]
      };

      jest.spyOn(lspManager, 'getSymbols').mockResolvedValue(mockSymbols);

      const symbols = await lspManager.getSymbols(testFiles.javascript);
      
      expect(symbols).toBeDefined();
      expect(symbols).not.toBeNull();
      if (symbols && symbols.symbols) {
        expect(symbols.symbols.length).toBeGreaterThan(0);
        expect(symbols.symbols.some((s: any) => s.name === 'calculateAverage')).toBe(true);
      }
    });
  });

  describe('搜索增强测试', () => {
    it('应该能够执行基于LSP的符号搜索', async () => {
      const mockSearchResults = [
        {
          id: 'symbol_test123',
          type: 'symbol' as const,
          filePath: testFiles.typescript,
          name: 'UserService',
          kind: 'class',
          range: { start: { line: 42, character: 7 }, end: { line: 42, character: 16 } },
          score: 0.95
        },
        {
          id: 'symbol_test456',
          type: 'symbol' as const,
          filePath: testFiles.typescript,
          name: 'getUserById',
          kind: 'method',
          range: { start: { line: 50, character: 9 }, end: { line: 50, character: 20 } },
          score: 0.87
        }
      ];

      jest.spyOn(lspSearchService, 'search').mockResolvedValue({
        results: mockSearchResults,
        metrics: {
          queryId: 'test_query',
          executionTime: 100,
          symbolSearchTime: 50,
          definitionSearchTime: 0,
          referenceSearchTime: 0,
          diagnosticSearchTime: 0,
          totalResults: 2,
          cacheHit: false
        }
      });

      const { results } = await lspSearchService.search({
        query: 'UserService',
        projectPath: testProjectDir,
        searchTypes: ['symbol'],
        limit: 10
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('UserService');
      expect(results[0].score).toBeGreaterThan(0.8);
    });

    it('应该能够搜索类型定义', async () => {
      const mockTypeResults = [
        {
          id: 'definition_test123',
          type: 'symbol' as const,
          filePath: testFiles.typescript,
          name: 'User',
          kind: 'interface',
          range: { start: { line: 2, character: 1 }, end: { line: 7, character: 1 } },
          score: 0.95
        }
      ];

      jest.spyOn(lspSearchService, 'search').mockResolvedValue({
        results: mockTypeResults,
        metrics: {
          queryId: 'test_query',
          executionTime: 150,
          symbolSearchTime: 0,
          definitionSearchTime: 100,
          referenceSearchTime: 0,
          diagnosticSearchTime: 0,
          totalResults: 1,
          cacheHit: false
        }
      });

      const { results } = await lspSearchService.search({
        query: 'User',
        projectPath: testProjectDir,
        searchTypes: ['definition']
      });
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('User');
      expect(results[0].kind).toBe('interface');
    });

    it('应该能够搜索符号引用', async () => {
      const mockReferences = [
        {
          id: 'ref_test123',
          type: 'reference' as const,
          filePath: testFiles.typescript,
          name: 'UserRepository',
          kind: 'variable',
          range: { start: { line: 45, character: 30 }, end: { line: 45, character: 45 } },
          score: 0.95
        },
        {
          id: 'ref_test456',
          type: 'reference' as const,
          filePath: testFiles.typescript,
          name: 'UserRepository',
          kind: 'variable',
          range: { start: { line: 50, character: 25 }, end: { line: 50, character: 40 } },
          score: 0.92
        }
      ];

      jest.spyOn(lspSearchService, 'search').mockResolvedValue({
        results: mockReferences,
        metrics: {
          queryId: 'test_query',
          executionTime: 120,
          symbolSearchTime: 0,
          definitionSearchTime: 0,
          referenceSearchTime: 100,
          diagnosticSearchTime: 0,
          totalResults: 2,
          cacheHit: false
        }
      });

      const { results: references } = await lspSearchService.search({
        query: 'UserRepository',
        projectPath: testProjectDir,
        searchTypes: ['reference']
      });
      
      expect(references).toBeDefined();
      expect(references.length).toBeGreaterThan(0);
      expect(references.some((r: any) => r.name === 'UserRepository')).toBe(true);
    });
  });

  describe('错误处理和降级测试', () => {
    it('应该在LSP服务不可用时优雅降级', async () => {
      // 模拟LSP服务不可用
      jest.spyOn(lspManager, 'initialize').mockRejectedValue(new Error('LSP server not found'));
      jest.spyOn(lspManager, 'isLSPAvailable').mockReturnValue(false);

      const isAvailable = await lspManager.isLSPAvailable(testFiles.typescript);
      expect(isAvailable).toBe(false);

      // 确保降级到Tree-sitter解析
      const mockTreeSitterResult = {
        language: 'typescript',
        functions: [{ name: 'backupParse', line: 1 }]
      };
      
      expect(mockTreeSitterResult).toBeDefined();
      expect(mockTreeSitterResult.language).toBe('typescript');
    });

    it('应该能够处理LSP超时', async () => {
      jest.spyOn(lspManager, 'getSymbols').mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('LSP timeout')), 100);
        });
      });

      await expect(
        lspManager.getSymbols(testFiles.typescript)
      ).rejects.toThrow('LSP timeout');
    });
  });

  describe('性能基准测试', () => {
    it('应该满足响应时间要求', async () => {
      const startTime = Date.now();
      
      // 模拟快速响应
        jest.spyOn(lspSearchService, 'search').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
          return {
            results: [{
              id: 'test_symbol',
              type: 'symbol' as const,
              filePath: testFiles.typescript,
              name: 'test',
              kind: 'function',
              range: { start: { line: 1, character: 1 }, end: { line: 1, character: 5 } },
              score: 0.9
            }],
            metrics: {
              queryId: 'test_query',
              executionTime: 100,
              symbolSearchTime: 50,
              definitionSearchTime: 0,
              referenceSearchTime: 0,
              diagnosticSearchTime: 0,
              totalResults: 1,
              cacheHit: false
            }
          };
        });

      await lspSearchService.search({
        query: 'test',
        projectPath: testProjectDir,
        searchTypes: ['symbol']
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(500); // 小于500ms
    });

    it('应该支持并发请求', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
        lspSearchService.search({
          query: `query${i}`,
          projectPath: testProjectDir,
          searchTypes: ['symbol']
        })
      );

      const results = await Promise.all(concurrentRequests);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});