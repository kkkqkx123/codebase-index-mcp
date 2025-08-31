import { Container } from 'inversify';
import { HybridSearchService } from './HybridSearchService';
import { SemanticSearchService } from './SemanticSearchService';
import { QdrantService } from '../../database/QdrantService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('HybridSearchService', () => {
  let container: Container;
  let hybridSearchService: HybridSearchService;
  let mockSemanticSearchService: jest.Mocked<SemanticSearchService>;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockNebulaService: jest.Mocked<NebulaService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockSemanticSearchService = {
      search: jest.fn(),
    } as any;

    mockQdrantService = {
      searchVectors: jest.fn(),
      getPoint: jest.fn(),
    } as any;

    mockNebulaService = {
      executeQuery: jest.fn(),
      findNodes: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getSearchConfig: jest.fn().mockReturnValue({
        maxResults: 50,
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        rerankingEnabled: true,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.SemanticSearchService).toConstantValue(mockSemanticSearchService);
    container.bind(TYPES.QdrantService).toConstantValue(mockQdrantService);
    container.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.HybridSearchService).to(HybridSearchService);

    hybridSearchService = container.get<HybridSearchService>(TYPES.HybridSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should perform hybrid search combining semantic and keyword results', async () => {
      const params = {
        query: 'authentication function',
        projectId: 'test-project',
        limit: 10
      };

      const semanticResults = [
        {
          id: '1',
          score: 0.9,
          similarity: 0.9,
          filePath: '/test/file1.ts',
          content: 'auth function',
          startLine: 1,
          endLine: 5,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.9,
            contextualScore: 0.8,
            recencyScore: 0.7,
            popularityScore: 0.6,
            finalScore: 0.9
          }
        },
        {
          id: '2',
          score: 0.8,
          similarity: 0.8,
          filePath: '/test/file2.ts',
          content: 'login method',
          startLine: 10,
          endLine: 15,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.8,
            contextualScore: 0.7,
            recencyScore: 0.6,
            popularityScore: 0.5,
            finalScore: 0.8
          }
        },
      ];

      const keywordResults = [
        {
          id: '3',
          score: 0.7,
          similarity: 0.7,
          filePath: '/test/file3.ts',
          content: 'authenticate user',
          startLine: 20,
          endLine: 25,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.7,
            contextualScore: 0.6,
            recencyScore: 0.5,
            popularityScore: 0.4,
            finalScore: 0.7
          }
        },
        {
          id: '1',
          score: 0.6,
          similarity: 0.6,
          filePath: '/test/file1.ts',
          content: 'auth function',
          startLine: 1,
          endLine: 5,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.6,
            contextualScore: 0.5,
            recencyScore: 0.4,
            popularityScore: 0.3,
            finalScore: 0.6
          }
        }, // Duplicate
      ];

      mockSemanticSearchService.search.mockResolvedValue({
        results: semanticResults,
        metrics: {
          queryId: 'test-query-1',
          executionTime: 100,
          embeddingTime: 50,
          searchTime: 30,
          rankingTime: 20,
          totalResults: 2,
          averageSimilarity: 0.85,
          searchStrategy: 'semantic'
        }
      });
      mockQdrantService.searchVectors.mockResolvedValue(keywordResults);

      const result = await hybridSearchService.search(params);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(3); // Should deduplicate
      expect(mockSemanticSearchService.search).toHaveBeenCalledWith(expect.objectContaining({ query: params.query, projectId: params.projectId }));
      expect(mockQdrantService.searchVectors).toHaveBeenCalled();
    });

    it('should handle empty semantic results gracefully', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        limit: 10
      };

      mockSemanticSearchService.search.mockResolvedValue({
        results: [],
        metrics: {
          queryId: 'test-query-2',
          executionTime: 50,
          embeddingTime: 25,
          searchTime: 15,
          rankingTime: 10,
          totalResults: 0,
          averageSimilarity: 0,
          searchStrategy: 'semantic'
        }
      });
      mockQdrantService.searchVectors.mockResolvedValue([
        {
          id: '1',
          score: 0.5,
          similarity: 0.5,
          filePath: '/test/file1.ts',
          content: 'test content',
          startLine: 1,
          endLine: 5,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.5,
            contextualScore: 0.4,
            recencyScore: 0.3,
            popularityScore: 0.2,
            finalScore: 0.5
          }
        },
      ]);

      const result = await hybridSearchService.search(params);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('1');
    });

    it('should handle search errors gracefully', async () => {
      const params = {
        query: 'test query',
        projectId: 'test-project',
        limit: 10
      };

      mockSemanticSearchService.search.mockRejectedValue(new Error('Search failed'));
      mockQdrantService.searchVectors.mockResolvedValue([]);

      const result = await hybridSearchService.search(params);

      expect(result.results).toHaveLength(0);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('search with context', () => {
    it('should enhance results with graph context', async () => {
      const params: any = {
        query: 'database connection',
        projectId: 'test-project',
        searchStrategies: ['semantic' as const]
      };

      const searchResults = [
        {
          id: '1',
          score: 0.9,
          similarity: 0.9,
          filePath: '/src/db.ts',
          content: 'db.connect()',
          startLine: 5,
          endLine: 10,
          language: 'typescript',
          chunkType: 'function',
          metadata: { filePath: '/src/db.ts' },
          rankingFactors: {
            semanticScore: 0.9,
            contextualScore: 0.8,
            recencyScore: 0.7,
            popularityScore: 0.6,
            finalScore: 0.9
          }
        },
      ];

      const graphContext = [
        { id: '2', relationship: 'calls', content: 'connection.query()' },
      ];

      mockSemanticSearchService.search.mockResolvedValue({
        results: searchResults,
        metrics: {
          queryId: 'test-query-3',
          executionTime: 120,
          embeddingTime: 60,
          searchTime: 40,
          rankingTime: 20,
          totalResults: 1,
          averageSimilarity: 0.9,
          searchStrategy: 'semantic'
        }
      });
      mockNebulaService.findNodes.mockResolvedValue(graphContext);

      const result = await hybridSearchService.search(params);

      expect(result.results).toHaveLength(1);
      expect(mockNebulaService.findNodes).toHaveBeenCalled();
    });
  });

  describe('search by language', () => {
    it('should filter results by programming language', async () => {
      const params = {
        query: 'function definition',
        projectId: 'test-project',
        limit: 10,
        filters: {
          language: ['typescript']
        }
      };

      const results = [
        {
          id: '1',
          score: 0.9,
          similarity: 0.9,
          filePath: '/test/file1.ts',
          content: 'function test()',
          startLine: 1,
          endLine: 5,
          language: 'typescript',
          chunkType: 'function',
          metadata: { language: 'typescript' },
          rankingFactors: {
            semanticScore: 0.9,
            contextualScore: 0.8,
            recencyScore: 0.7,
            popularityScore: 0.6,
            finalScore: 0.9
          }
        },
        {
          id: '2',
          score: 0.8,
          similarity: 0.8,
          filePath: '/test/file2.py',
          content: 'def test():',
          startLine: 1,
          endLine: 5,
          language: 'python',
          chunkType: 'function',
          metadata: { language: 'python' },
          rankingFactors: {
            semanticScore: 0.8,
            contextualScore: 0.7,
            recencyScore: 0.6,
            popularityScore: 0.5,
            finalScore: 0.8
          }
        },
      ];

      mockSemanticSearchService.search.mockResolvedValue({
        results,
        metrics: {
          queryId: 'test-query-4',
          executionTime: 80,
          embeddingTime: 40,
          searchTime: 25,
          rankingTime: 15,
          totalResults: 2,
          averageSimilarity: 0.85,
          searchStrategy: 'semantic'
        }
      });

      const result = await hybridSearchService.search(params);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].metadata.language).toBe('typescript');
    });
  });

  describe('search similar functions', () => {
    it('should find functions with similar signatures', async () => {
      const params = {
        query: 'async function processData(data: any[]): Promise<void>',
        projectId: 'test-project',
        limit: 5
      };

      const results = [
        {
          id: '1',
          score: 0.95,
          similarity: 0.95,
          filePath: '/test/file1.ts',
          content: 'async function handleData(items: any[]): Promise<void>',
          startLine: 10,
          endLine: 15,
          language: 'typescript',
          chunkType: 'function',
          metadata: {},
          rankingFactors: {
            semanticScore: 0.95,
            contextualScore: 0.85,
            recencyScore: 0.75,
            popularityScore: 0.65,
            finalScore: 0.95
          }
        },
      ];

      mockSemanticSearchService.search.mockResolvedValue({
        results,
        metrics: {
          queryId: 'test-query-5',
          executionTime: 90,
          embeddingTime: 45,
          searchTime: 30,
          rankingTime: 15,
          totalResults: 1,
          averageSimilarity: 0.95,
          searchStrategy: 'semantic'
        }
      });

      const result = await hybridSearchService.search(params);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeGreaterThan(0.9);
    });
  });
});