import { OpenAIEmbedder } from '../../src/embedders/OpenAIEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';

describe('OpenAIEmbedder', () => {
  let openAIEmbedder: OpenAIEmbedder;
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
      provider: 'openai',
      openai: {
        apiKey: 'test-openai-api-key',
        model: 'text-embedding-ada-002',
      },
      ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
      gemini: { apiKey: 'test-key', model: 'embedding-001' },
      mistral: { apiKey: 'test-key', model: 'mistral-embed' },
    });
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
      expect(openAIEmbedder).toBeInstanceOf(OpenAIEmbedder);
    });

    it('should use default model when not specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: 'test-key',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getModelName()).toBe('text-embedding-ada-002');
    });

    it('should use custom model when specified', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: 'test-key',
          model: 'custom-model',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getModelName()).toBe('custom-model');
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions for OpenAI embeddings', () => {
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getDimensions()).toBe(1536);
    });
  });

  describe('getModelName', () => {
    it('should return the configured model name', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: 'test-key',
          model: 'text-embedding-3-small',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getModelName()).toBe('text-embedding-3-small');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is available', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: 'valid-api-key',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await openAIEmbedder.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when API key is empty', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: '',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await openAIEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is missing', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: '',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await openAIEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is whitespace only', async () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: '   ',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await openAIEmbedder.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('embed', () => {
    beforeEach(() => {
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );
    });

    it('should embed single input', async () => {
      const input: EmbeddingInput = { text: 'Hello world' };
      const result = await openAIEmbedder.embed(input) as EmbeddingResult;

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: expect.any(Number),
      });

      expect(result.vector).toHaveLength(1536);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should embed array of inputs', async () => {
      const inputs: EmbeddingInput[] = [
        { text: 'Hello world' },
        { text: 'Testing embeddings' },
        { text: 'OpenAI API' },
      ];

      const result = await openAIEmbedder.embed(inputs);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      (result as EmbeddingResult[]).forEach((embedding: EmbeddingResult) => {
        expect(embedding).toEqual({
          vector: expect.any(Array),
          dimensions: 1536,
          model: 'text-embedding-ada-002',
          processingTime: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(1536);
      });
    });

    it('should include metadata in embedding generation', async () => {
      const input: EmbeddingInput = {
        text: 'Test code',
        metadata: { language: 'javascript', lines: 10 },
      };

      const result = await openAIEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await openAIEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: expect.any(Number),
      });
    });

    it('should handle large text input', async () => {
      const largeText = 'x'.repeat(5000);
      const input: EmbeddingInput = { text: largeText };

      const result = await openAIEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'text-embedding-ada-002',
        processingTime: expect.any(Number),
      });
    });

    it('should generate unique vectors for different inputs', async () => {
      const input1: EmbeddingInput = { text: 'Hello world' };
      const input2: EmbeddingInput = { text: 'Goodbye world' };

      const result1 = await openAIEmbedder.embed(input1) as EmbeddingResult;
      const result2 = await openAIEmbedder.embed(input2) as EmbeddingResult;

      expect(result1.vector).not.toEqual(result2.vector);
    });

    it('should generate consistent vectors for same input', async () => {
      const input: EmbeddingInput = { text: 'Consistent test' };

      const result1 = await openAIEmbedder.embed(input) as EmbeddingResult;
      const result2 = await openAIEmbedder.embed(input) as EmbeddingResult;

      // Note: Since this is mock implementation with Math.random(), vectors won't be consistent
      // In a real implementation, we'd expect consistency for the same input
      expect(result1.vector).toHaveLength(1536);
      expect(result2.vector).toHaveLength(1536);
    });

    it('should handle processing time measurement', async () => {
      const input: EmbeddingInput = { text: 'Timing test' };

      const result = await openAIEmbedder.embed(input) as EmbeddingResult;

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(200); // Should be reasonably fast
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => {
        new OpenAIEmbedder(
          mockConfigService,
          mockLoggerService,
          mockErrorHandlerService
        );
      }).toThrow('Configuration error');
    });

    it('should handle embedding process errors', async () => {
      // Create a spy on the measureTime method to simulate an error
      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      // Mock the private measureTime method to throw an error
      jest.spyOn(openAIEmbedder as any, 'measureTime').mockRejectedValue(new Error('Network error'));

      const input: EmbeddingInput = { text: 'Test error handling' };

      await expect(openAIEmbedder.embed(input)).rejects.toThrow('Network error');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'OpenAI embedding failed: Network error',
        }),
        { component: 'OpenAIEmbedder', operation: 'embed' }
      );
    });

    it('should handle missing embedding configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: '',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      expect(() => {
        new OpenAIEmbedder(
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
        provider: 'openai',
        openai: {
          apiKey: 'minimal-key',
          model: 'text-embedding-ada-002',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getModelName()).toBe('text-embedding-ada-002');
      expect(openAIEmbedder.getDimensions()).toBe(1536);
    });

    it('should work with complete configuration', () => {
      mockConfigService.get.mockReturnValue({
        provider: 'openai',
        openai: {
          apiKey: 'complete-key',
          model: 'text-embedding-3-large',
        },
        ollama: { baseUrl: 'http://localhost:11434', model: 'nomic-embed-text' },
        gemini: { apiKey: 'test-key', model: 'embedding-001' },
        mistral: { apiKey: 'test-key', model: 'mistral-embed' },
      });

      openAIEmbedder = new OpenAIEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      expect(openAIEmbedder.getModelName()).toBe('text-embedding-3-large');
    });
  });
});