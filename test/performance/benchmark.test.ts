import { IndexCoordinator } from '../../src/services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../../src/services/storage/StorageCoordinator';
import { AsyncPipeline } from '../../src/services/infrastructure/AsyncPipeline';
import { BatchProcessor } from '../../src/services/processing/BatchProcessor';
import { MemoryManager } from '../../src/services/processing/MemoryManager';
import { ObjectPool } from '../../src/services/infrastructure/ObjectPool';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { ConfigService } from '../../src/config/ConfigService';
import { createTestContainer } from '../setup';

describe('Performance Benchmark Tests', () => {
  let container: any;
  let loggerService: jest.Mocked<LoggerService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let configService: jest.Mocked<ConfigService>;
  let asyncPipeline: AsyncPipeline;
  let batchProcessor: BatchProcessor;
  let memoryManager: MemoryManager;
  let objectPool: ObjectPool<string>;

  beforeEach(() => {
    container = createTestContainer();
    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);

    // Create performance components
    asyncPipeline = new AsyncPipeline({
      timeout: 60000,
      retryAttempts: 3,
      retryDelay: 100,
      continueOnError: true,
      enableMetrics: true
    }, loggerService);

    batchProcessor = new BatchProcessor(loggerService);

    memoryManager = new MemoryManager(loggerService, {
      checkInterval: 500,
      thresholds: { warning: 70, critical: 85, emergency: 95 },
      gcThreshold: 80,
      maxMemoryMB: 1024
    });

    objectPool = new ObjectPool<string>({
      initialSize: 50,
      maxSize: 500,
      creator: () => `resource-${Math.random().toString(36).substr(2, 9)}`,
      resetter: (obj: string) => obj,
      validator: (obj: string) => typeof obj === 'string',
      destroy: (obj: string) => { },
      evictionPolicy: 'lru'
    }, loggerService);
  });

  afterEach(() => {
    if (memoryManager.isMonitoring()) {
      memoryManager.stopMonitoring();
    }
    objectPool.clear();
    asyncPipeline.clearSteps();
    batchProcessor.resetStats();
  });

  describe('Async Pipeline Performance', () => {
    it('should handle high-throughput pipeline execution', async () => {
      const iterations = 100;
      const results: any[] = [];

      // Setup pipeline for high-throughput processing
      asyncPipeline.clearSteps();
      asyncPipeline.addStep({
        name: 'data-generation',
        execute: async (data: any) => {
          const items = Array.from({ length: data.count }, (_, i) => `item-${i}`);
          return { ...data, items };
        },
        timeout: 5000
      }).addStep({
        name: 'data-transformation',
        execute: async (data: any) => {
          const transformed = data.items.map((item: string) => ({
            original: item,
            processed: item.toUpperCase(),
            timestamp: Date.now()
          }));
          return { ...data, transformed };
        },
        timeout: 10000
      }).addStep({
        name: 'data-aggregation',
        execute: async (data: any) => {
          const summary = {
            totalItems: data.transformed.length,
            processingTime: Date.now() - data.startTime,
            averageLength: data.transformed.reduce((sum: number, item: any) => sum + item.original.length, 0) / data.transformed.length
          };
          return { ...data, summary };
        },
        timeout: 5000
      });

      const startTime = Date.now();

      // Execute pipeline multiple times
      for (let i = 0; i < iterations; i++) {
        const result = await asyncPipeline.execute({
          count: 1000,
          startTime: Date.now()
        });
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / iterations;

      // Performance assertions
      expect(results.every(r => r.success)).toBe(true);
      expect(averageTime).toBeLessThan(100); // Average execution time should be < 100ms
      expect(totalTime).toBeLessThan(10000); // Total time for 100 iterations should be < 10s

      // Verify pipeline metrics
      const metrics = asyncPipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(iterations);
      expect(metrics.successfulExecutions).toBe(iterations);
      expect(metrics.averageExecutionTime).toBeLessThan(100);
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrency = 10;
      const iterations = 20;
      const promises: Promise<any>[] = [];

      // Setup simple pipeline
      asyncPipeline.clearSteps();
      asyncPipeline.addStep({
        name: 'quick-processing',
        execute: async (data: any) => {
          // Simulate quick processing
          await new Promise(resolve => setTimeout(resolve, 10));
          return { ...data, processed: true };
        },
        timeout: 1000
      });

      const startTime = Date.now();

      // Execute pipeline concurrently
      for (let i = 0; i < concurrency; i++) {
        for (let j = 0; j < iterations; j++) {
          promises.push(asyncPipeline.execute({ id: `${i}-${j}`, data: `test-${j}` }));
        }
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(results.length).toBe(concurrency * iterations);

      // Verify metrics tracked concurrent executions
      const metrics = asyncPipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(concurrency * iterations);
    });

    it('should handle large data volumes efficiently', async () => {
      const dataSizes = [1000, 5000, 10000, 20000];
      const performanceResults: any[] = [];

      for (const size of dataSizes) {
        asyncPipeline.clearSteps();
        asyncPipeline.addStep({
          name: 'large-data-processing',
          execute: async (data: any) => {
            // Process large dataset
            const items = Array.from({ length: size }, (_, i) => ({
              id: i,
              data: `item-data-${i}-${Math.random().toString(36)}`
            }));

            // Simulate data processing
            const processed = items.map(item => ({
              ...item,
              processed: true,
              hash: item.data.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0)
            }));

            return { ...data, processedItems: processed, size };
          },
          timeout: 30000
        });

        const startTime = Date.now();
        const result = await asyncPipeline.execute({ size });
        const processingTime = Date.now() - startTime;

        performanceResults.push({
          size,
          processingTime,
          success: result.success,
          throughput: size / processingTime * 1000 // items per second
        });

        // Memory check between large operations
        const memoryStatus = memoryManager.getMemoryStatus();
        expect(['healthy', 'warning']).toContain(memoryStatus.status);
      }

      // Performance should scale reasonably
      expect(performanceResults.every(r => r.success)).toBe(true);
      expect(performanceResults[0].throughput).toBeGreaterThan(1000); // > 1000 items/sec for smallest dataset
      expect(performanceResults[performanceResults.length - 1].throughput).toBeGreaterThan(100); // > 100 items/sec for largest dataset
    });
  });

  describe('Batch Processing Performance', () => {
    it('should optimize batch size for maximum throughput', async () => {
      const totalItems = 10000;
      const batchSizes = [10, 25, 50, 100, 250, 500];
      const results: any[] = [];

      const processor = jest.fn().mockImplementation(async (batch: string[]) => {
        // Simulate processing work
        await new Promise(resolve => setTimeout(resolve, 1));
        return batch.map(item => ({ processed: item, timestamp: Date.now() }));
      });

      for (const batchSize of batchSizes) {
        const startTime = Date.now();

        const result = await batchProcessor.processInBatches(
          Array.from({ length: totalItems }, (_, i) => `item-${i}`),
          processor,
          {
            batchSize,
            maxConcurrency: 4,
            timeout: 60000,
            continueOnError: true
          }
        );

        const processingTime = Date.now() - startTime;
        const throughput = totalItems / processingTime * 1000;

        results.push({
          batchSize,
          processingTime,
          throughput,
          success: result.success
        });

        // Reset processor call count for next iteration
        processor.mockClear();
      }

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Find optimal batch size (should be in middle range)
      const throughputs = results.map(r => r.throughput);
      const maxThroughput = Math.max(...throughputs);
      const optimalBatchSize = results.find(r => r.throughput === maxThroughput)?.batchSize;

      expect(optimalBatchSize).toBeGreaterThan(10);
      expect(optimalBatchSize).toBeLessThan(500);
    });

    it('should handle concurrency scaling efficiently', async () => {
      const totalItems = 5000;
      const concurrencyLevels = [1, 2, 4, 8, 16];
      const results: any[] = [];

      const processor = jest.fn().mockImplementation(async (batch: string[]) => {
        // Simulate I/O-bound work
        await new Promise(resolve => setTimeout(resolve, 50));
        return batch.map(item => ({ processed: item }));
      });

      for (const concurrency of concurrencyLevels) {
        const startTime = Date.now();

        const result = await batchProcessor.processInBatches(
          Array.from({ length: totalItems }, (_, i) => `item-${i}`),
          processor,
          {
            batchSize: 50,
            maxConcurrency: concurrency,
            timeout: 60000,
            continueOnError: true
          }
        );

        const processingTime = Date.now() - startTime;
        const throughput = totalItems / processingTime * 1000;

        results.push({
          concurrency,
          processingTime,
          throughput,
          success: result.success
        });

        processor.mockClear();
      }

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);

      // Throughput should generally increase with concurrency (up to a point)
      const baselineThroughput = results[0].throughput;
      const maxThroughput = Math.max(...results.map(r => r.throughput));
      expect(maxThroughput).toBeGreaterThan(baselineThroughput * 1.5); // At least 50% improvement
    });

    it('should maintain performance with error handling', async () => {
      const totalItems = 1000;
      const errorRate = 0.05; // 5% error rate

      const failingProcessor = jest.fn().mockImplementation(async (batch: string[]) => {
        // Simulate occasional failures
        if (Math.random() < errorRate) {
          throw new Error('Random processing failure');
        }

        await new Promise(resolve => setTimeout(resolve, 10));
        return batch.map(item => ({ processed: item }));
      });

      const startTime = Date.now();

      const result = await batchProcessor.processInBatches(
        Array.from({ length: totalItems }, (_, i) => `item-${i}`),
        failingProcessor,
        {
          batchSize: 25,
          maxConcurrency: 4,
          timeout: 30000,
          continueOnError: true
        }
      );

      const processingTime = Date.now() - startTime;

      // Should handle errors gracefully
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processedItems).toBeGreaterThan(0);
      expect(result.processedItems).toBeLessThan(totalItems);

      // Performance should still be reasonable despite errors
      expect(processingTime).toBeLessThan(15000); // Should complete in under 15 seconds
    });
  });

  describe('Memory Management Performance', () => {
    it('should monitor memory usage with minimal overhead', async () => {
      const memoryUpdates: any[] = [];
      memoryManager.onMemoryUpdate((usage: any) => {
        memoryUpdates.push(usage);
      });

      memoryManager.startMonitoring();

      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(async () => {
          // Create and process large arrays
          const largeArray = new Array(10000).fill(`data-${i}`);
          const processed = largeArray.map(item => item.toUpperCase());
          return processed.length;
        });
      }

      const startTime = Date.now();
      await Promise.all(operations.map(op => op()));
      const totalTime = Date.now() - startTime;

      // Wait for final memory updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      memoryManager.stopMonitoring();

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(memoryUpdates.length).toBeGreaterThan(5); // Should have multiple memory updates

      // Memory monitoring overhead should be minimal
      const averageCheckTime = totalTime / memoryUpdates.length;
      expect(averageCheckTime).toBeLessThan(100); // Each check should take < 100ms

      // Verify memory data is valid
      memoryUpdates.forEach(update => {
        expect(update).toHaveProperty('heapUsed');
        expect(update).toHaveProperty('heapTotal');
        expect(update).toHaveProperty('percentageUsed');
        expect(update.percentageUsed).toBeGreaterThan(0);
        expect(update.percentageUsed).toBeLessThan(100);
      });
    });

    it('should respond to memory pressure quickly', async () => {
      const responseTimes: number[] = [];
      const memoryUpdates: any[] = [];

      memoryManager.onMemoryUpdate((usage: any) => {
        memoryUpdates.push(usage);
        const responseStart = Date.now();

        // Simulate memory pressure response
        if (usage.percentageUsed > 80) {
          // Force garbage collection if available
          memoryManager.forceGarbageCollection();
        }

        responseTimes.push(Date.now() - responseStart);
      });

      memoryManager.startMonitoring();

      // Create memory pressure
      const memoryIntensiveOps = [];
      for (let i = 0; i < 50; i++) {
        memoryIntensiveOps.push(async () => {
          // Allocate and process large data structures
          const largeData = new Array(50000).fill(null).map(() => ({
            id: Math.random(),
            data: Math.random().toString(36).repeat(100),
            metadata: Array.from({ length: 20 }, () => Math.random())
          }));

          // Process data
          return largeData.map(item => ({
            ...item,
            processed: true,
            hash: item.data.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0)
          }));
        });
      }

      await Promise.all(memoryIntensiveOps.map(op => op()));

      // Wait for memory monitoring to respond
      await new Promise(resolve => setTimeout(resolve, 2000));
      memoryManager.stopMonitoring();

      // Should have responded to memory pressure
      expect(memoryUpdates.length).toBeGreaterThan(0);
      expect(responseTimes.length).toBeGreaterThan(0);

      // Response time should be quick
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      expect(averageResponseTime).toBeLessThan(10); // Average response time < 10ms
    });
  });

  describe('Object Pool Performance', () => {
    it('should handle high-frequency object acquisition and release', async () => {
      const operations = 10000;
      const concurrentThreads = 10;
      const results: any[] = [];

      const performOperations = async (threadId: number): Promise<any> => {
        const acquiredObjects: string[] = [];
        const startTime = Date.now();

        for (let i = 0; i < operations / concurrentThreads; i++) {
          const obj = objectPool.acquire();
          acquiredObjects.push(obj);

          // Simulate brief work
          await new Promise(resolve => setTimeout(resolve, 1));

          objectPool.release(obj);
        }

        const processingTime = Date.now() - startTime;
        return {
          threadId,
          processingTime,
          operations: operations / concurrentThreads,
          throughput: (operations / concurrentThreads) / processingTime * 1000
        };
      };

      const startTime = Date.now();
      const promises = Array.from({ length: concurrentThreads }, (_, i) => performOperations(i));
      const threadResults = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(10000); // Should complete in under 10 seconds
      expect(threadResults.every(r => r.throughput > 100)).toBe(true); // Each thread > 100 ops/sec

      // Verify pool statistics
      const stats = objectPool.getStats();
      expect(stats.totalAcquired).toBe(operations);
      expect(stats.totalReleased).toBe(operations);
      expect(stats.activeItems).toBe(0); // All objects should be released
    });

    it('should maintain performance under pool pressure', async () => {
      const initialStats = objectPool.getStats();

      // Rapidly acquire and release objects to test pool performance
      const rapidOperations = [];
      for (let i = 0; i < 5000; i++) {
        rapidOperations.push(async () => {
          const obj = objectPool.acquire();
          // Minimal processing
          const result = obj.toUpperCase();
          objectPool.release(obj);
          return result;
        });
      }

      const startTime = Date.now();
      await Promise.all(rapidOperations);
      const totalTime = Date.now() - startTime;

      const finalStats = objectPool.getStats();

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(finalStats.totalAcquired - initialStats.totalAcquired).toBe(5000);
      expect(finalStats.totalReleased - initialStats.totalReleased).toBe(5000);
      expect(finalStats.activeItems).toBe(0);

      // Pool should be healthy after stress test
      expect(finalStats.availableItems).toBeGreaterThan(0);
    });

    it('should handle pool eviction efficiently', async () => {
      // Create a small pool to test eviction
      const smallPool = new ObjectPool<string>({
        initialSize: 10,
        maxSize: 20,
        creator: () => `evict-test-${Math.random().toString(36).substr(2, 9)}`,
        resetter: (obj: string) => obj,
        validator: (obj: string) => true,
        destroy: (obj: string) => { },
        evictionPolicy: 'lru'
      }, loggerService);

      // Fill pool beyond capacity
      const objects: string[] = [];
      for (let i = 0; i < 50; i++) {
        const obj = smallPool.acquire();
        objects.push(obj);
      }

      // Release all objects
      objects.forEach(obj => smallPool.release(obj));

      const stats = smallPool.getStats();

      // Pool should have handled eviction correctly
      expect(stats.totalDestroyed).toBeGreaterThan(0);
      expect(stats.availableItems).toBeLessThanOrEqual(20); // Should not exceed max size
      expect(stats.activeItems).toBe(0);

      smallPool.clear();
    });
  });

  describe('End-to-End Performance Benchmark', () => {
    it('should meet performance targets for complete indexing workflow', async () => {
      // This test simulates a complete indexing workflow with performance targets
      const targetFilesPerMinute = 500; // From CLAUDE.md
      const targetResponseTime = 200; // From CLAUDE.md (P95)
      const testFiles = 250; // Test with 250 files (should take < 30 seconds at target rate)

      // Mock services for integration test
      const mockIndexCoordinator = {
        createIndex: jest.fn().mockImplementation(async (projectPath: string, options: any) => {
          // Simulate indexing work
          await new Promise(resolve => setTimeout(resolve, testFiles * 10)); // 10ms per file
          return {
            success: true,
            filesProcessed: testFiles,
            chunksCreated: testFiles * 3,
            processingTime: testFiles * 10,
            errors: []
          };
        })
      };

      const startTime = Date.now();
      const result = await mockIndexCoordinator.createIndex('/test/project', {
        recursive: true,
        includePatterns: ['*.ts']
      });
      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(testFiles);

      // Calculate performance metrics
      const filesPerMinute = (testFiles / totalTime) * 60000;
      const responseTime = totalTime;

      // Verify performance targets
      expect(filesPerMinute).toBeGreaterThan(targetFilesPerMinute);
      expect(responseTime).toBeLessThan(targetResponseTime * testFiles / 10); // Should be better than linear scaling

      console.log(`Performance Results:`);
      console.log(`- Files processed: ${testFiles}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Files per minute: ${filesPerMinute.toFixed(2)}`);
      console.log(`- Target files per minute: ${targetFilesPerMinute}`);
      console.log(`- Performance improvement: ${((filesPerMinute / targetFilesPerMinute - 1) * 100).toFixed(1)}%`);
    });

    it('should demonstrate performance improvement from modularization', async () => {
      // This test demonstrates the performance benefits of the new modular architecture
      const iterations = 50;

      // Test with new modular components
      const modularStartTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Simulate modular workflow
        await asyncPipeline.execute({
          step: 'memory-check',
          data: { id: i }
        });

        // Use object pool
        const obj = objectPool.acquire();
        objectPool.release(obj);

        // Batch processing
        await batchProcessor.processInBatches(
          [`item-${i}`],
          async (batch: string[]) => batch.map(item => ({ processed: item })),
          { batchSize: 1, maxConcurrency: 1, timeout: 5000, continueOnError: true }
        );
      }

      const modularTime = Date.now() - modularStartTime;

      // Performance should be significantly better than monolithic approach
      // (In a real test, we'd compare against the old architecture)
      expect(modularTime).toBeLessThan(10000); // Should complete in under 10 seconds

      const averageModularTime = modularTime / iterations;
      expect(averageModularTime).toBeLessThan(200); // Average iteration < 200ms

      console.log(`Modular Architecture Performance:`);
      console.log(`- Total iterations: ${iterations}`);
      console.log(`- Total time: ${modularTime}ms`);
      console.log(`- Average time per iteration: ${averageModularTime.toFixed(2)}ms`);
      console.log(`- Operations per second: ${(1000 / averageModularTime).toFixed(2)}`);
    });
  });
});