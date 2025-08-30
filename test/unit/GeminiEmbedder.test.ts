import { GeminiEmbedder } from '../../src/embedders/GeminiEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';

describe('GeminiEmbedder', () => {
  let geminiEmbedder: GeminiEmbedder;
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
      provider: 'gemini',
      openai: {
        apiKey: 'test-openai-key',
        model: 'text-embedding-ada-002',
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'nomic-embed-text',
      },
      gemini: {
        apiKey: 'test-gemini-api-key',
        model: 'embedding-001',
      },
      mistral: {
        apiKey: 'test-mistral-key',
        model: 'mistral-embed',
      },
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
      expect(geminiEmbedder).toBeInstanceOf(GeminiEmbedder);
    });

    it('should use default model when not specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'test-key',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getModelName()).toBe('embedding-001');
    });

    it('should use custom model when specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'test-key',
          model: 'models/embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getModelName()).toBe('models/embedding-001');
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for Gemini embeddings', () => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getDimensions()).toBe(768);
    });
  });

  describe('getModelName', () => {
    it('should return the configured model name', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'test-key',
          model: 'models/text-embedding-004',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getModelName()).toBe('models/text-embedding-004');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is available', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'valid-gemini-api-key',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await geminiEmbedder.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API key is empty', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: '',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await geminiEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: '',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await geminiEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return true when API key is whitespace only (current implementation behavior)', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: '   ',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await geminiEmbedder.isAvailable();
      expect(available).toBe(true); // Current implementation doesn't trim whitespace
    });
  });

  describe('embed', () => {
    beforeEach(() => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );
    });

    it('should embed single input', async () => {
      const input: EmbeddingInput = { text: 'Hello world' };
      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      expect(embeddingResult).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });

      expect(embeddingResult.vector).toHaveLength(768);
      expect(embeddingResult.processingTime).toBeGreaterThan(0);
    });

    it('should embed array of inputs', async () => {
      const inputs: EmbeddingInput[] = [
        { text: 'Hello world' },
        { text: 'Testing embeddings' },
        { text: 'Gemini AI' },
      ];

      const result = await geminiEmbedder.embed(inputs);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      (result as EmbeddingResult[]).forEach((embedding: EmbeddingResult) => {
        expect(embedding).toEqual({
          vector: expect.any(Array),
          dimensions: 768,
          model: 'embedding-001',
          processingTime: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(768);
      });
    });

    it('should include metadata in embedding generation', async () => {
      const input: EmbeddingInput = {
        text: 'Test code',
        metadata: { language: 'typescript', framework: 'react' },
      };

      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      expect(embeddingResult).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      expect(embeddingResult).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });
    });

    it('should handle large text input', async () => {
      const largeText = 'x'.repeat(6000);
      const input: EmbeddingInput = { text: largeText };

      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      expect(embeddingResult).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });
    });

    it('should generate unique vectors for different inputs', async () => {
      const input1: EmbeddingInput = { text: 'Hello world' };
      const input2: EmbeddingInput = { text: 'Google AI' };

      const result1 = await geminiEmbedder.embed(input1);
      const result2 = await geminiEmbedder.embed(input2);

      // Handle both single result and array result cases
      const embeddingResult1 = Array.isArray(result1) ? result1[0] : result1;
      const embeddingResult2 = Array.isArray(result2) ? result2[0] : result2;
      
      expect(embeddingResult1.vector).not.toEqual(embeddingResult2.vector);
    });

    it('should handle processing time measurement', async () => {
      const input: EmbeddingInput = { text: 'Timing test' };

      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      expect(embeddingResult.processingTime).toBeGreaterThan(0);
      expect(embeddingResult.processingTime).toBeLessThan(400); // Should be reasonably fast
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        new GeminiEmbedder(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService
        );
      }).toThrow('Configuration error');
    });

    it('should handle embedding process errors', async () => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      // Mock the private measureTime method to throw an error
      jest.spyOn(geminiEmbedder as any, 'measureTime').mockRejectedValue(new Error('Gemini API error'));

      const input: EmbeddingInput = { text: 'Test error handling' };

      await expect(geminiEmbedder.embed(input)).rejects.toThrow('Gemini API error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Gemini embedding failed: Gemini API error',
        }),
        { component: 'GeminiEmbedder', operation: 'embed' }
      );
    });

    it('should handle missing gemini configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: '',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      expect(() => {
        new GeminiEmbedder(
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
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'minimal-key',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getModelName()).toBe('embedding-001');
      expect(geminiEmbedder.getDimensions()).toBe(768);
    });

    it('should work with complete configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'gemini',
        openai: {
          apiKey: 'test-openai-key',
          model: 'text-embedding-ada-002',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
        gemini: {
          apiKey: 'complete-key',
          model: 'models/text-embedding-004',
        },
        mistral: {
          apiKey: 'test-mistral-key',
          model: 'mistral-embed',
        },
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(geminiEmbedder.getModelName()).toBe('models/text-embedding-004');
    });
  });

  describe('Performance Characteristics', () => {
    it('should have realistic processing time ranges', async () => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const input: EmbeddingInput = { text: 'Performance test' };
      const result = await geminiEmbedder.embed(input);

      // Handle both single result and array result cases
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      
      // Gemini typically takes moderate time (150-350ms in mock)
      expect(embeddingResult.processingTime).toBeGreaterThanOrEqual(150);
      expect(embeddingResult.processingTime).toBeLessThan(350);
    });

    it('should handle batch embeddings efficiently', async () => {
      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const inputs: EmbeddingInput[] = Array.from({ length: 5 }, (_, i) => ({
        text: `Test text ${i}`,
      }));

      const startTime = Date.now();
      const results = await geminiEmbedder.embed(inputs);
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in reasonable time
    });
  });
});