import 'reflect-metadata';
import { Container } from 'inversify';
import { IndexService } from './IndexService';
import { IndexCoordinator } from './IndexCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics } from '../monitoring/BatchProcessingMetrics';
import { HashUtils } from '../../utils/HashUtils';
import { SearchCoordinator } from '../search/SearchCoordinator';

// Mock the dependencies
jest.mock('../../core/LoggerService');
jest.mock('../../core/ErrorHandlerService');
jest.mock('./IndexCoordinator');
jest.mock('../../config/ConfigService');
jest.mock('../monitoring/BatchProcessingMetrics');
jest.mock('../../utils/HashUtils');
jest.mock('../search/SearchCoordinator');

describe('IndexService', () => {
  let indexService: IndexService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockIndexCoordinator: jest.Mocked<IndexCoordinator>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockBatchMetrics: jest.Mocked<BatchProcessingMetrics>;
  let mockSearchCoordinator: jest.Mocked<SearchCoordinator>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    
    mockErrorHandler = {
      handleError: jest.fn(),
      reportError: jest.fn(),
    } as unknown as jest.Mocked<ErrorHandlerService>;
    
    mockConfigService = {
      get: jest.fn(),
      getAll: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    
    mockBatchMetrics = {
      startBatchOperation: jest.fn(),
      updateBatchOperation: jest.fn(),
      endBatchOperation: jest.fn(),
      recordAdaptiveBatchingAdjustment: jest.fn(),
      getStats: jest.fn(),
      getRecentAlerts: jest.fn(),
      getOperationHistory: jest.fn(),
      exportMetrics: jest.fn(),
    } as unknown as jest.Mocked<BatchProcessingMetrics>;
    
    mockIndexCoordinator = {
      createIndex: jest.fn(),
      updateIndex: jest.fn(),
      deleteIndex: jest.fn(),
      getIndexStatus: jest.fn(),
      getStatus: jest.fn(),
      search: jest.fn(),
      getActiveIndexing: jest.fn(),
    } as unknown as jest.Mocked<IndexCoordinator>;
    
    mockSearchCoordinator = {
      search: jest.fn(),
    } as unknown as jest.Mocked<SearchCoordinator>;

    // Mock HashUtils
    (HashUtils.calculateDirectoryHash as jest.Mock) = jest.fn().mockResolvedValue({
      path: '/test/project',
      hash: 'test-hash-12345',
      fileCount: 5,
      files: []
    });

    // Create IndexService instance with mocked dependencies
    indexService = new IndexService(
      mockLogger,
      mockErrorHandler,
      mockConfigService,
      mockIndexCoordinator
    );
  });

  describe('createIndex', () => {
    it('should call IndexCoordinator.createIndex with correct parameters', async () => {
      const projectPath = '/test/project';
      const options = { includePatterns: ['**/*.ts'], excludePatterns: ['node_modules/**'] };
      
      // Mock the IndexCoordinator response
      mockIndexCoordinator.createIndex.mockResolvedValue({
        success: true,
        filesProcessed: 10,
        filesSkipped: 0,
        chunksCreated: 50,
        processingTime: 1000,
        errors: []
      });

      const result = await indexService.createIndex(projectPath, options);

      expect(mockIndexCoordinator.createIndex).toHaveBeenCalledWith(projectPath, options);
      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(10);
    });
  });

  describe('search', () => {
    it('should return search results', async () => {
      // Mock the IndexCoordinator response
      mockIndexCoordinator.search.mockResolvedValue([
        {
          id: 'result_1',
          score: 0.95,
          finalScore: 0.95,
          filePath: '/src/components/Button.tsx',
          content: 'export function Button({ onClick, children }: ButtonProps) {',
          startLine: 15,
          endLine: 25,
          language: 'typescript',
          chunkType: 'function',
          metadata: { functionName: 'Button', component: true },
          rankingFeatures: {
            semanticScore: 0.95
          }
        }
      ]);

      // Act
      const query = 'test query';
      const options = { limit: 10 };
      const results = await indexService.search(query, options);
      
      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check the structure of the first result
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('filePath');
    });
  });

  describe('getStatus', () => {
    it('should return index status', async () => {
      // Mock the IndexCoordinator response
      mockIndexCoordinator.getStatus.mockResolvedValue({
        projectId: 'test-hash-12345',
        isIndexing: false,
        lastIndexed: new Date(),
        fileCount: 150,
        chunkCount: 450,
        status: 'completed'
      });

      // Act
      const projectPath = '/test/project';
      const status = await indexService.getStatus(projectPath);
      
      // Assert
      expect(status).toHaveProperty('projectId');
      expect(status).toHaveProperty('isIndexing');
      expect(status).toHaveProperty('lastIndexed');
      expect(status).toHaveProperty('fileCount');
      expect(status).toHaveProperty('chunkCount');
      expect(status).toHaveProperty('status');
    });
  });
});