import { Container } from 'inversify';
import { ResultFusionEngine } from './ResultFusionEngine';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('ResultFusionEngine', () => {
  let container: Container;
  let resultFusionEngine: ResultFusionEngine;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getFusionConfig: jest.fn().mockReturnValue({
        vectorWeight: 0.6,
        graphWeight: 0.4,
        scoreThreshold: 0.1,
        maxResults: 100,
        deduplicationEnabled: true,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.ResultFusionEngine).to(ResultFusionEngine);

    resultFusionEngine = container.get<ResultFusionEngine>(TYPES.ResultFusionEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fuseResults', () => {
    it('should fuse vector and graph results with weighted scoring', async () => {
      const vectorResults = [
        { id: '1', score: 0.9, payload: { content: 'function test()', filePath: '/src/test.ts' } },
        { id: '2', score: 0.8, payload: { content: 'function main()', filePath: '/src/main.ts' } },
      ];

      const graphResults = [
        { id: '1', properties: { name: 'test', type: 'function', calls: ['helper'] } },
        { id: '3', properties: { name: 'utils', type: 'function', calls: ['test'] } },
      ];

      const fusedResults = await resultFusionEngine.fuseResults(vectorResults, graphResults);

      expect(fusedResults).toHaveLength(3);
      
      // Check that overlapping results (id: '1') have enhanced scores
      const enhancedResult = fusedResults.find(r => r.id === '1');
      expect(enhancedResult).toBeDefined();
      expect(enhancedResult!.score).toBeGreaterThan(0.9);
      expect(enhancedResult!.metadata.sources).toContain('vector');
      expect(enhancedResult!.metadata.sources).toContain('graph');
    });

    it('should handle empty result sets', async () => {
      const vectorResults: any[] = [];
      const graphResults: any[] = [];

      const fusedResults = await resultFusionEngine.fuseResults(vectorResults, graphResults);

      expect(fusedResults).toHaveLength(0);
    });

    it('should deduplicate results based on content similarity', async () => {
      const vectorResults = [
        { id: '1', score: 0.9, payload: { content: 'function test() { return true; }' } },
        { id: '2', score: 0.8, payload: { content: 'function test() { return true; }' } }, // Duplicate content
      ];

      const graphResults: any[] = [];

      const fusedResults = await resultFusionEngine.fuseResults(vectorResults, graphResults);

      expect(fusedResults).toHaveLength(1); // Should deduplicate
      expect(fusedResults[0].id).toBe('1'); // Should keep higher scored result
    });
  });

  describe('rankResults', () => {
    it('should rank results by combined score', async () => {
      const results = [
        { id: '1', score: 0.7, content: 'low score result', metadata: {} },
        { id: '2', score: 0.9, content: 'high score result', metadata: {} },
        { id: '3', score: 0.8, content: 'medium score result', metadata: {} },
      ];

      const rankedResults = await resultFusionEngine.rankResults(results);

      expect(rankedResults).toHaveLength(3);
      expect(rankedResults[0].id).toBe('2'); // Highest score first
      expect(rankedResults[1].id).toBe('3'); // Medium score second
      expect(rankedResults[2].id).toBe('1'); // Lowest score last
    });

    it('should apply relevance boosting based on metadata', async () => {
      const results = [
        { 
          id: '1', 
          score: 0.7, 
          content: 'function test()', 
          metadata: { 
            language: 'typescript',
            recentlyModified: true,
            isMainFunction: true 
          } 
        },
        { 
          id: '2', 
          score: 0.8, 
          content: 'function helper()', 
          metadata: { 
            language: 'javascript',
            recentlyModified: false,
            isMainFunction: false 
          } 
        },
      ];

      const rankedResults = await resultFusionEngine.rankResults(results, {
        boostFactors: {
          recentlyModified: 1.2,
          isMainFunction: 1.1,
          typescript: 1.05,
        }
      });

      expect(rankedResults[0].id).toBe('1'); // Should be boosted above result 2
    });
  });

  describe('mergeResults', () => {
    it('should merge multiple result sets maintaining order', async () => {
      const resultSet1 = [
        { id: '1', score: 0.9, content: 'result 1', metadata: {} },
        { id: '2', score: 0.7, content: 'result 2', metadata: {} },
      ];

      const resultSet2 = [
        { id: '3', score: 0.8, content: 'result 3', metadata: {} },
        { id: '4', score: 0.6, content: 'result 4', metadata: {} },
      ];

      const mergedResults = await resultFusionEngine.mergeResults([resultSet1, resultSet2]);

      expect(mergedResults).toHaveLength(4);
      expect(mergedResults[0].score).toBe(0.9); // Highest score first
      expect(mergedResults[1].score).toBe(0.8);
      expect(mergedResults[2].score).toBe(0.7);
      expect(mergedResults[3].score).toBe(0.6); // Lowest score last
    });

    it('should handle overlapping results across sets', async () => {
      const resultSet1 = [
        { id: '1', score: 0.9, content: 'shared result', metadata: { source: 'set1' } },
      ];

      const resultSet2 = [
        { id: '1', score: 0.8, content: 'shared result', metadata: { source: 'set2' } },
      ];

      const mergedResults = await resultFusionEngine.mergeResults([resultSet1, resultSet2]);

      expect(mergedResults).toHaveLength(1); // Should deduplicate
      expect(mergedResults[0].score).toBe(0.9); // Should keep higher score
      expect(mergedResults[0].metadata.sources).toEqual(['set1', 'set2']);
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should calculate relevance based on multiple factors', async () => {
      const result = {
        id: '1',
        score: 0.8,
        content: 'function authenticate(user, password)',
        metadata: {
          language: 'typescript',
          filePath: '/src/auth/login.ts',
          functionName: 'authenticate',
          complexity: 'medium',
          testCoverage: 0.9,
        }
      };

      const query = 'authentication function';
      const context = {
        preferredLanguages: ['typescript'],
        currentProject: 'auth-service',
        recentFiles: ['/src/auth/login.ts'],
      };

      const relevanceScore = await resultFusionEngine.calculateRelevanceScore(result, query, context);

      expect(relevanceScore).toBeGreaterThan(0.8);
      expect(relevanceScore).toBeLessThanOrEqual(1.0);
    });

    it('should penalize results with low base scores', async () => {
      const result = {
        id: '1',
        score: 0.3, // Low base score
        content: 'function test()',
        metadata: {}
      };

      const query = 'test function';
      const context = {};

      const relevanceScore = await resultFusionEngine.calculateRelevanceScore(result, query, context);

      expect(relevanceScore).toBeLessThan(0.5);
    });
  });

  describe('applyDiversityFiltering', () => {
    it('should ensure result diversity', async () => {
      const results = [
        { id: '1', score: 0.9, content: 'function test1()', metadata: { filePath: '/src/test.ts' } },
        { id: '2', score: 0.85, content: 'function test2()', metadata: { filePath: '/src/test.ts' } },
        { id: '3', score: 0.8, content: 'function main()', metadata: { filePath: '/src/main.ts' } },
        { id: '4', score: 0.75, content: 'function helper()', metadata: { filePath: '/src/utils.ts' } },
      ];

      const diverseResults = await resultFusionEngine.applyDiversityFiltering(results, {
        maxPerFile: 1,
        diversityThreshold: 0.7,
      });

      expect(diverseResults).toHaveLength(3); // Should limit to 1 per file
      expect(diverseResults.map(r => r.metadata.filePath)).toEqual([
        '/src/test.ts',
        '/src/main.ts', 
        '/src/utils.ts'
      ]);
    });
  });
});