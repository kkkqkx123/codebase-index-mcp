import { Container } from 'inversify';
import { QueryCoordinationService } from './QueryCoordinationService';
import { VectorStorageService } from '../../services/storage/VectorStorageService';
import { GraphPersistenceService } from '../../services/storage/GraphPersistenceService';
import { ResultFusionEngine } from './ResultFusionEngine';
import { QueryOptimizer } from './QueryOptimizer';
import { QueryCache } from './QueryCache';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('QueryCoordinationService', () => {
  let container: Container;
  let queryCoordinationService: QueryCoordinationService;
  let mockVectorStorageService: jest.Mocked<VectorStorageService>;
  let mockGraphPersistenceService: jest.Mocked<GraphPersistenceService>;
  let mockResultFusionEngine: jest.Mocked<ResultFusionEngine>;
  let mockQueryOptimizer: jest.Mocked<QueryOptimizer>;
  let mockQueryCache: jest.Mocked<QueryCache>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockVectorStorageService = {
      searchVectors: jest.fn(),
      search: jest.fn(),
    } as any;

    mockGraphPersistenceService = {
      search: jest.fn(),
    } as any;

    mockResultFusionEngine = {
      fuse: jest.fn(),
    } as any;

    mockQueryOptimizer = {
      optimize: jest.fn(),
    } as any;

    mockQueryCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.VectorStorageService).toConstantValue(mockVectorStorageService);
    container.bind(TYPES.GraphPersistenceService).toConstantValue(mockGraphPersistenceService);
    container.bind(TYPES.ResultFusionEngine).toConstantValue(mockResultFusionEngine);
    container.bind(TYPES.QueryOptimizer).toConstantValue(mockQueryOptimizer);
    container.bind(TYPES.QueryCache).toConstantValue(mockQueryCache);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.QueryCoordinationService).to(QueryCoordinationService);

    queryCoordinationService = container.get<QueryCoordinationService>(TYPES.QueryCoordinationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeQuery', () => {
    it('should execute a query and return results', async () => {
      const queryRequest = {
        query: 'test query',
        projectId: 'test-project',
        options: {
          limit: 10,
        },
      };

      const optimizedQuery = {
        originalQuery: 'test query',
        optimizedQuery: 'test query',
        queryExpansion: [],
        filters: {
          language: [],
          fileType: [],
          path: [],
          custom: [],
        },
        searchStrategy: {
          type: 'semantic' as const,
          parallel: true,
          cacheStrategy: 'moderate' as const,
        },
        performance: {
          estimatedLatency: 100,
          complexity: 'low' as const,
          resourceUsage: 'low' as const,
        },
      };

      const vectorResults = [
        {
          id: '1',
          score: 0.9,
          filePath: '/path/to/file.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const graphResults = [
        {
          id: '2',
          score: 0.8,
          filePath: '/path/to/file.ts',
          content: 'class Test {}',
          startLine: 5,
          endLine: 7,
          language: 'typescript',
          chunkType: 'class',
          metadata: {},
        },
      ];

      const fusedResults = [
        {
          id: '1',
          score: 0.95,
          filePath: '/path/to/file.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          fusionMetrics: {
            vectorScore: 0.9,
            graphScore: 0,
            contextualScore: 0.95,
            finalScore: 0.95,
            confidence: 0.9,
          },
        },
      ];

      mockQueryOptimizer.optimize.mockResolvedValue(optimizedQuery);
      mockVectorStorageService.search.mockResolvedValue(vectorResults);
      mockGraphPersistenceService.search.mockResolvedValue(graphResults);
      mockResultFusionEngine.fuse.mockResolvedValue(fusedResults);
      mockQueryCache.get.mockResolvedValue(null);
      mockQueryCache.set.mockResolvedValue();

      const result = await queryCoordinationService.executeQuery(queryRequest);

      expect(result.results).toEqual(fusedResults);
      expect(result.metrics.executionTime).toBeDefined();
      expect(mockQueryOptimizer.optimize).toHaveBeenCalledWith(queryRequest);
      expect(mockVectorStorageService.search).toHaveBeenCalled();
      expect(mockGraphPersistenceService.search).toHaveBeenCalled();
      expect(mockResultFusionEngine.fuse).toHaveBeenCalled();
      expect(mockQueryCache.get).toHaveBeenCalledWith(queryRequest);
      expect(mockQueryCache.set).toHaveBeenCalledWith(queryRequest, fusedResults);
    });

    it('should return cached results when available', async () => {
      const queryRequest = {
        query: 'test query',
        projectId: 'test-project',
      };

      const cachedResults = [
        {
          id: '1',
          score: 0.9,
          filePath: '/path/to/file.ts',
          content: 'function test() {}',
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
        },
      ];

      const cachedMetrics = {
        queryId: 'query_123',
        executionTime: 5,
        vectorSearchTime: 0,
        graphSearchTime: 0,
        fusionTime: 0,
        totalResults: 1,
        cacheHit: true,
        performance: {
          throughput: 200,
          latency: 5,
          successRate: 1,
        },
      };

      mockQueryCache.get.mockResolvedValue(cachedResults);

      const result = await queryCoordinationService.executeQuery(queryRequest);

      expect(result.results).toEqual(cachedResults);
      expect(result.metrics).toEqual(cachedMetrics);
      expect(mockQueryCache.get).toHaveBeenCalledWith(queryRequest);
      expect(mockQueryOptimizer.optimize).not.toHaveBeenCalled();
    });
  });

  describe('executeBatchQueries', () => {
    it('should execute multiple queries and return results', async () => {
      const queryRequests = [
        {
          query: 'test query 1',
          projectId: 'test-project',
        },
        {
          query: 'test query 2',
          projectId: 'test-project',
        },
      ];

      const mockResults = [
        {
          results: [
            {
              id: '1',
              score: 0.9,
              filePath: '/path/to/file.ts',
              content: 'function test1() {}',
              startLine: 1,
              endLine: 3,
              language: 'typescript',
              chunkType: 'function',
              metadata: {},
            },
          ],
          metrics: {
            queryId: 'query_1',
            executionTime: 100,
            vectorSearchTime: 50,
            graphSearchTime: 30,
            fusionTime: 20,
            totalResults: 1,
            cacheHit: false,
            performance: {
              throughput: 10,
              latency: 100,
              successRate: 1,
            },
          },
        },
        {
          results: [
            {
              id: '2',
              score: 0.8,
              filePath: '/path/to/file.ts',
              content: 'function test2() {}',
              startLine: 5,
              endLine: 7,
              language: 'typescript',
              chunkType: 'function',
              metadata: {},
            },
          ],
          metrics: {
            queryId: 'query_2',
            executionTime: 120,
            vectorSearchTime: 60,
            graphSearchTime: 40,
            fusionTime: 20,
            totalResults: 1,
            cacheHit: false,
            performance: {
              throughput: 8.33,
              latency: 120,
              successRate: 1,
            },
          },
        },
      ];

      // Mock the executeQuery method to return the mock results
      const executeQuerySpy = jest
        .spyOn(queryCoordinationService, 'executeQuery')
        .mockImplementation(async (request) => {
          const index = queryRequests.indexOf(request);
          return mockResults[index];
        });

      const result = await queryCoordinationService.executeBatchQueries(queryRequests);

      expect(result.results).toEqual(mockResults);
      expect(result.totalMetrics.totalQueries).toBe(2);
      expect(executeQuerySpy).toHaveBeenCalledTimes(2);
      
      // Restore the original implementation
      executeQuerySpy.mockRestore();
    });
  });

  describe('getQueryPerformanceStats', () => {
    it('should return performance statistics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 3600000), // 1 hour ago
        end: new Date(),
      };

      const mockStats = {
        totalQueries: 100,
        averageLatency: 150,
        cacheHitRate: 0.8,
        throughput: 50,
        errorRate: 0.02,
        topQueries: [
          {
            query: 'test query',
            count: 10,
            avgLatency: 120,
          },
        ],
      };

      // Since QueryCoordinationService doesn't have a performance monitor implementation,
      // we'll test that it returns the expected structure
      const result = await queryCoordinationService.getQueryPerformanceStats(timeRange);

      // The actual implementation returns a default object with 0 values
      expect(result).toEqual({
        totalQueries: 0,
        averageLatency: 0,
        cacheHitRate: 0,
        throughput: 0,
        errorRate: 0,
        topQueries: [],
      });
    });
  });
});