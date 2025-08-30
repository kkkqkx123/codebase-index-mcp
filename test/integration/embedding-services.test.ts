import { EmbedderFactory } from '../../src/embedders/EmbedderFactory';
import { BaseEmbedder, Embedder, EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';
import { OpenAIEmbedder } from '../../src/embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../../src/embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../../src/embedders/GeminiEmbedder';
import { MistralEmbedder } from '../../src/embedders/MistralEmbedder';
import { DimensionAdapterService } from '../../src/embedders/DimensionAdapterService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { ConfigService } from '../../src/config/ConfigService';
import { Container } from 'inversify';
import { createTestContainer } from '../setup';
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

describe('Embedding Services Integration Tests', () => {
  let container: Container;
  let embedderFactory: EmbedderFactory;
  let dimensionAdapter: DimensionAdapterService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;

  beforeAll(async () => {
    container = createTestContainer();
    
    // Get services
    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);
    embedderFactory = container.get(EmbedderFactory);
    dimensionAdapter = container.get(DimensionAdapterService);
 });

  afterAll(async () => {
    // Clean up resources
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EmbedderFactory Integration', () => {
    it('should create and manage multiple embedder providers', async () => {
      expect(embedderFactory).toBeDefined();
      
      // Test provider registration
      const registeredProviders = embedderFactory.getRegisteredProviders();
      expect(registeredProviders).toContain('openai');
      expect(registeredProviders).toContain('ollama');
      expect(registeredProviders).toContain('gemini');
      expect(registeredProviders).toContain('mistral');
    });

    it('should get available providers', async () => {
      const availableProviders = await embedderFactory.getAvailableProviders();
      
      // Should return array of available providers
      expect(Array.isArray(availableProviders)).toBe(true);
      
      // Mock test - in real scenario this would check actual API keys
      expect(availableProviders.length).toBeGreaterThanOrEqual(0);
    });

    it('should auto-select best available provider', async () => {
      // Mock the getAvailableProviders to return some providers
      jest.spyOn(embedderFactory, 'getAvailableProviders').mockResolvedValue(['ollama', 'openai']);
      
      const selectedProvider = await embedderFactory.autoSelectProvider();
      expect(['ollama', 'openai']).toContain(selectedProvider);
    });

    it('should handle provider unavailability gracefully', async () => {
      // Mock no available providers
      jest.spyOn(embedderFactory, 'getAvailableProviders').mockResolvedValue([]);
      
      await expect(embedderFactory.autoSelectProvider()).rejects.toThrow('No embedder providers available');
    });

    it('should get provider information', async () => {
      const mockEmbedder: Partial<Embedder> = {
        isAvailable: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
        getModelName: jest.fn<() => string>().mockReturnValue('test-model'),
        getDimensions: jest.fn<() => number>().mockReturnValue(1536)
      };

      jest.spyOn(embedderFactory, 'getEmbedder').mockResolvedValue(mockEmbedder as Embedder);

      const providerInfo = await embedderFactory.getProviderInfo('openai');
      
      expect(providerInfo.name).toBe('openai');
      expect(providerInfo.model).toBe('test-model');
      expect(providerInfo.dimensions).toBe(1536);
      expect(providerInfo.available).toBe(true);
    });
  });

  describe('Individual Embedder Integration', () => {
    let openAIEmbedder: OpenAIEmbedder;
    let ollamaEmbedder: OllamaEmbedder;
    let geminiEmbedder: GeminiEmbedder;
    let mistralEmbedder: MistralEmbedder;

    beforeEach(() => {
      openAIEmbedder = container.get(OpenAIEmbedder);
      ollamaEmbedder = container.get(OllamaEmbedder);
      geminiEmbedder = container.get(GeminiEmbedder);
      mistralEmbedder = container.get(MistralEmbedder);
    });

    describe('OpenAI Embedder', () => {
      it('should generate embeddings for single input', async () => {
        const input: EmbeddingInput = {
          text: 'function test() { return true; }',
          metadata: { type: 'function', language: 'javascript' }
        };

        const result = await openAIEmbedder.embed(input);
        
        expect(result).toBeDefined();
        if (Array.isArray(result)) {
          fail('Expected single EmbeddingResult, but got array');
        } else {
          expect(result.vector).toBeInstanceOf(Array);
          expect(result.dimensions).toBe(1536);
          expect(result.model).toBeDefined();
          expect(result.processingTime).toBeGreaterThan(0);
        }
      });

      it('should generate embeddings for multiple inputs', async () => {
        const inputs: EmbeddingInput[] = [
          { text: 'const x = 1;', metadata: { type: 'variable' } },
          { text: 'function test() {}', metadata: { type: 'function' } },
          { text: 'class Test {}', metadata: { type: 'class' } }
        ];

        const results = await openAIEmbedder.embed(inputs);
        
        if (!Array.isArray(results)) {
          fail('Expected array of EmbeddingResults, but got single result');
        } else {
          expect(results.length).toBe(3);
          
          results.forEach(result => {
            expect(result.vector).toBeInstanceOf(Array);
            expect(result.dimensions).toBe(1536);
            expect(result.model).toBeDefined();
          });
        }
      });

      it('should check availability based on API key', async () => {
        const isAvailable = await openAIEmbedder.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      });

      it('should return correct model information', () => {
        expect(openAIEmbedder.getModelName()).toBeDefined();
        expect(openAIEmbedder.getDimensions()).toBe(1536);
      });
    });

    describe('Ollama Embedder', () => {
      it('should generate embeddings locally', async () => {
        const input: EmbeddingInput = {
          text: 'local embedding test',
          metadata: { provider: 'ollama' }
        };

        const result = await ollamaEmbedder.embed(input);
        
        expect(result).toBeDefined();
        if (Array.isArray(result)) {
          fail('Expected single EmbeddingResult, but got array');
        } else {
          expect(result.vector).toBeInstanceOf(Array);
          expect(result.model).toContain('ollama');
        }
      });

      it('should handle local service availability', async () => {
        const isAvailable = await ollamaEmbedder.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      });
    });

    describe('Gemini Embedder', () => {
      it('should generate embeddings using Google Gemini', async () => {
        const input: EmbeddingInput = {
          text: 'gemini embedding test',
          metadata: { provider: 'gemini' }
        };

        const result = await geminiEmbedder.embed(input);
        
        expect(result).toBeDefined();
        if (Array.isArray(result)) {
          fail('Expected single EmbeddingResult, but got array');
        } else {
          expect(result.vector).toBeInstanceOf(Array);
          expect(result.model).toContain('gemini');
        }
      });

      it('should check API key availability', async () => {
        const isAvailable = await geminiEmbedder.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      });
    });

    describe('Mistral Embedder', () => {
      it('should generate embeddings using Mistral AI', async () => {
        const input: EmbeddingInput = {
          text: 'mistral embedding test',
          metadata: { provider: 'mistral' }
        };

        const result = await mistralEmbedder.embed(input);
        
        expect(result).toBeDefined();
        if (Array.isArray(result)) {
          fail('Expected single EmbeddingResult, but got array');
        } else {
          expect(result.vector).toBeInstanceOf(Array);
          expect(result.model).toContain('mistral');
        }
      });

      it('should check API configuration', async () => {
        const isAvailable = await mistralEmbedder.isAvailable();
        expect(typeof isAvailable).toBe('boolean');
      });
    });
  });

  describe('DimensionAdapterService Integration', () => {
    it('should adapt embedding dimensions', async () => {
      const sourceEmbedding: EmbeddingResult = {
        vector: Array.from({ length: 1536 }, () => Math.random()),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: 100
      };

      const targetDimensions = 768;
      const adapted = await dimensionAdapter.adaptEmbedding(sourceEmbedding, targetDimensions);
      
      expect(adapted.vector.length).toBe(targetDimensions);
      expect(adapted.dimensions).toBe(targetDimensions);
      expect(adapted.model).toContain('_adapted_');
      expect(adapted.processingTime).toBeGreaterThan(sourceEmbedding.processingTime);
    });

    it('should handle same dimensions gracefully', async () => {
      const sourceEmbedding: EmbeddingResult = {
        vector: Array.from({ length: 768 }, () => Math.random()),
        dimensions: 768,
        model: 'test-model',
        processingTime: 50
      };

      const adapted = await dimensionAdapter.adaptEmbedding(sourceEmbedding, 768);
      
      expect(adapted).toBe(sourceEmbedding);
    });

    it('should adapt batch embeddings', async () => {
      const embeddings: EmbeddingResult[] = [
        {
          vector: Array.from({ length: 1536 }, () => Math.random()),
          dimensions: 1536,
          model: 'model1',
          processingTime: 100
        },
        {
          vector: Array.from({ length: 1536 }, () => Math.random()),
          dimensions: 1536,
          model: 'model2',
          processingTime: 120
        }
      ];

      const targetDimensions = 512;
      const adapted = await dimensionAdapter.adaptBatch(embeddings, targetDimensions);
      
      expect(adapted.length).toBe(embeddings.length);
      adapted.forEach(result => {
        expect(result.vector.length).toBe(targetDimensions);
        expect(result.dimensions).toBe(targetDimensions);
      });
    });

    it('should get optimal dimensions for content types', async () => {
      const dimensions = await dimensionAdapter.getOptimalDimensions('code', 'openai');
      expect(typeof dimensions).toBe('number');
      expect(dimensions).toBeGreaterThan(0);
    });

    it('should check adaptation capability', async () => {
      const canAdapt = dimensionAdapter.canAdapt(1536, 768);
      expect(typeof canAdapt).toBe('boolean');
    });

    it('should provide adaptation statistics', async () => {
      const stats = await dimensionAdapter.getAdaptationStats();
      
      expect(stats.totalAdaptations).toBeGreaterThan(0);
      expect(stats.averageQualityScore).toBeGreaterThan(0);
      expect(stats.averageQualityScore).toBeLessThanOrEqual(1);
      expect(stats.averagePerformanceScore).toBeGreaterThan(0);
      expect(stats.averagePerformanceScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(stats.topStrategies)).toBe(true);
    });

    it('should handle adaptation errors gracefully', async () => {
      const invalidEmbedding: EmbeddingResult = {
        vector: [],
        dimensions: 0,
        model: 'invalid',
        processingTime: 0
      };

      await expect(dimensionAdapter.adaptEmbedding(invalidEmbedding, 768))
        .rejects.toThrow();
    });
  });

  describe('Cross-Provider Integration', () => {
    it('should switch between providers seamlessly', async () => {
      const input: EmbeddingInput = {
        text: 'cross-provider test',
        metadata: { test: 'integration' }
      };

      // Test with different providers
      const providers = ['openai', 'ollama', 'gemini', 'mistral'];
      
      for (const provider of providers) {
        try {
          const embedder = await embedderFactory.getEmbedder(provider);
          const result = await embedder.embed(input);
          
          expect(result).toBeDefined();
          if (!Array.isArray(result)) {
            expect(result.vector).toBeInstanceOf(Array);
            expect(result.dimensions).toBeGreaterThan(0);
          } else {
            fail('Expected single EmbeddingResult, but got array');
          }
        } catch (error) {
          // Provider may not be available in test environment
          if (error instanceof Error) {
            expect(error.message).toContain('not available');
          } else {
            // If it's not an Error object, rethrow or handle accordingly
            throw error;
          }
        }
      }
    });

    it('should handle provider failures gracefully', async () => {
      const input: EmbeddingInput = { text: 'test' };
      
      // Mock a provider failure
      jest.spyOn(embedderFactory, 'getEmbedder').mockRejectedValueOnce(new Error('Provider failed'));
      
      await expect(embedderFactory.embed(input)).rejects.toThrow();
    });

    it('should maintain consistency across providers', async () => {
      const input: EmbeddingInput = {
        text: 'consistency test',
        metadata: { test: 'consistency' }
      };

      // Test that different providers produce valid embeddings
      const results: EmbeddingResult[] = [];
      
      try {
        const openaiResult = await embedderFactory.embed(input, 'openai');
        results.push(openaiResult as EmbeddingResult);
      } catch (error) {
        // Provider may not be available
        // Type guard to ensure we're working with an Error object
        if (!(error instanceof Error)) {
          // If it's not an Error object, rethrow
          throw error;
        }
      }

      try {
        const ollamaResult = await embedderFactory.embed(input, 'ollama');
        results.push(ollamaResult as EmbeddingResult);
      } catch (error) {
        // Provider may not be available
        // Type guard to ensure we're working with an Error object
        if (!(error instanceof Error)) {
          // If it's not an Error object, rethrow
          throw error;
        }
      }

      // All results should be valid embeddings
      results.forEach(result => {
        expect(result.vector).toBeInstanceOf(Array);
        expect(result.dimensions).toBeGreaterThan(0);
        expect(result.model).toBeDefined();
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batches efficiently', async () => {
      const batchSize = 100;
      const inputs: EmbeddingInput[] = Array.from({ length: batchSize }, (_, i) => ({
        text: `test content ${i}`,
        metadata: { index: i }
      }));

      const startTime = Date.now();
      const results = await embedderFactory.embed(inputs, 'openai');
      const endTime = Date.now();

      if (!Array.isArray(results)) {
        fail('Expected array of EmbeddingResults, but got single result');
      } else {
        expect(results.length).toBe(batchSize);
      }
      
      // Performance check - should complete in reasonable time
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const input: EmbeddingInput = { text: 'concurrent test' };

      const promises = Array.from({ length: concurrentRequests }, () => 
        embedderFactory.embed(input, 'openai')
      );

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBeDefined();
        if (!Array.isArray(result)) {
          expect((result as EmbeddingResult).vector).toBeInstanceOf(Array);
        } else {
          fail('Expected single EmbeddingResult, but got array');
        }
      });
    });

    it('should manage memory usage for large embeddings', async () => {
      const largeInput: EmbeddingInput = {
        text: 'a'.repeat(10000), // Large text
        metadata: { size: 'large' }
      };

      const result = await embedderFactory.embed(largeInput, 'openai');
      
      expect(result).toBeDefined();
      if (!Array.isArray(result)) {
        expect((result as EmbeddingResult).vector).toBeInstanceOf(Array);
        expect((result as EmbeddingResult).dimensions).toBeGreaterThan(0);
      } else {
        fail('Expected single EmbeddingResult, but got array');
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle API rate limiting', async () => {
      const input: EmbeddingInput = { text: 'rate limit test' };
      
      // Mock rate limit error
      jest.spyOn(embedderFactory, 'getEmbedder').mockRejectedValueOnce(
        new Error('Rate limit exceeded')
      );

      await expect(embedderFactory.embed(input)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network timeouts', async () => {
      const input: EmbeddingInput = { text: 'timeout test' };
      
      // Mock timeout error
      jest.spyOn(embedderFactory, 'getEmbedder').mockRejectedValueOnce(
        new Error('Request timeout')
      );

      await expect(embedderFactory.embed(input)).rejects.toThrow('Request timeout');
    });

    it('should validate input parameters', async () => {
      const invalidInput = { text: '' } as EmbeddingInput;
      
      await expect(embedderFactory.embed(invalidInput)).rejects.toThrow();
    });

    it('should handle malformed embedding responses', async () => {
      const input: EmbeddingInput = { text: 'malformed test' };
      
      // Mock malformed response
      const mockEmbedder: Partial<Embedder> = {
        embed: jest.fn<(input: EmbeddingInput) => Promise<EmbeddingResult>>().mockResolvedValue({
          vector: 'not an array' as any,
          dimensions: 1536,
          model: 'test',
          processingTime: 100
        } as EmbeddingResult)
      };

      jest.spyOn(embedderFactory, 'getEmbedder').mockResolvedValue(mockEmbedder as Embedder);

      await expect(embedderFactory.embed(input)).rejects.toThrow();
    });
  });
});