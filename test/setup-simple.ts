import { Container } from 'inversify';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { TYPES } from '../src/types';
import { LoggerService } from '../src/core/LoggerService';
import { ErrorHandlerService } from '../src/core/ErrorHandlerService';
import { ConfigService } from '../src/config/ConfigService';
import { IndexService } from '../src/services/indexing/IndexService';
import { ParserService } from '../src/services/parser/ParserService';
import { EmbeddingService } from '../src/services/storage/EmbeddingService';
import { VectorStorageService } from '../src/services/storage/vector/VectorStorageService';
import { TreeSitterService } from '../src/services/parser/TreeSitterService';
import { SemanticAnalysisService } from '../src/services/parser/SemanticAnalysisService';
import { EnhancedSemgrepScanService } from '../src/services/semgrep/EnhancedSemgrepScanService';

// Load main .env file
const mainEnvPath = path.join(process.cwd(), '.env');
dotenv.config({ path: mainEnvPath });

// Set up test environment
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});

// Simplified test container without circular dependencies
export const createSimpleTestContainer = () => {
  const container = new Container();
  
  // Mock LoggerService
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  
  container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger as any);
  
  // Mock ErrorHandlerService
  const mockErrorHandler = {
    handleError: jest.fn(),
    handleAsyncError: jest.fn(),
    wrapAsync: jest.fn().mockImplementation((fn) => fn),
    onError: jest.fn(),
    getErrorReports: jest.fn().mockReturnValue([]),
    markErrorHandled: jest.fn(),
    clearErrorReports: jest.fn(),
  };
  
  container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler as any);
  
  // Mock ConfigService
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'embedding') {
        return {
          provider: 'siliconflow',
          siliconflow: {
            apiKey: 'test-key',
            model: 'BAAI/bge-m3'
          }
        };
      }
      if (key === 'database') {
        return {
          qdrant: {
            host: 'localhost',
            port: 6333,
            collection: 'code-snippets'
          }
        };
      }
      return {};
    }),
    getAll: jest.fn().mockReturnValue({})
  };
  
  container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfig as any);
  
  // Mock services for testing
  const mockVectorStorage = {
    initialize: jest.fn().mockResolvedValue(true),
    store: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue([]),
    searchVectors: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(true),
    storeChunks: jest.fn().mockResolvedValue({
      success: true,
      processedFiles: 0,
      totalChunks: 0,
      uniqueChunks: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      errors: []
    }),
  };
  
  container.bind<VectorStorageService>(TYPES.VectorStorageService).toConstantValue(mockVectorStorage as any);
  
  const mockEmbeddingService = {
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    generateEmbeddings: jest.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
  };
  
  container.bind<EmbeddingService>(TYPES.EmbeddingService).toConstantValue(mockEmbeddingService as any);
  
  const mockParserService = {
    parseFile: jest.fn().mockImplementation((filePath: string) => {
      // 模拟文件不存在的情况
      if (filePath.includes('/invalid/path/') || filePath.includes('\\invalid\\path\\')) {
        return Promise.reject(new Error(`文件不存在: ${filePath}`));
      }
      
      // 根据文件扩展名返回正确的语言
      let language = 'javascript';
      if (filePath.endsWith('.ts')) {
        language = 'typescript';
      } else if (filePath.endsWith('.py')) {
        language = 'python';
      }
      
      return Promise.resolve({
        language,
        functions: [{ name: 'testFunction', parameters: [], returnType: 'void' }],
        classes: [],
        variables: []
      });
    }),
    parseFiles: jest.fn().mockResolvedValue([{
      filePath: 'test.js',
      language: 'javascript',
      functions: [{ name: 'testFunction', parameters: [], returnType: 'void' }],
      classes: [],
      variables: []
    }]),
  };
  
  container.bind<ParserService>(TYPES.ParserService).toConstantValue(mockParserService as any);
  
  const mockTreeSitterService = {
    parseCode: jest.fn().mockResolvedValue({
      ast: {},
      tokens: [],
      success: true
    }),
    extractFunctions: jest.fn().mockReturnValue([{
      name: 'testFunction',
      parameters: [],
      returnType: 'void'
    }]),
  };
  
  container.bind<TreeSitterService>(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService as any);
  
  const mockSemanticAnalysisService = {
    analyzeSemanticContext: jest.fn().mockResolvedValue({
      functions: [],
      variables: [],
      types: []
    }),
  };
  
  container.bind<SemanticAnalysisService>(TYPES.SemanticAnalysisService).toConstantValue(mockSemanticAnalysisService as any);
  
  const mockSemgrepScanService = {
    scanProject: jest.fn().mockResolvedValue({
      results: [],
      errors: [],
      summary: {
        totalFiles: 0,
        totalRules: 0,
        totalFindings: 0,
        timing: {}
      }
    }),
  };
  
  container.bind<EnhancedSemgrepScanService>(TYPES.EnhancedSemgrepScanService).toConstantValue(mockSemgrepScanService as any);
  
  // Mock IndexService (simplified without complex dependencies)
  const mockIndexService = {
    createIndex: jest.fn().mockResolvedValue({
      success: true,
      filesProcessed: 0,
      filesSkipped: 0,
      chunksCreated: 0,
      processingTime: 0,
      errors: []
    }),
    updateIndex: jest.fn().mockResolvedValue({
      success: true,
      filesProcessed: 0,
      filesSkipped: 0,
      chunksCreated: 0,
      processingTime: 0,
      errors: []
    }),
    search: jest.fn().mockResolvedValue([]),
  };
  
  container.bind<IndexService>(TYPES.IndexService).toConstantValue(mockIndexService as any);
  
  return container;
};

// Clean up after all tests
afterAll(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
});