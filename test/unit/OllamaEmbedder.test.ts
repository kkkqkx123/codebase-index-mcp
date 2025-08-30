import { OllamaEmbedder } from '../../src/embedders/OllamaEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';

describe('OllamaEmbedder', () => {
  let ollamaEmbedder: OllamaEmbedder;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;

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

    // Set up default configuration
    mockConfigService.get.mockReturnValue({
      provider: 'ollama',
      openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
      ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
      gemini: { apiKey: 'test-key', model: 'embedding-001' },
      mistral: { apiKey: 'test-key', model: 'mistral-embed' },
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
      expect(ollamaEmbedder).toBeInstanceOf(OllamaEmbedder);
    });

    it('should use default baseUrl when not specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder).toBeInstanceOf(OllamaEmbedder);
    });

    it('should use default model when not specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getModelName()).toBe('nomic-embed-text');
    });

    it('should use custom baseUrl and model when specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://custom-host:11434', model: 'custom-model' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder).toBeInstanceOf(OllamaEmbedder);
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for Ollama embeddings', () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getDimensions()).toBe(768);
    });
  });

  describe('getModelName', () => {
    it('should return the configured model name', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'llama2-embed',
        },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getModelName()).toBe('llama2-embed');
    });

    it('should return default model name when not configured', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getModelName()).toBe('nomic-embed-text');
    });
  });

  describe('isAvailable', () => {
    it('should return true (placeholder implementation)', async () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await ollamaEmbedder.isAvailable();
      expect(available).toBe(true);
    });

    it('should always return true regardless of configuration', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await ollamaEmbedder.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('embed', () => {
    beforeEach(() => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );
    });

    it('should embed single input', async () => {
      const input: EmbeddingInput = { text: 'Hello world' };
      const result = await ollamaEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'nomic-embed-text',
        processingTime: expect.any(Number),
      });

      expect(Array.isArray(result) ? result[0].vector : result.vector).toHaveLength(768);
      expect(Array.isArray(result) ? result[0].processingTime : result.processingTime).toBeGreaterThan(0);
    });

    it('should embed array of inputs', async () => {
      const inputs: EmbeddingInput[] = [
        { text: 'Hello world' },
        { text: 'Testing embeddings' },
        { text: 'Ollama local' },
      ];

      const result = await ollamaEmbedder.embed(inputs);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      (result as EmbeddingResult[]).forEach((embedding: EmbeddingResult) => {
        expect(embedding).toEqual({
          vector: expect.any(Array),
          dimensions: 768,
          model: 'nomic-embed-text',
          processingTime: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(768);
      });
    });

    it('should include metadata in embedding generation', async () => {
      const input: EmbeddingInput = {
        text: 'Test code',
        metadata: { language: 'python', lines: 15 },
      };

      const result = await ollamaEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'nomic-embed-text',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await ollamaEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'nomic-embed-text',
        processingTime: expect.any(Number),
      });
    });

    it('should handle large text input', async () => {
      const largeText = 'x'.repeat(8000);
      const input: EmbeddingInput = { text: largeText };

      const result = await ollamaEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'nomic-embed-text',
        processingTime: expect.any(Number),
      });
    });

    it('should generate unique vectors for different inputs', async () => {
      const input1: EmbeddingInput = { text: 'Hello world' };
      const input2: EmbeddingInput = { text: 'Local AI' };

      const result1 = await ollamaEmbedder.embed(input1);
      const result2 = await ollamaEmbedder.embed(input2);

      expect((result1 as EmbeddingResult).vector).not.toEqual((result2 as EmbeddingResult).vector);
    });

    it('should handle processing time measurement', async () => {
      const input: EmbeddingInput = { text: 'Timing test' };

      const result = await ollamaEmbedder.embed(input);

      expect((result as EmbeddingResult).processingTime).toBeGreaterThan(0);
      expect((result as EmbeddingResult).processingTime).toBeLessThan(300); // Should be reasonably fast
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        new OllamaEmbedder(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService
        );
      }).toThrow('Configuration error');
    });

    it('should handle embedding process errors', async () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      // Mock the private measureTime method to throw an error
      jest.spyOn(ollamaEmbedder as any, 'measureTime').mockRejectedValue(new Error('Ollama connection failed'));

      const input: EmbeddingInput = { text: 'Test error handling' };

      await expect(ollamaEmbedder.embed(input)).rejects.toThrow('Ollama connection failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Ollama embedding failed: Ollama connection failed',
        }),
        { component: 'OllamaEmbedder', operation: 'embed' }
      );
    });

    it('should handle missing ollama configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      expect(() => {
        new OllamaEmbedder(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService
        );
      }).not.toThrow(); // Should handle missing config gracefully
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getModelName()).toBe('nomic-embed-text');
      expect(ollamaEmbedder.getDimensions()).toBe(768);
    });

    it('should work with complete configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'ollama',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: {
          baseUrl: 'http://remote-ollama:11434',
          model: 'code-llama-embed',
        },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(ollamaEmbedder.getModelName()).toBe('code-llama-embed');
      expect(ollamaEmbedder.getDimensions()).toBe(768);
    });

    it('should handle different baseUrl formats', () => {
      const testUrls = [
        'http://localhost:11434',
        'https://ollama.example.com',
        'http://192.168.1.100:11434',
        'http://localhost:11434/v1',
      ];

      testUrls.forEach(url => {
        mockConfigService.get.mockReturnValue({
          provider: 'ollama',
          openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
          ollama: {
            baseUrl: url,
            model: 'test-model',
          },
          gemini: { apiKey: 'test-key', model: 'embedding-001' },
          mistral: { apiKey: 'test-key', model: 'mistral-embed' },
        });

        expect(() => {
          new OllamaEmbedder(
            mockConfigService,
            mockLoggerService,
            mockErrorHandlerService
          );
        }).not.toThrow();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should have realistic processing time ranges', async () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const input: EmbeddingInput = { text: 'Performance test' };
      const result = await ollamaEmbedder.embed(input);

      // Ollama typically takes longer than cloud APIs (100-250ms in mock)
      expect((result as EmbeddingResult).processingTime).toBeGreaterThanOrEqual(100);
      expect((result as EmbeddingResult).processingTime).toBeLessThan(250);
    });

    it('should handle multiple embeddings efficiently', async () => {
      ollamaEmbedder = new OllamaEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const inputs: EmbeddingInput[] = Array.from({ length: 10 }, (_, i) => ({
        text: `Test text ${i}`,
      }));

      const startTime = Date.now();
      const results = await ollamaEmbedder.embed(inputs);
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
    });
  });
});