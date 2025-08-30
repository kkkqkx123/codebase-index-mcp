import { BaseEmbedder, EmbeddingInput, EmbeddingResult } from '../../src/embedders/BaseEmbedder';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';

// Create a concrete implementation for testing
class TestEmbedder extends BaseEmbedder {
  private mockDimensions: number;
  private mockModel: string;
  private mockAvailable: boolean;

  constructor(
    configService: ConfigService,
    loggerService: LoggerService,
    errorHandlerService: ErrorHandlerService,
    dimensions: number = 1536,
    model: string = 'test-model',
    available: boolean = true
  ) {
    super(configService, loggerService, errorHandlerService);
    this.mockDimensions = dimensions;
    this.mockModel = model;
    this.mockAvailable = available;
  }

  async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
    const inputs = Array.isArray(input) ? input : [input];
    
    const results = inputs.map(inp => ({
      vector: this.generateMockVector(this.mockDimensions),
      dimensions: this.mockDimensions,
      model: this.mockModel,
      processingTime: Math.floor(Math.random() * 100) + 50,
    }));

    return Array.isArray(input) ? results : results[0];
  }

  getDimensions(): number {
    return this.mockDimensions;
  }

  getModelName(): string {
    return this.mockModel;
  }

  async isAvailable(): Promise<boolean> {
    return this.mockAvailable;
  }

  private generateMockVector(dimensions: number): number[] {
    return Array.from({ length: dimensions }, () => Math.random());
  }
}

describe('BaseEmbedder', () => {
  let testEmbedder: TestEmbedder;
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

    testEmbedder = new TestEmbedder(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      1536,
      'test-model',
      true
    );
  });

  describe('Constructor', () => {
    it('should initialize with dependencies', () => {
      expect(testEmbedder['configService']).toBe(mockConfigService);
      expect(testEmbedder['logger']).toBe(mockLoggerService);
      expect(testEmbedder['errorHandler']).toBe(mockErrorHandlerService);
    });
  });

  describe('Abstract Methods Implementation', () => {
    it('should implement all abstract methods', () => {
      expect(typeof testEmbedder.embed).toBe('function');
      expect(typeof testEmbedder.getDimensions).toBe('function');
      expect(typeof testEmbedder.getModelName).toBe('function');
      expect(typeof testEmbedder.isAvailable).toBe('function');
    });

    it('should return correct dimensions', () => {
      expect(testEmbedder.getDimensions()).toBe(1536);
    });

    it('should return correct model name', () => {
      expect(testEmbedder.getModelName()).toBe('test-model');
    });

    it('should return availability status', async () => {
      const available = await testEmbedder.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('embed', () => {
    it('should embed single input', async () => {
      const input: EmbeddingInput = { text: 'test text' };
      const result = await testEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'test-model',
        processingTime: expect.any(Number),
      });

      expect(result.vector).toHaveLength(1536);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should embed array of inputs', async () => {
      const inputs: EmbeddingInput[] = [
        { text: 'test text 1' },
        { text: 'test text 2' },
      ];

      const result = await testEmbedder.embed(inputs);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      result.forEach((embedding: EmbeddingResult) => {
        expect(embedding).toEqual({
          vector: expect.any(Array),
          dimensions: 1536,
          model: 'test-model',
          processingTime: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(1536);
      });
    });

    it('should include metadata in embedding when provided', async () => {
      const input: EmbeddingInput = {
        text: 'test text',
        metadata: { source: 'test', language: 'javascript' },
      };

      const result = await testEmbedder.embed(input);

      // The metadata doesn't affect the mock vector generation, but the result should still be valid
      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'test-model',
        processingTime: expect.any(Number),
      });
    });

    it('should handle empty text input', async () => {
      const input: EmbeddingInput = { text: '' };

      const result = await testEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'test-model',
        processingTime: expect.any(Number),
      });
    });

    it('should handle large text input', async () => {
      const largeText = 'x'.repeat(10000);
      const input: EmbeddingInput = { text: largeText };

      const result = await testEmbedder.embed(input);

      expect(result).toEqual({
        vector: expect.any(Array),
        dimensions: 1536,
        model: 'test-model',
        processingTime: expect.any(Number),
      });
    });
  });

  describe('measureTime', () => {
    it('should measure execution time correctly', async () => {
      const operation = jest.fn().mockImplementation(async () => {
        // Simulate a 100ms operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'test-result';
      });

      const { result, time } = await testEmbedder['measureTime'](operation);

      expect(result).toBe('test-result');
      expect(time).toBeGreaterThanOrEqual(100);
      expect(time).toBeLessThan(200); // Allow some buffer
    });

    it('should handle fast operations', async () => {
      const operation = jest.fn().mockResolvedValue('fast-result');

      const { result, time } = await testEmbedder['measureTime'](operation);

      expect(result).toBe('fast-result');
      expect(time).toBeGreaterThanOrEqual(0);
      expect(time).toBeLessThan(50);
    });

    it('should handle operations that throw errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(testEmbedder['measureTime'](operation)).rejects.toThrow('Test error');
    });

    it('should measure time for synchronous operations', async () => {
      const operation = jest.fn().mockReturnValue('sync-result');

      const { result, time } = await testEmbedder['measureTime'](operation);

      expect(result).toBe('sync-result');
      expect(time).toBeGreaterThanOrEqual(0);
      expect(time).toBeLessThan(10);
    });
  });

  describe('Different Configurations', () => {
    it('should work with different dimensions', () => {
      const embedder768 = new TestEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService,
        768,
        '768-model',
        true
      );

      expect(embedder768.getDimensions()).toBe(768);
      expect(embedder768.getModelName()).toBe('768-model');
    });

    it('should work with unavailable embedder', async () => {
      const unavailableEmbedder = new TestEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService,
        1536,
        'unavailable-model',
        false
      );

      expect(await unavailableEmbedder.isAvailable()).toBe(false);
    });

    it('should generate consistent vector dimensions', async () => {
      const input: EmbeddingInput = { text: 'test text' };
      const result1 = await testEmbedder.embed(input);
      const result2 = await testEmbedder.embed(input);

      expect(result1.vector).toHaveLength(1536);
      expect(result2.vector).toHaveLength(1536);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding errors gracefully', async () => {
      class ErrorEmbedder extends TestEmbedder {
        async embed(input: EmbeddingInput | EmbeddingInput[]): Promise<EmbeddingResult | EmbeddingResult[]> {
          throw new Error('Embedding failed');
        }
      }

      const errorEmbedder = new ErrorEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      await expect(errorEmbedder.embed({ text: 'test' })).rejects.toThrow('Embedding failed');
    });

    it('should handle availability check errors', async () => {
      class ErrorEmbedder extends TestEmbedder {
        async isAvailable(): Promise<boolean> {
          throw new Error('Availability check failed');
        }
      }

      const errorEmbedder = new ErrorEmbedder(
        mockConfigService,
        mockLoggerService,
        mockErrorHandlerService
      );

      await expect(errorEmbedder.isAvailable()).rejects.toThrow('Availability check failed');
    });
  });
});