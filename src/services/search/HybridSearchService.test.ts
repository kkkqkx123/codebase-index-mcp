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
      searchSimilarCode: jest.fn(),
      searchByVector: jest.fn(),
      searchByText: jest.fn(),
    } as any;

    mockQdrantService = {
      search: jest.fn(),
      searchWithFilter: jest.fn(),
      getPoint: jest.fn(),
    } as any;

    mockNebulaService = {
      executeQuery: jest.fn(),
      findRelatedNodes: jest.fn(),
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

  describe('searchCode', () => {
    it('should perform hybrid search combining semantic and keyword results', async () => {
      const query = 'authentication function';
      const options = { maxResults: 10 };

      const semanticResults = [
        { id: '1', score: 0.9, content: 'auth function', metadata: {} },
        { id: '2', score: 0.8, content: 'login method', metadata: {} },
      ];

      const keywordResults = [
        { id: '3', score: 0.7, content: 'authenticate user', metadata: {} },
        { id: '1', score: 0.6, content: 'auth function', metadata: {} }, // Duplicate
      ];

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue(semanticResults);
      mockQdrantService.searchWithFilter.mockResolvedValue(keywordResults);

      const result = await hybridSearchService.searchCode(query, options);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(3); // Should deduplicate
      expect(mockSemanticSearchService.searchSimilarCode).toHaveBeenCalledWith(query, options);
      expect(mockQdrantService.searchWithFilter).toHaveBeenCalled();
    });

    it('should handle empty semantic results gracefully', async () => {
      const query = 'test query';
      const options = { maxResults: 10 };

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue([]);
      mockQdrantService.searchWithFilter.mockResolvedValue([
        { id: '1', score: 0.5, content: 'test content', metadata: {} },
      ]);

      const result = await hybridSearchService.searchCode(query, options);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('1');
    });

    it('should handle search errors gracefully', async () => {
      const query = 'test query';
      const options = { maxResults: 10 };

      mockSemanticSearchService.searchSimilarCode.mockRejectedValue(new Error('Search failed'));
      mockQdrantService.searchWithFilter.mockResolvedValue([]);

      const result = await hybridSearchService.searchCode(query, options);

      expect(result.results).toHaveLength(0);
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('searchWithContext', () => {
    it('should enhance results with graph context', async () => {
      const query = 'database connection';
      const options = { includeContext: true };

      const searchResults = [
        { id: '1', score: 0.9, content: 'db.connect()', metadata: { filePath: '/src/db.ts' } },
      ];

      const graphContext = [
        { id: '2', relationship: 'calls', content: 'connection.query()' },
      ];

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue(searchResults);
      mockNebulaService.findRelatedNodes.mockResolvedValue(graphContext);

      const result = await hybridSearchService.searchWithContext(query, options);

      expect(result.results).toHaveLength(1);
      expect(result.context).toBeDefined();
      expect(mockNebulaService.findRelatedNodes).toHaveBeenCalled();
    });
  });

  describe('searchByLanguage', () => {
    it('should filter results by programming language', async () => {
      const query = 'function definition';
      const language = 'typescript';
      const options = { maxResults: 10 };

      const results = [
        { id: '1', score: 0.9, content: 'function test()', metadata: { language: 'typescript' } },
        { id: '2', score: 0.8, content: 'def test():', metadata: { language: 'python' } },
      ];

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue(results);

      const result = await hybridSearchService.searchByLanguage(query, language, options);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].metadata.language).toBe('typescript');
    });
  });

  describe('searchSimilarFunctions', () => {
    it('should find functions with similar signatures', async () => {
      const functionSignature = 'async function processData(data: any[]): Promise<void>';
      const options = { maxResults: 5 };

      const results = [
        { id: '1', score: 0.95, content: 'async function handleData(items: any[]): Promise<void>', metadata: {} },
      ];

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue(results);

      const result = await hybridSearchService.searchSimilarFunctions(functionSignature, options);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeGreaterThan(0.9);
    });
  });
});