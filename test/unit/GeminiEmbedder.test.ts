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
      gemini: {
        apiKey: 'test-gemini-api-key',
        model: 'embedding-001',
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
        gemini: {
          apiKey: 'test-key',
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
        gemini: {
          apiKey: 'test-key',
          model: 'models/embedding-001',
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
        gemini: {
          apiKey: 'test-key',
          model: 'models/text-embedding-004',
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
        gemini: {
          apiKey: 'valid-gemini-api-key',
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
        gemini: {
          apiKey: '',
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
        gemini: {},
      });

      geminiEmbedder = new GeminiEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      const available = await geminiEmbedder.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when API key is whitespace only', async () => {
      mockConfigService.get.mockReturnValue({
        gemini: {
          apiKey: '   ',
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

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });

      expect(result.vector).toHaveLength(768);
      expect(result.processingTime).toBeGreaterThan(0);
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

      result.forEach((embedding: EmbeddingResult) => {
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

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 768,
        model: 'embedding-001',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await geminiEmbedder.embed(input);

      expect(result).toEqual({
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

      expect(result).toEqual({
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

      expect(result1.vector).not.toEqual(result2.vector);
    });

    it('should handle processing time measurement', async () => {
      const input: EmbeddingInput = { text: 'Timing test' };

      const result = await geminiEmbedder.embed(input);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(400); // Should be reasonably fast
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
      mockConfigService.get.mockReturnValue({});

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
        gemini: {
          apiKey: 'minimal-key',
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
        gemini: {
          apiKey: 'complete-key',
          model: 'models/text-embedding-004',
          baseUrl: 'https://generativelanguage.googleapis.com',
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

      // Gemini typically takes moderate time (150-350ms in mock)
      expect(result.processingTime).toBeGreaterThanOrEqual(150);
      expect(result.processingTime).toBeLessThan(350);
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