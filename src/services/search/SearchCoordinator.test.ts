import { Container } from 'inversify';
import { SearchCoordinator } from './SearchCoordinator';
import { HybridSearchService } from './HybridSearchService';
import { SemanticSearchService } from './SemanticSearchService';
import { RerankingService } from '../reranking/RerankingService';
import { QueryCache } from '../query/QueryCache';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('SearchCoordinator', () => {
  let container: Container;
  let searchCoordinator: SearchCoordinator;
  let mockHybridSearchService: jest.Mocked<HybridSearchService>;
  let mockSemanticSearchService: jest.Mocked<SemanticSearchService>;
  let mockRerankingService: jest.Mocked<RerankingService>;
  let mockQueryCache: jest.Mocked<QueryCache>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockHybridSearchService = {
      searchCode: jest.fn(),
      searchWithContext: jest.fn(),
      searchByLanguage: jest.fn(),
      searchSimilarFunctions: jest.fn(),
    } as any;

    mockSemanticSearchService = {
      searchSimilarCode: jest.fn(),
      searchByVector: jest.fn(),
      searchByText: jest.fn(),
    } as any;

    mockRerankingService = {
      rerankResults: jest.fn(),
      rerankWithContext: jest.fn(),
    } as any;

    mockQueryCache = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      has: jest.fn(),
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
        cacheEnabled: true,
        cacheTtl: 300,
        maxResults: 50,
        rerankingEnabled: true,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.HybridSearchService).toConstantValue(mockHybridSearchService);
    container.bind(TYPES.SemanticSearchService).toConstantValue(mockSemanticSearchService);
    container.bind(TYPES.RerankingService).toConstantValue(mockRerankingService);
    container.bind(TYPES.QueryCache).toConstantValue(mockQueryCache);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.SearchCoordinator).to(SearchCoordinator);

    searchCoordinator = container.get<SearchCoordinator>(TYPES.SearchCoordinator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should coordinate search across multiple services', async () => {
      const query = 'authentication logic';
      const options = { maxResults: 10, includeReranking: true };

      const searchResults = {
        results: [
          { id: '1', score: 0.9, content: 'auth function', metadata: {} },
          { id: '2', score: 0.8, content: 'login method', metadata: {} },
        ],
        totalCount: 2,
        searchTime: 100,
      };

      const rerankedResults = {
        results: [
          { id: '2', score: 0.95, content: 'login method', metadata: {} },
          { id: '1', score: 0.85, content: 'auth function', metadata: {} },
        ],
        totalCount: 2,
        searchTime: 120,
      };

      mockQueryCache.has.mockReturnValue(false);
      mockHybridSearchService.searchCode.mockResolvedValue(searchResults);
      mockRerankingService.rerankResults.mockResolvedValue(rerankedResults);

      const result = await searchCoordinator.search(query, options);

      expect(result).toEqual(rerankedResults);
      expect(mockHybridSearchService.searchCode).toHaveBeenCalledWith(query, options);
      expect(mockRerankingService.rerankResults).toHaveBeenCalledWith(searchResults.results, query);
      expect(mockQueryCache.set).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      const query = 'cached query';
      const options = { maxResults: 10 };

      const cachedResults = {
        results: [{ id: '1', score: 0.9, content: 'cached result', metadata: {} }],
        totalCount: 1,
        searchTime: 5,
      };

      mockQueryCache.has.mockReturnValue(true);
      mockQueryCache.get.mockReturnValue(cachedResults);

      const result = await searchCoordinator.search(query, options);

      expect(result).toEqual(cachedResults);
      expect(mockHybridSearchService.searchCode).not.toHaveBeenCalled();
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Cache hit for query', { query });
    });

    it('should handle search errors gracefully', async () => {
      const query = 'error query';
      const options = { maxResults: 10 };

      mockQueryCache.has.mockReturnValue(false);
      mockHybridSearchService.searchCode.mockRejectedValue(new Error('Search failed'));

      await expect(searchCoordinator.search(query, options)).rejects.toThrow('Search failed');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('searchWithFilters', () => {
    it('should apply filters to search results', async () => {
      const query = 'test function';
      const filters = {
        language: 'typescript',
        fileType: '.ts',
        minScore: 0.7,
      };

      const searchResults = {
        results: [
          { id: '1', score: 0.9, content: 'test()', metadata: { language: 'typescript', filePath: 'test.ts' } },
          { id: '2', score: 0.6, content: 'test()', metadata: { language: 'javascript', filePath: 'test.js' } },
          { id: '3', score: 0.8, content: 'test()', metadata: { language: 'typescript', filePath: 'test.py' } },
        ],
        totalCount: 3,
        searchTime: 100,
      };

      mockQueryCache.has.mockReturnValue(false);
      mockHybridSearchService.searchCode.mockResolvedValue(searchResults);

      const result = await searchCoordinator.searchWithFilters(query, filters);

      expect(result.results).toHaveLength(1); // Only one result should pass all filters
      expect(result.results[0].id).toBe('1');
    });
  });

  describe('searchSimilarCode', () => {
    it('should find similar code snippets', async () => {
      const codeSnippet = 'function authenticate(user, password) { return bcrypt.compare(password, user.hash); }';
      const options = { maxResults: 5 };

      const similarResults = {
        results: [
          { id: '1', score: 0.95, content: 'function login(username, pwd) { return bcrypt.verify(pwd, user.password); }', metadata: {} },
        ],
        totalCount: 1,
        searchTime: 80,
      };

      mockSemanticSearchService.searchSimilarCode.mockResolvedValue(similarResults.results);

      const result = await searchCoordinator.searchSimilarCode(codeSnippet, options);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBeGreaterThan(0.9);
    });
  });

  describe('searchByContext', () => {
    it('should search with contextual information', async () => {
      const query = 'database query';
      const context = {
        currentFile: '/src/models/User.ts',
        projectType: 'web-api',
        recentFiles: ['/src/database/connection.ts'],
      };

      const contextualResults = {
        results: [
          { id: '1', score: 0.9, content: 'User.findById()', metadata: { filePath: '/src/models/User.ts' } },
        ],
        totalCount: 1,
        searchTime: 90,
      };

      mockHybridSearchService.searchWithContext.mockResolvedValue(contextualResults);

      const result = await searchCoordinator.searchByContext(query, context);

      expect(result).toEqual(contextualResults);
      expect(mockHybridSearchService.searchWithContext).toHaveBeenCalledWith(query, expect.objectContaining(context));
    });
  });

  describe('getSearchSuggestions', () => {
    it('should provide search suggestions based on partial query', async () => {
      const partialQuery = 'auth';
      const suggestions = await searchCoordinator.getSearchSuggestions(partialQuery);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('authentication');
      expect(suggestions).toContain('authorization');
    });

    it('should return empty array for very short queries', async () => {
      const partialQuery = 'a';
      const suggestions = await searchCoordinator.getSearchSuggestions(partialQuery);

      expect(suggestions).toEqual([]);
    });
  });
});