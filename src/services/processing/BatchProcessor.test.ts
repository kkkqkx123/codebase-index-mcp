import { Container } from 'inversify';
import { BatchProcessor, BatchOptions } from './BatchProcessor';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { TYPES } from '../../core/DIContainer';

describe('BatchProcessor', () => {
  let container: Container;
  let batchProcessor: BatchProcessor;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockPerformanceMonitor: jest.Mocked<PerformanceMonitor>;

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
    } as any;

    mockPerformanceMonitor = {
      startTimer: jest.fn().mockReturnValue('timer-id'),
      endTimer: jest.fn(),
      recordMetric: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind('LoggerService').toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.BatchProcessor).to(BatchProcessor);

    batchProcessor = container.get<BatchProcessor>(TYPES.BatchProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processInBatches', () => {
    it('should process items in batches successfully', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i, data: `item-${i}` }));
      const processor = jest.fn().mockImplementation(async (batch: any[]) => {
        return batch.map(item => `processed-${item.id}`);
      });

      const result = await batchProcessor.processInBatches(items, processor);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(50);
      expect(result.results).toHaveLength(50);
      expect(processor).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Starting batch processing',
        expect.any(Object)
      );
    });

    it('should handle processing errors with retry logic', async () => {
      const items = [
        { id: 1, data: 'item-1' },
        { id: 2, data: 'item-2' },
      ];
      const processor = jest
        .fn()
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockImplementation(async (batch: any[]) => {
          return batch.map(item => `processed-${item.id}`);
        });

      const result = await batchProcessor.processInBatches(items, processor, {
        retryAttempts: 2,
        retryDelay: 100,
      });

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(processor).toHaveBeenCalledTimes(2); // 1 failure + 1 success
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Batch processing failed, retrying',
        expect.any(Object)
      );
    });

    it('should handle empty items array', async () => {
      const items: any[] = [];
      const processor = jest.fn();

      const result = await batchProcessor.processInBatches(items, processor);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(processor).not.toHaveBeenCalled();
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      // This is a simple method that just logs, so we just verify it doesn't throw
      expect(() => batchProcessor.resetStats()).not.toThrow();
      expect(mockLoggerService.info).toHaveBeenCalledWith('Batch processor statistics reset');
    });
  });
});
