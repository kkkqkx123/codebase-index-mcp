import { Container } from 'inversify';
import { BatchProcessor } from './BatchProcessor';
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
      getBatchConfig: jest.fn().mockReturnValue({
        batchSize: 100,
        maxConcurrency: 5,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    } as any;

    mockPerformanceMonitor = {
      startTimer: jest.fn().mockReturnValue('timer-id'),
      endTimer: jest.fn(),
      recordMetric: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind(TYPES.BatchProcessor).to(BatchProcessor);

    batchProcessor = container.get<BatchProcessor>(TYPES.BatchProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBatch', () => {
    it('should process a batch of items successfully', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i, data: `item-${i}` }));
      const processor = jest.fn().mockResolvedValue('processed');

      const results = await batchProcessor.processBatch(items, processor);

      expect(results).toHaveLength(50);
      expect(results.every(r => r === 'processed')).toBe(true);
      expect(processor).toHaveBeenCalledTimes(50);
      expect(mockPerformanceMonitor.startTimer).toHaveBeenCalled();
      expect(mockPerformanceMonitor.endTimer).toHaveBeenCalled();
    });

    it('should handle processing errors with retry logic', async () => {
      const items = [{ id: 1, data: 'item-1' }, { id: 2, data: 'item-2' }];
      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce('processed-retry')
        .mockResolvedValueOnce('processed');

      const results = await batchProcessor.processBatch(items, processor, {
        retryAttempts: 2,
        retryDelay: 100,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('processed-retry');
      expect(results[1]).toBe('processed');
      expect(processor).toHaveBeenCalledTimes(3); // 1 failure + 1 retry + 1 success
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Batch item processing failed, retrying', expect.any(Object));
    });

    it('should respect concurrency limits', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i, data: `item-${i}` }));
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const processor = jest.fn().mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return 'processed';
      });

      await batchProcessor.processBatch(items, processor, { maxConcurrency: 3 });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(processor).toHaveBeenCalledTimes(20);
    });

    it('should split large batches into smaller chunks', async () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ id: i, data: `item-${i}` }));
      const processor = jest.fn().mockResolvedValue('processed');

      const results = await batchProcessor.processBatch(items, processor, { batchSize: 100 });

      expect(results).toHaveLength(250);
      expect(processor).toHaveBeenCalledTimes(250);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Processing batch chunk', expect.objectContaining({
        chunkIndex: expect.any(Number),
        totalChunks: 3,
      }));
    });
  });

  describe('processWithPriority', () => {
    it('should process high priority items first', async () => {
      const items = [
        { id: 1, data: 'low', priority: 1 },
        { id: 2, data: 'high', priority: 10 },
        { id: 3, data: 'medium', priority: 5 },
      ];

      const processOrder: number[] = [];
      const processor = jest.fn().mockImplementation(async (item) => {
        processOrder.push(item.id);
        return `processed-${item.id}`;
      });

      await batchProcessor.processWithPriority(items, processor);

      expect(processOrder).toEqual([2, 3, 1]); // High, medium, low priority
    });
  });

  describe('processStream', () => {
    it('should process items as they arrive in a stream', async () => {
      const processedItems: any[] = [];
      const processor = jest.fn().mockImplementation(async (item) => {
        processedItems.push(item);
        return `processed-${item.id}`;
      });

      const stream = batchProcessor.processStream(processor, { batchSize: 3 });

      // Add items to stream
      stream.add({ id: 1, data: 'item-1' });
      stream.add({ id: 2, data: 'item-2' });
      stream.add({ id: 3, data: 'item-3' });
      stream.add({ id: 4, data: 'item-4' });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      stream.end();

      expect(processedItems).toHaveLength(4);
      expect(processor).toHaveBeenCalledTimes(4);
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i, data: `item-${i}` }));
      const processor = jest.fn().mockResolvedValue('processed');

      await batchProcessor.processBatch(items, processor);

      const stats = batchProcessor.getProcessingStats();

      expect(stats.totalProcessed).toBe(10);
      expect(stats.successCount).toBe(10);
      expect(stats.errorCount).toBe(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track error statistics', async () => {
      const items = [{ id: 1, data: 'item-1' }, { id: 2, data: 'item-2' }];
      const processor = jest.fn()
        .mockResolvedValueOnce('processed')
        .mockRejectedValueOnce(new Error('Processing failed'));

      try {
        await batchProcessor.processBatch(items, processor, { retryAttempts: 0 });
      } catch (error) {
        // Expected to throw
      }

      const stats = batchProcessor.getProcessingStats();

      expect(stats.totalProcessed).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('pauseProcessing', () => {
    it('should pause and resume processing', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i, data: `item-${i}` }));
      let processedCount = 0;

      const processor = jest.fn().mockImplementation(async (item) => {
        processedCount++;
        if (processedCount === 3) {
          batchProcessor.pauseProcessing();
        }
        return `processed-${item.id}`;
      });

      const processingPromise = batchProcessor.processBatch(items, processor);

      // Wait for pause
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(batchProcessor.isPaused()).toBe(true);

      // Resume processing
      batchProcessor.resumeProcessing();
      await processingPromise;

      expect(processedCount).toBe(10);
      expect(batchProcessor.isPaused()).toBe(false);
    });
  });

  describe('cancelProcessing', () => {
    it('should cancel ongoing processing', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, data: `item-${i}` }));
      let processedCount = 0;

      const processor = jest.fn().mockImplementation(async (item) => {
        processedCount++;
        if (processedCount === 5) {
          batchProcessor.cancelProcessing();
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${item.id}`;
      });

      try {
        await batchProcessor.processBatch(items, processor);
      } catch (error) {
        expect(error.message).toContain('cancelled');
      }

      expect(processedCount).toBeLessThan(100);
      expect(batchProcessor.isCancelled()).toBe(true);
    });
  });

  describe('processWithBackpressure', () => {
    it('should handle backpressure by slowing down processing', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i, data: `item-${i}` }));
      let processingTimes: number[] = [];

      const processor = jest.fn().mockImplementation(async (item) => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        processingTimes.push(Date.now() - start);
        return `processed-${item.id}`;
      });

      await batchProcessor.processWithBackpressure(items, processor, {
        maxQueueSize: 5,
        backpressureThreshold: 0.8,
      });

      expect(processor).toHaveBeenCalledTimes(20);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Applying backpressure', expect.any(Object));
    });
  });
});