import { BatchProcessor, BatchOptions, BatchResult } from '../../../src/services/processing/BatchProcessor';
import { LoggerService } from '../../../src/core/LoggerService';
import { createTestContainer } from '../../setup';

describe('BatchProcessor', () => {
  let batchProcessor: BatchProcessor;
  let loggerService: jest.Mocked<LoggerService>;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();
    loggerService = container.get(LoggerService);
    batchProcessor = new BatchProcessor(loggerService);
  });

  describe('processInBatches', () => {
    const mockItems = Array.from({ length: 100 }, (_, i) => `item-${i}`);
    const mockProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
      return batch.map(item => ({ processed: item, timestamp: Date.now() }));
    });

    it('should successfully process items in batches', async () => {
      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(mockItems, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(100);
      expect(result.results).toHaveLength(100);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify processor was called correct number of times
      expect(mockProcessor).toHaveBeenCalledTimes(10); // 100 items / 10 batch size

      // Verify all items were processed
      result.results.forEach((processedItem: any, index) => {
        expect(processedItem.processed).toBe(`item-${index}`);
      });
    });

    it('should handle empty items array', async () => {
      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches([], mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Verify processor was not called
      expect(mockProcessor).not.toHaveBeenCalled();
    });

    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const trackingProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentCount--;
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 5,
        maxConcurrency: 3,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(mockItems, trackingProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(100);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should handle processor failures with continueOnError', async () => {
      const failingProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        if (batch.includes('item-15')) {
          throw new Error('Processing failed for item-15');
        }
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(mockItems, failingProcessor, options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processedItems).toBeLessThan(100);
      expect(result.errors[0]).toContain('Processing failed for item-15');
    });

    it('should stop processing on first failure with continueOnError false', async () => {
      const failingProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        if (batch.includes('item-25')) {
          throw new Error('Critical failure');
        }
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: false
      };

      const result = await batchProcessor.processInBatches(mockItems, failingProcessor, options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Critical failure');
      
      // Should have processed some items before failure
      expect(result.processedItems).toBeGreaterThan(0);
      expect(result.processedItems).toBeLessThan(100);
    });

    it('should handle timeout errors', async () => {
      const slowProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 5,
        maxConcurrency: 1,
        timeout: 1000, // 1 second timeout
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(mockItems.slice(0, 10), slowProcessor, options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('timeout');
    });

    it('should use default options when none provided', async () => {
      const result = await batchProcessor.processInBatches(mockItems.slice(0, 10), mockProcessor);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(10);
    });

    it('should handle partial batch sizes', async () => {
      const partialItems = Array.from({ length: 23 }, (_, i) => `item-${i}`); // Not divisible by batch size
      
      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 2,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(partialItems, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(23);
      expect(mockProcessor).toHaveBeenCalledTimes(3); // 10 + 10 + 3
    });

    it('should process single item correctly', async () => {
      const singleItem = ['item-1'];
      
      const options: BatchOptions = {
        batchSize: 10,
        maxConcurrency: 1,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(singleItem, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(mockProcessor).toHaveBeenCalledTimes(1);
    });
  });

  
  describe('edge cases', () => {
    it('should handle very large batch sizes', async () => {
      const largeItems = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const mockProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 500, // Large batch size
        maxConcurrency: 1,
        timeout: 60000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(largeItems, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(1000);
      expect(mockProcessor).toHaveBeenCalledTimes(2); // 500 + 500
    });

    it('should handle batch size larger than item count', async () => {
      const smallItems = ['item-1', 'item-2', 'item-3'];
      const mockProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        return batch.map(item => ({ processed: item }));
      });

      const options: BatchOptions = {
        batchSize: 10, // Larger than item count
        maxConcurrency: 1,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(smallItems, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(3);
      expect(mockProcessor).toHaveBeenCalledTimes(1); // Single batch
    });

    it('should handle processor returning empty results', async () => {
      const emptyProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        return []; // Return empty array
      });

      const options: BatchOptions = {
        batchSize: 5,
        maxConcurrency: 1,
        timeout: 30000,
        continueOnError: true
      };

      const result = await batchProcessor.processInBatches(['item-1', 'item-2'], emptyProcessor, options);

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(10);
      expect(result.results).toHaveLength(0); // No results from processor
    });
  });
});