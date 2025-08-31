import { Container } from 'inversify';
import { SemanticSearchService } from './SemanticSearchService';
import { QdrantService } from '../../database/QdrantService';
import { BaseEmbedder } from '../../embedders/BaseEmbedder';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('SemanticSearchService', () => {
  let container: Container;
  let semanticSearchService: SemanticSearchService;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockEmbedder: jest.Mocked<BaseEmbedder>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockQdrantService = {
      search: jest.fn(),
      searchWithFilter: jest.fn(),
      getPoint: jest.fn(),
      upsert: jest.fn(),
      createCollection: jest.fn(),
    } as any;

    mockEmbedder = {
      embed: jest.fn(),
      embedBatch: jest.fn(),
      getDimensions: jest.fn().mockReturnValue(384),
      getModelName: jest.fn().mockReturnValue('test-model'),
    } as any;

    mockEmbedderFactory = {
      createEmbedder: jest.fn().mockReturnValue(mockEmbedder),
      getAvailableEmbedders: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getEmbeddingConfig: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 384,
        batchSize: 100,
      }),
      getSearchConfig: jest.fn().mockReturnValue({
        maxResults: 50,
        scoreThreshold: 0.1,
        enableReranking: true,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.QdrantService).toConstantValue(mockQdrantService);
    container.bind(TYPES.EmbedderFactory).toConstantValue(mockEmbedderFactory);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.SemanticSearchService).to(SemanticSearchService);

    semanticSearchService = container.get<SemanticSearchService>(TYPES.SemanticSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchSimilarCode', () => {
    it('should search for similar code using embeddings', async () => {
      const query = 'function to authenticate user';
      const options = { maxResults: 10, scoreThreshold: 0.7 };

      const queryEmbedding = [0.1, 0.2, 0.3, 0.4];
      const searchResults = [
        {
          id: '1',
          score: 0.9,
          payload: {
            content: 'function authenticateUser(username, password) { return bcrypt.compare(password, user.hash); }',
            filePath: '/src/auth.ts',
            language: 'typescript',
          }
        },
        {
          id: '2',
          score: 0.8,
          payload: {
            content: 'async function login(credentials) { const user = await authenticate(credentials); }',
            filePath: '/src/login.ts',
            language: 'typescript',
          }
        },
      ];

      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockQdrantService.search.mockResolvedValue(searchResults);

      const result = await semanticSearchService.searchSimilarCode(query, options);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(0.9);
      expect(result[0].content).toContain('authenticateUser');
      expect(mockEmbedder.embed).toHaveBeenCalledWith(query);
      expect(mockQdrantService.search).toHaveBeenCalledWith({
        vector: queryEmbedding,
        limit: options.maxResults,
        score_threshold: options.scoreThreshold,
      });
    });

    it('should handle embedding failures gracefully', async () => {
      const query = 'test query';
      const options = { maxResults: 10 };

      mockEmbedder.embed.mockRejectedValue(new Error('Embedding failed'));

      await expect(semanticSearchService.searchSimilarCode(query, options)).rejects.toThrow('Embedding failed');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should filter results below score threshold', async () => {
      const query = 'test function';
      const options = { maxResults: 10, scoreThreshold: 0.8 };

      const queryEmbedding = [0.1, 0.2, 0.3];
      const searchResults = [
        { id: '1', score: 0.9, payload: { content: 'high score result' } },
        { id: '2', score: 0.7, payload: { content: 'low score result' } },
        { id: '3', score: 0.85, payload: { content: 'medium score result' } },
      ];

      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockQdrantService.search.mockResolvedValue(searchResults);

      const result = await semanticSearchService.searchSimilarCode(query, options);

      expect(result).toHaveLength(2); // Should filter out score 0.7
      expect(result.every(r => r.score >= 0.8)).toBe(true);
    });
  });

  describe('searchByVector', () => {
    it('should search using pre-computed vector', async () => {
      const vector = [0.1, 0.2, 0.3, 0.4];
      const options = { maxResults: 5 };

      const searchResults = [
        { id: '1', score: 0.95, payload: { content: 'vector result 1' } },
        { id: '2', score: 0.88, payload: { content: 'vector result 2' } },
      ];

      mockQdrantService.search.mockResolvedValue(searchResults);

      const result = await semanticSearchService.searchByVector(vector, options);

      expect(result).toHaveLength(2);
      expect(mockQdrantService.search).toHaveBeenCalledWith({
        vector,
        limit: options.maxResults,
      });
    });

    it('should validate vector dimensions', async () => {
      const invalidVector = [0.1, 0.2]; // Wrong dimensions
      const options = { maxResults: 5 };

      await expect(semanticSearchService.searchByVector(invalidVector, options))
        .rejects.toThrow('Vector dimension mismatch');
    });
  });

  describe('searchByText', () => {
    it('should perform text-based search with embedding', async () => {
      const text = 'database connection function';
      const options = { maxResults: 10, includeMetadata: true };

      const textEmbedding = [0.2, 0.4, 0.6, 0.8];
      const searchResults = [
        {
          id: '1',
          score: 0.92,
          payload: {
            content: 'function connectToDatabase() { return new Connection(config); }',
            filePath: '/src/database.ts',
            functionName: 'connectToDatabase',
            lineNumber: 15,
          }
        },
      ];

      mockEmbedder.embed.mockResolvedValue(textEmbedding);
      mockQdrantService.search.mockResolvedValue(searchResults);

      const result = await semanticSearchService.searchByText(text, options);

      expect(result).toHaveLength(1);
      expect(result[0].metadata.functionName).toBe('connectToDatabase');
      expect(result[0].metadata.lineNumber).toBe(15);
    });
  });

  describe('findSimilarFunctions', () => {
    it('should find functions with similar signatures and behavior', async () => {
      const functionCode = 'async function processUserData(userData: UserData): Promise<ProcessedData> { return transform(userData); }';
      const options = { maxResults: 5, similarityThreshold: 0.8 };

      const functionEmbedding = [0.3, 0.6, 0.9, 0.2];
      const similarFunctions = [
        {
          id: '1',
          score: 0.95,
          payload: {
            content: 'async function handleUserInfo(userInfo: UserInfo): Promise<HandledData> { return process(userInfo); }',
            filePath: '/src/user-handler.ts',
            functionSignature: 'handleUserInfo(userInfo: UserInfo): Promise<HandledData>',
          }
        },
        {
          id: '2',
          score: 0.87,
          payload: {
            content: 'function transformUserData(data: UserData): TransformedData { return mapper(data); }',
            filePath: '/src/transformer.ts',
            functionSignature: 'transformUserData(data: UserData): TransformedData',
          }
        },
      ];

      mockEmbedder.embed.mockResolvedValue(functionEmbedding);
      mockQdrantService.searchWithFilter.mockResolvedValue(similarFunctions);

      const result = await semanticSearchService.findSimilarFunctions(functionCode, options);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThan(options.similarityThreshold);
      expect(mockQdrantService.searchWithFilter).toHaveBeenCalledWith({
        vector: functionEmbedding,
        limit: options.maxResults,
        filter: {
          must: [
            { key: 'type', match: { value: 'function' } }
          ]
        },
        score_threshold: options.similarityThreshold,
      });
    });
  });

  describe('searchWithContext', () => {
    it('should enhance search with contextual information', async () => {
      const query = 'error handling';
      const context = {
        currentFile: '/src/api/users.ts',
        recentFiles: ['/src/api/auth.ts', '/src/utils/errors.ts'],
        projectType: 'web-api',
      };
      const options = { maxResults: 10 };

      const queryEmbedding = [0.4, 0.8, 0.2, 0.6];
      const contextualResults = [
        {
          id: '1',
          score: 0.91,
          payload: {
            content: 'try { await processUser(); } catch (error) { logger.error(error); throw new ApiError(error); }',
            filePath: '/src/api/users.ts',
            contextRelevance: 0.95, // High relevance due to same file
          }
        },
        {
          id: '2',
          score: 0.85,
          payload: {
            content: 'class ApiError extends Error { constructor(message: string) { super(message); } }',
            filePath: '/src/utils/errors.ts',
            contextRelevance: 0.8, // Medium relevance due to recent file
          }
        },
      ];

      mockEmbedder.embed.mockResolvedValue(queryEmbedding);
      mockQdrantService.searchWithFilter.mockResolvedValue(contextualResults);

      const result = await semanticSearchService.searchWithContext(query, context, options);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThan(result[1].score); // Context-boosted scoring
    });
  });

  describe('getSearchSuggestions', () => {
    it('should provide search suggestions based on indexed content', async () => {
      const partialQuery = 'auth';
      const suggestions = await semanticSearchService.getSearchSuggestions(partialQuery);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('authentication');
      expect(suggestions).toContain('authorization');
      expect(suggestions).toContain('authenticate user');
    });

    it('should return empty array for very short queries', async () => {
      const partialQuery = 'a';
      const suggestions = await semanticSearchService.getSearchSuggestions(partialQuery);

      expect(suggestions).toEqual([]);
    });
  });

  describe('analyzeQueryIntent', () => {
    it('should analyze query intent and suggest search strategies', async () => {
      const query = 'how to implement JWT authentication in Express.js';
      const analysis = await semanticSearchService.analyzeQueryIntent(query);

      expect(analysis.intent).toBe('implementation');
      expect(analysis.technologies).toContain('jwt');
      expect(analysis.technologies).toContain('express');
      expect(analysis.suggestedFilters.language).toContain('javascript');
      expect(analysis.suggestedFilters.language).toContain('typescript');
    });

    it('should identify debugging queries', async () => {
      const query = 'why is my database connection failing';
      const analysis = await semanticSearchService.analyzeQueryIntent(query);

      expect(analysis.intent).toBe('debugging');
      expect(analysis.keywords).toContain('database');
      expect(analysis.keywords).toContain('connection');
      expect(analysis.keywords).toContain('failing');
    });
  });
});