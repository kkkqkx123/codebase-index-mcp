import { MistralEmbedder } from '../../src/embedders/MistralEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';

describe('MistralEmbedder', () => {
  let mistralEmbedder: MistralEmbedder;
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
      provider: 'mistral',
      openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
      ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
      gemini: { apiKey: 'test-key', model: 'embedding-001' },
      mistral: { apiKey: 'test-mistral-api-key', model: 'mistral-embed' },
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
      expect(mistralEmbedder).toBeInstanceOf(MistralEmbedder);
    });

    it('should use default model when not specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'test-key',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getModelName()).toBe('mistral-embed');
    });

    it('should use custom model when specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'test-key',
          model: 'mistral-embed-v2',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getModelName()).toBe('mistral-embed-v2');
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for Mistral embeddings', () => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getDimensions()).toBe(1024);
    });
  });

  describe('getModelName', () => {
    it('should return the configured model name', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'test-key',
          model: 'mistral-embed-large',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getModelName()).toBe('mistral-embed-large');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is available', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'valid-mistral-api-key',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await mistralEmbedder.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API key is empty', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: '',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await mistralEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {},
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await mistralEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is whitespace only', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: '   ',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await mistralEmbedder.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('embed', () => {
    beforeEach(() => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );
    });

    it('should embed single input', async () => {
      const input: EmbeddingInput = { text: 'Hello world' };
      const result = await mistralEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1024,
        model: 'mistral-embed',
        processingTime: expect.any(Number),
      });

      expect(result.vector).toHaveLength(1024);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should embed array of inputs', async () => {
      const inputs: EmbeddingInput[] = [
        { text: 'Hello world' },
        { text: 'Testing embeddings' },
        { text: 'Mistral AI' },
      ];

      const result = await mistralEmbedder.embed(inputs);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      result.forEach((embedding: EmbeddingResult) => {
        expect(embedding).toEqual({
          vector: expect.any(Array),
          dimensions: 1024,
          model: 'mistral-embed',
          processingTime: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(1024);
      });
    });

    it('should include metadata in embedding generation', async () => {
      const input: EmbeddingInput = {
        text: 'Test code',
        metadata: { language: 'python', library: 'numpy' },
      };

      const result = await mistralEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1024,
        model: 'mistral-embed',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await mistralEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1024,
        model: 'mistral-embed',
        processingTime: expect.any(Number),
      });
    });

    it('should handle large text input', async () => {
      const largeText = 'x'.repeat(7000);
      const input: EmbeddingInput = { text: largeText };

      const result = await mistralEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1024,
        model: 'mistral-embed',
        processingTime: expect.any(Number),
      });
    });

    it('should generate unique vectors for different inputs', async () => {
      const input1: EmbeddingInput = { text: 'Hello world' };
      const input2: EmbeddingInput = { text: 'French AI' };

      const result1 = await mistralEmbedder.embed(input1);
      const result2 = await mistralEmbedder.embed(input2);

      expect(result1.vector).not.toEqual(result2.vector);
    });

    it('should handle processing time measurement', async () => {
      const input: EmbeddingInput = { text: 'Timing test' };

      const result = await mistralEmbedder.embed(input);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(250); // Should be reasonably fast
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        new MistralEmbedder(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService
        );
      }).toThrow('Configuration error');
    });

    it('should handle embedding process errors', async () => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      // Mock the private measureTime method to throw an error
      jest.spyOn(mistralEmbedder as any, 'measureTime').mockRejectedValue(new Error('Mistral API error'));

      const input: EmbeddingInput = { text: 'Test error handling' };

      await expect(mistralEmbedder.embed(input)).rejects.toThrow('Mistral API error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Mistral embedding failed: Mistral API error',
        }),
        { component: 'MistralEmbedder', operation: 'embed' }
      );
    });

    it('should handle missing mistral configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
      });

      expect(() => {
        new MistralEmbedder(
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
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'minimal-key',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getModelName()).toBe('mistral-embed');
      expect(mistralEmbedder.getDimensions()).toBe(1024);
    });

    it('should work with complete configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'mistral',
        openai: { apiKey: 'test-key', model: 'text-embedding-ada-002' },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: {
          apiKey: 'complete-key',
          model: 'mistral-embed-large',
          baseUrl: 'https://api.mistral.ai',
        },
      });

      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mistralEmbedder.getModelName()).toBe('mistral-embed-large');
    });
  });

  describe('Performance Characteristics', () => {
    it('should have realistic processing time ranges', async () => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const input: EmbeddingInput = { text: 'Performance test' };
      const result = await mistralEmbedder.embed(input);

      // Mistral typically has moderate response time (80-200ms in mock)
      expect(result.processingTime).toBeGreaterThanOrEqual(80);
      expect(result.processingTime).toBeLessThan(200);
    });

    it('should handle batch embeddings efficiently', async () => {
      mistralEmbedder = new MistralEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const inputs: EmbeddingInput[] = Array.from({ length: 8 }, (_, i) => ({
        text: `Test text ${i}`,
      }));

      const startTime = Date.now();
      const results = await mistralEmbedder.embed(inputs);
      const endTime = Date.now();

      expect(results).toHaveLength(8);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in reasonable time
    });
  });
});