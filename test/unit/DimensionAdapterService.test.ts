import { DimensionAdapterService } from '../../src/embedders/DimensionAdapterService';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { EmbedderFactory } from '../../src/embedders/EmbedderFactory';
import { EmbeddingResult } from '../../src/embedders/BaseEmbedder';

describe('DimensionAdapterService', () => {
  let dimensionAdapterService: DimensionAdapterService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockEmbedderFactory = {
      getEmbedder: jest.fn(),
      embed: jest.fn(),
      getAvailableProviders: jest.fn(),
      getProviderInfo: jest.fn(),
      autoSelectProvider: jest.fn(),
      registerProvider: jest.fn(),
      getRegisteredProviders: jest.fn(),
    } as any;

    // Set up default configuration
    mockConfigService.get.mockReturnValue({
      embedding: {
        qualityWeight: 0.7,
        performanceWeight: 0.3,
        dimensionRules: {
          'code_openai': 1536,
          'documentation_ollama': 768,
          'javascript': 512,
          'python': 768,
        },
      },
    });

    dimensionAdapterService = new DimensionAdapterService(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockEmbedderFactory
    );
  });

  describe('Constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(dimensionAdapterService).toBeInstanceOf(DimensionAdapterService);
      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
    });

    it('should initialize all adaptation strategies', () => {
      const strategies = (dimensionAdapterService as any).strategies;
      
      expect(strategies.has('pca')).toBe(true);
      expect(strategies.has('interpolation')).toBe(true);
      expect(strategies.has('truncation')).toBe(true);
      expect(strategies.has('padding')).toBe(true);
      expect(strategies.has('average_pooling')).toBe(true);
      expect(strategies.size).toBe(5);
    });

    it('should initialize strategies with correct properties', () => {
      const strategies = (dimensionAdapterService as any).strategies;
      
      const pca = strategies.get('pca');
      expect(pca.name).toBe('PCA');
      expect(pca.qualityScore).toBe(0.89);
      expect(pca.performanceScore).toBe(0.75);
      expect(typeof pca.adapt).toBe('function');

      const truncation = strategies.get('truncation');
      expect(truncation.name).toBe('Truncation');
      expect(truncation.qualityScore).toBe(0.82);
      expect(truncation.performanceScore).toBe(0.95);
    });
  });

  describe('adaptEmbedding', () => {
    const mockEmbedding: EmbeddingResult = {
      vector: Array.from({ length: 1536 }, () => Math.random()),
      dimensions: 1536,
      model: 'text-embedding-ada-002',
      processingTime: 100,
    };

    it('should return original embedding if dimensions match', async () => {
      const result = await dimensionAdapterService.adaptEmbedding(mockEmbedding, 1536);

      expect(result).toBe(mockEmbedding);
      expect(mockLoggerService.info).not.toHaveBeenCalled();
    });

    it('should adapt embedding to different dimensions', async () => {
      const result = await dimensionAdapterService.adaptEmbedding(mockEmbedding, 768);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'text-embedding-ada-002_adapted_768d',
        processingTime: expect.any(Number),
      });

      expect(result.vector).toHaveLength(768);
      expect(result.processingTime).toBeGreaterThan(mockEmbedding.processingTime);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Adapting embedding dimensions',
        {
          fromDimensions: 1536,
          toDimensions: 768,
          model: 'text-embedding-ada-002',
        }
      );
    });

    it('should upscale embedding dimensions', async () => {
      const smallEmbedding: EmbeddingResult = {
        vector: Array.from({ length: 512 }, () => Math.random()),
        dimensions: 512,
        model: 'small-model',
        processingTime: 50,
      };

      const result = await dimensionAdapterService.adaptEmbedding(smallEmbedding, 1024);

      expect(result.dimensions).toBe(1024);
      expect(result.vector).toHaveLength(1024);
      expect(result.model).toBe('small-model_adapted_1024d');
    });

    it('should throw error when no suitable strategy found', async () => {
      // Mock the strategy selection to return null
      jest.spyOn(dimensionAdapterService as any, 'selectBestStrategy').mockReturnValue(null);

      await expect(dimensionAdapterService.adaptEmbedding(mockEmbedding, 768)).rejects.toThrow(
        'No suitable adaptation strategy found for 1536 -> 768'
      );
    });

    it('should handle adaptation errors', async () => {
      const errorEmbedding: EmbeddingResult = {
        vector: [],
        dimensions: 1536,
        model: 'test-model',
        processingTime: 100,
      };

      // Mock the strategy to throw an error
      jest.spyOn(dimensionAdapterService as any, 'selectBestStrategy').mockReturnValue({
        adapt: jest.fn().mockImplementation(() => {
          throw new Error('Adaptation failed');
        }),
      });

      await expect(dimensionAdapterService.adaptEmbedding(errorEmbedding, 768)).rejects.toThrow(
        'Adaptation failed'
      );

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Embedding adaptation failed: Adaptation failed',
        }),
        { component: 'DimensionAdapterService', operation: 'adaptEmbedding' }
      );
    });

    it('should log adaptation completion details', async () => {
      const result = await dimensionAdapterService.adaptEmbedding(mockEmbedding, 768);

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Embedding adaptation completed',
        expect.objectContaining({
          fromDimensions: 1536,
          toDimensions: 768,
          strategy: expect.any(String),
          qualityScore: expect.any(Number),
        })
      );
    });
  });

  describe('getOptimalDimensions', () => {
    it('should use specific content type and provider rules', async () => {
      const dimensions = await dimensionAdapterService.getOptimalDimensions('code', 'openai');

      expect(dimensions).toBe(1536);
    });

    it('should use content type specific rules', async () => {
      const dimensions = await dimensionAdapterService.getOptimalDimensions('javascript', 'unknown');

      expect(dimensions).toBe(512);
    });

    it('should use provider specific rules', async () => {
      const dimensions = await dimensionAdapterService.getOptimalDimensions('generic', 'ollama');

      expect(dimensions).toBe(768);
    });

    it('should use default dimensions when no specific rules exist', async () => {
      const dimensions = await dimensionAdapterService.getOptimalDimensions('unknown', 'unknown');

      expect(dimensions).toBe(768); // Default for 'generic'
    });

    it('should handle missing dimension rules configuration', async () => {
      mockConfigService.get.mockReturnValue({
        embedding: {},
      });

      const dimensions = await dimensionAdapterService.getOptimalDimensions('code', 'openai');

      expect(dimensions).toBe(768); // Default for 'code'
    });

    it('should use default dimensions for different content types', async () => {
      const testCases = [
        { contentType: 'code', expected: 768 },
        { contentType: 'documentation', expected: 1536 },
        { contentType: 'comment', expected: 512 },
        { contentType: 'string', expected: 384 },
        { contentType: 'identifier', expected: 256 },
        { contentType: 'generic', expected: 768 },
      ];

      for (const testCase of testCases) {
        const dimensions = await dimensionAdapterService.getOptimalDimensions(testCase.contentType, 'unknown');
        expect(dimensions).toBe(testCase.expected);
      }
    });
  });

  describe('canAdapt', () => {
    it('should return true when adaptation is possible', async () => {
      const canAdapt = await dimensionAdapterService.canAdapt(1536, 768);
      expect(canAdapt).toBe(true);
    });

    it('should return false when no suitable strategy found', async () => {
      // Mock the strategy selection to return null
      jest.spyOn(dimensionAdapterService as any, 'selectBestStrategy').mockReturnValue(null);

      const canAdapt = await dimensionAdapterService.canAdapt(1536, 768);
      expect(canAdapt).toBe(false);
    });
  });

  describe('adaptBatch', () => {
    const mockEmbeddings: EmbeddingResult[] = [
      {
        vector: Array.from({ length: 1536 }, () => Math.random()),
        dimensions: 1536,
        model: 'model1',
        processingTime: 100,
      },
      {
        vector: Array.from({ length: 1536 }, () => Math.random()),
        dimensions: 1536,
        model: 'model2',
        processingTime: 120,
      },
    ];

    it('should adapt batch of embeddings', async () => {
      const result = await dimensionAdapterService.adaptBatch(mockEmbeddings, 768);

      expect(result).toHaveLength(2);
      result.forEach((embedding, index) => {
        expect(embedding.dimensions).toBe(768);
        expect(embedding.vector).toHaveLength(768);
        expect(embedding.model).toBe(`${mockEmbeddings[index].model}_adapted_768d`);
        expect(embedding.processingTime).toBeGreaterThan(mockEmbeddings[index].processingTime);
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Adapting batch embeddings',
        {
          count: 2,
          targetDimensions: 768,
        }
      );
    });

    it('should skip adaptation for embeddings with matching dimensions', async () => {
      const mixedEmbeddings: EmbeddingResult[] = [
        { ...mockEmbeddings[0] },
        {
          vector: Array.from({ length: 768 }, () => Math.random()),
          dimensions: 768,
          model: 'already-correct',
          processingTime: 80,
        },
      ];

      const result = await dimensionAdapterService.adaptBatch(mixedEmbeddings, 768);

      expect(result).toHaveLength(2);
      expect(result[0].dimensions).toBe(768);
      expect(result[0].model).toBe('model1_adapted_768d');
      expect(result[1].dimensions).toBe(768);
      expect(result[1].model).toBe('already-correct'); // Should not be modified
    });

    it('should throw error when no suitable strategy for batch adaptation', async () => {
      // Mock the strategy selection to return null
      jest.spyOn(dimensionAdapterService as any, 'selectBestStrategy').mockReturnValue(null);

      await expect(dimensionAdapterService.adaptBatch(mockEmbeddings, 768)).rejects.toThrow(
        'No suitable adaptation strategy found for batch adaptation'
      );
    });

    it('should handle batch adaptation errors', async () => {
      const errorEmbeddings: EmbeddingResult[] = [
        {
          vector: [],
          dimensions: 1536,
          model: 'error-model',
          processingTime: 100,
        },
      ];

      // Mock the strategy to throw an error
      jest.spyOn(dimensionAdapterService as any, 'selectBestStrategy').mockReturnValue({
        adapt: jest.fn().mockImplementation(() => {
          throw new Error('Batch adaptation failed');
        }),
      });

      await expect(dimensionAdapterService.adaptBatch(errorEmbeddings, 768)).rejects.toThrow(
        'Batch adaptation failed'
      );

      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Batch embedding adaptation failed: Batch adaptation failed',
        }),
        { component: 'DimensionAdapterService', operation: 'adaptBatch' }
      );
    });
  });

  describe('getAdaptationStats', () => {
    it('should return adaptation statistics', async () => {
      const stats = await dimensionAdapterService.getAdaptationStats();

      expect(stats).toEqual({
        totalAdaptations: 1250,
        averageQualityScore: 0.87,
        averagePerformanceScore: 0.92,
        topStrategies: [
          { name: 'pca', usageCount: 450, averageQuality: 0.89 },
          { name: 'interpolation', usageCount: 380, averageQuality: 0.85 },
          { name: 'truncation', usageCount: 320, averageQuality: 0.82 },
          { name: 'padding', usageCount: 100, averageQuality: 0.78 },
        ],
      });
    });
  });

  describe('Strategy Selection', () => {
    it('should select best strategy based on configuration weights', async () => {
      // Test with different weight configurations
      mockConfigService.get.mockReturnValue({
        embedding: {
          qualityWeight: 0.9,
          performanceWeight: 0.1,
        },
      });

      // Reinitialize to apply new config
      dimensionAdapterService = new DimensionAdapterService(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService,
        mockEmbedderFactory
      );

      const strategies = Array.from((dimensionAdapterService as any).strategies.values());
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should handle strategy constraints', async () => {
      // Test the canStrategyHandle method
      const canHandle = (dimensionAdapterService as any).canStrategyHandle(
        { name: 'test' },
        1536,
        768
      );

      expect(canHandle).toBe(true);
    });
  });

  describe('Adaptation Strategies', () => {
    describe('PCA Adaptation', () => {
      it('should reduce dimensions using PCA-like approach', async () => {
        const pcaStrategy = (dimensionAdapterService as any).strategies.get('pca');
        const largeVector = Array.from({ length: 1536 }, () => Math.random());
        
        const adapted = pcaStrategy.adapt(largeVector, 768);
        
        expect(adapted).toHaveLength(768);
        expect(adapted).not.toEqual(largeVector.slice(0, 768)); // Should be different from simple truncation
      });

      it('should handle upscaling with padding when necessary', async () => {
        const pcaStrategy = (dimensionAdapterService as any).strategies.get('pca');
        const smallVector = Array.from({ length: 512 }, () => Math.random());
        
        const adapted = pcaStrategy.adapt(smallVector, 768);
        
        expect(adapted).toHaveLength(768);
      });
    });

    describe('Interpolation Adaptation', () => {
      it('should perform linear interpolation for dimension changes', async () => {
        const interpolationStrategy = (dimensionAdapterService as any).strategies.get('interpolation');
        const vector = [1, 2, 3, 4, 5];
        
        const adapted = interpolationStrategy.adapt(vector, 3);
        
        expect(adapted).toHaveLength(3);
        expect(adapted[0]).toBe(1);
        expect(adapted[adapted.length - 1]).toBe(5);
      });

      it('should handle upscaling through interpolation', async () => {
        const interpolationStrategy = (dimensionAdapterService as any).strategies.get('interpolation');
        const vector = [1, 2, 3];
        
        const adapted = interpolationStrategy.adapt(vector, 5);
        
        expect(adapted).toHaveLength(5);
        expect(adapted[0]).toBe(1);
        expect(adapted[adapted.length - 1]).toBe(3);
      });
    });

    describe('Truncation Adaptation', () => {
      it('should truncate vectors for dimension reduction', async () => {
        const truncationStrategy = (dimensionAdapterService as any).strategies.get('truncation');
        const largeVector = Array.from({ length: 1000 }, (_, i) => i);
        
        const adapted = truncationStrategy.adapt(largeVector, 500);
        
        expect(adapted).toHaveLength(500);
        expect(adapted).toEqual(largeVector.slice(0, 500));
      });

      it('should return original vector when target dimensions are larger', async () => {
        const truncationStrategy = (dimensionAdapterService as any).strategies.get('truncation');
        const smallVector = [1, 2, 3];
        
        const adapted = truncationStrategy.adapt(smallVector, 500);
        
        expect(adapted).toEqual(smallVector);
      });
    });

    describe('Padding Adaptation', () => {
      it('should pad vectors with zeros for upscaling', async () => {
        const paddingStrategy = (dimensionAdapterService as any).strategies.get('padding');
        const smallVector = [1, 2, 3];
        
        const adapted = paddingStrategy.adapt(smallVector, 6);
        
        expect(adapted).toHaveLength(6);
        expect(adapted.slice(0, 3)).toEqual(smallVector);
        expect(adapted.slice(3)).toEqual([0, 0, 0]);
      });

      it('should truncate vectors when target dimensions are smaller', async () => {
        const paddingStrategy = (dimensionAdapterService as any).strategies.get('padding');
        const largeVector = [1, 2, 3, 4, 5, 6];
        
        const adapted = paddingStrategy.adapt(largeVector, 3);
        
        expect(adapted).toHaveLength(3);
        expect(adapted).toEqual([1, 2, 3]);
      });
    });

    describe('Average Pooling Adaptation', () => {
      it('should perform average pooling for dimension reduction', async () => {
        const averagePoolingStrategy = (dimensionAdapterService as any).strategies.get('average_pooling');
        const vector = [1, 2, 3, 4, 5, 6, 7, 8];
        
        const adapted = averagePoolingStrategy.adapt(vector, 4);
        
        expect(adapted).toHaveLength(4);
        // Check that averages are calculated correctly
        expect(adapted[0]).toBe(2.5); // (1+2+3+4)/4
        expect(adapted[1]).toBe(6.5); // (5+6+7+8)/4
      });

      it('should handle upscaling with padding', async () => {
        const averagePoolingStrategy = (dimensionAdapterService as any).strategies.get('average_pooling');
        const smallVector = [1, 2];
        
        const adapted = averagePoolingStrategy.adapt(smallVector, 4);
        
        expect(adapted).toHaveLength(4);
        expect(adapted[0]).toBe(1);
        expect(adapted[1]).toBe(2);
        expect(adapted.slice(2)).toEqual([0, 0]); // Padded with zeros
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        new DimensionAdapterService(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService,
          mockEmbedderFactory
        );
      }).toThrow('Configuration error');
    });

    it('should handle invalid dimension values', async () => {
      const mockEmbedding: EmbeddingResult = {
        vector: [1, 2, 3],
        dimensions: 3,
        model: 'test',
        processingTime: 100,
      };

      // Test with zero dimensions
      await expect(dimensionAdapterService.adaptEmbedding(mockEmbedding, 0)).rejects.toThrow();

      // Test with negative dimensions
      await expect(dimensionAdapterService.adaptEmbedding(mockEmbedding, -100)).rejects.toThrow();
    });

    it('should handle empty vector adaptation', async () => {
      const emptyEmbedding: EmbeddingResult = {
        vector: [],
        dimensions: 0,
        model: 'empty',
        processingTime: 100,
      };

      await expect(dimensionAdapterService.adaptEmbedding(emptyEmbedding, 100)).rejects.toThrow();
    });
  });
});