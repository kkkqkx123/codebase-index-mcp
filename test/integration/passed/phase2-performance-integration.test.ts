import { AsyncPipeline, PipelineStep, PipelineOptions } from '../../../src/services/infrastructure/AsyncPipeline';
import { ObjectPool, PoolOptions } from '../../../src/services/infrastructure/ObjectPool';
import { BatchProcessor, BatchOptions } from '../../../src/services/processing/BatchProcessor';
import { MemoryManager, MemoryManagerOptions } from '../../../src/services/processing/MemoryManager';

describe('Phase 2 Performance Components Integration', () => {
  let asyncPipeline: AsyncPipeline;
  let objectPool: ObjectPool<string>;
  let batchProcessor: BatchProcessor;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    // Initialize components with test configuration
    const pipelineOptions: PipelineOptions = {
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
      continueOnError: true,
      enableMetrics: true
    };

    const poolOptions: PoolOptions<string> = {
      initialSize: 5,
      maxSize: 20,
      creator: () => `test-${Math.random().toString(36).substr(2, 9)}`,
      resetter: (obj: string) => obj,
      validator: (obj: string) => true, // Always valid for testing
      destroy: (obj: string) => {},
      evictionPolicy: 'lru'
    };

    const memoryOptions: MemoryManagerOptions = {
      checkInterval: 1000,
      thresholds: {
        warning: 70,
        critical: 85,
        emergency: 95
      },
      gcThreshold: 80,
      maxMemoryMB: 512
    };

    asyncPipeline = new AsyncPipeline(pipelineOptions, console);
    objectPool = new ObjectPool(poolOptions, console);
    batchProcessor = new BatchProcessor(console);
    memoryManager = new MemoryManager(console, memoryOptions);
  });

  afterEach(() => {
    memoryManager.stopMonitoring();
    objectPool.clear();
    asyncPipeline.clearSteps();
  });

  describe('AsyncPipeline Integration', () => {
    it('should execute a complete indexing pipeline successfully', async () => {
      // Setup pipeline steps simulating indexing workflow
      asyncPipeline.clearSteps();

      const testData = {
        projectPath: '/test/project',
        files: ['file1.ts', 'file2.ts', 'file3.ts'],
        options: { batchSize: 2 }
      };

      asyncPipeline
        .addStep({
          name: 'memory-check',
          execute: async (data: any) => {
            const memoryOk = memoryManager.checkMemory(75);
            expect(memoryOk).toBe(true);
            return { ...data, memoryStatus: 'ok' };
          },
          timeout: 1000
        })
        .addStep({
          name: 'file-processing',
          execute: async (data: any) => {
            // Simulate file processing using object pool
            const processedFiles = data.files.map((file: string) => {
              const filePath = objectPool.acquire();
              objectPool.release(filePath);
              return { path: file, processed: true };
            });
            return { ...data, processedFiles };
          },
          timeout: 2000
        })
        .addStep({
          name: 'batch-processing',
          execute: async (data: any) => {
            const batchOptions: BatchOptions = {
              batchSize: data.options.batchSize,
              maxConcurrency: 2,
              timeout: 5000,
              continueOnError: true
            };

            const result = await batchProcessor.processInBatches(
              data.processedFiles,
              async (batch: any[]) => {
                return batch.map(item => ({ ...item, batched: true }));
              },
              batchOptions
            );

            return { ...data, batchResult: result };
          },
          timeout: 3000
        });

      const result = await asyncPipeline.execute(testData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.processedFiles).toHaveLength(3);
      expect(result.data.batchResult.success).toBe(true);
      expect(result.data.batchResult.processedItems).toBe(3);

      // Verify pipeline metrics
      const metrics = asyncPipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.stepMetrics.size).toBe(3);
    });

    it('should handle pipeline failures gracefully', async () => {
      // Create a separate pipeline with continueOnError: false
      const failFastPipeline = new AsyncPipeline({
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 100,
        continueOnError: false,
        enableMetrics: true
      }, console);

      failFastPipeline
        .addStep({
          name: 'successful-step',
          execute: async (data: any) => {
            return { ...data, step1: 'completed' };
          },
          timeout: 1000
        })
        .addStep({
          name: 'failing-step',
          execute: async (data: any) => {
            throw new Error('Simulated failure');
          },
          timeout: 1000
        })
        .addStep({
          name: 'should-not-run',
          execute: async (data: any) => {
            return { ...data, step3: 'completed' };
          },
          timeout: 1000
        });

      const result = await failFastPipeline.execute({ test: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated failure');
      expect(result.steps).toHaveLength(2); // Only 2 steps executed before pipeline stopped
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(false);
      expect(result.steps[1].error).toContain('Simulated failure');

      // Verify metrics reflect failure
      const metrics = failFastPipeline.getMetrics();
      expect(metrics.failedExecutions).toBeGreaterThan(0);
    });

    it('should retry failed steps with exponential backoff', async () => {
      let attemptCount = 0;
      
      asyncPipeline.clearSteps();

      asyncPipeline.addStep({
        name: 'retry-step',
        execute: async (data: any) => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { ...data, success: true };
        },
        timeout: 1000,
        retryAttempts: 3,
        retryDelay: 50
      });

      const result = await asyncPipeline.execute({ test: 'data' });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(result.steps[0].retryCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ObjectPool Integration', () => {
    it('should efficiently manage object lifecycle', async () => {
      const initialStats = objectPool.getStats();
      
      // Acquire multiple objects
      const objects: string[] = [];
      for (let i = 0; i < 10; i++) {
        objects.push(objectPool.acquire());
      }

      const afterAcquireStats = objectPool.getStats();
      expect(afterAcquireStats.totalAcquired).toBeGreaterThan(initialStats.totalAcquired);
      expect(afterAcquireStats.activeItems).toBe(objects.length);

      // Release all objects
      objects.forEach(obj => objectPool.release(obj));

      const afterReleaseStats = objectPool.getStats();
      expect(afterReleaseStats.totalReleased).toBeGreaterThan(initialStats.totalReleased);
      expect(afterReleaseStats.activeItems).toBe(0);
      expect(afterReleaseStats.availableItems).toBeGreaterThan(0);
    });

    it('should handle pool eviction correctly', async () => {
      // Create a small pool to test eviction
      const smallPool = new ObjectPool<string>({
        initialSize: 2,
        maxSize: 3,
        creator: () => `obj-${Math.random().toString(36).substr(2, 9)}`,
        resetter: (obj: string) => obj,
        validator: (obj: string) => true,
        destroy: (obj: string) => {},
        evictionPolicy: 'lru'
      });

      // Acquire objects to fill pool
      const obj1 = smallPool.acquire();
      const obj2 = smallPool.acquire();
      const obj3 = smallPool.acquire(); // This creates a new object since pool is empty

      expect(smallPool.getTotalSize()).toBe(3);

      // Release all objects
      smallPool.release(obj1);
      smallPool.release(obj2);
      smallPool.release(obj3);

      expect(smallPool.getPoolSize()).toBe(3); // Pool should be full

      // Acquire another object - this should work since pool has space
      const obj4 = smallPool.acquire();
      expect(smallPool.getPoolSize()).toBe(2); // One object taken from pool

      smallPool.clear();
    });

    it('should validate objects before returning to pool', async () => {
      const validatingPool = new ObjectPool<string>({
        initialSize: 2,
        maxSize: 5,
        creator: () => `valid-${Math.random().toString(36).substr(2, 9)}`,
        resetter: (obj: string) => obj,
        validator: (obj: string) => obj.startsWith('valid-'),
        destroy: (obj: string) => {},
        evictionPolicy: 'lru'
      });

      const obj = validatingPool.acquire();
      
      // Test that valid objects are accepted
      validatingPool.release(obj);
      
      const stats = validatingPool.getStats();
      expect(stats.totalDestroyed).toBe(0); // Valid object should not be destroyed
      expect(validatingPool.getPoolSize()).toBe(2); // Pool returned to initial size after release

      validatingPool.clear();
    });
  });

  describe('BatchProcessor Integration', () => {
    it('should process large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      
      const result = await batchProcessor.processInBatches(
        largeDataset,
        async (batch: string[]) => {
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, 10));
          return batch.map(item => ({ processed: item, timestamp: Date.now() }));
        },
        {
          batchSize: 10,
          maxConcurrency: 3,
          timeout: 30000,
          continueOnError: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.processedItems).toBe(100);
      expect(result.results).toHaveLength(100);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle batch processing failures gracefully', async () => {
      const dataset = ['item1', 'item2', 'item3', 'item4'];
      
      const result = await batchProcessor.processInBatches(
        dataset,
        async (batch: string[]) => {
          if (batch.includes('item3')) {
            throw new Error('Batch processing failed');
          }
          return batch.map(item => ({ processed: item }));
        },
        {
          batchSize: 2,
          maxConcurrency: 2,
          timeout: 5000,
          continueOnError: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processedItems).toBeLessThan(4);
    });

    it('should respect concurrency limits', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      const result = await batchProcessor.processInBatches(
        Array.from({ length: 20 }, (_, i) => `item-${i}`),
        async (batch: string[]) => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 50));
          
          concurrentCount--;
          return batch.map(item => ({ processed: item }));
        },
        {
          batchSize: 4,
          maxConcurrency: 3,
          timeout: 30000,
          continueOnError: true
        }
      );

      expect(result.success).toBe(true);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('MemoryManager Integration', () => {
    it('should monitor memory usage effectively', async () => {
      const memoryUpdates: Array<any> = [];
      
      memoryManager.onMemoryUpdate((usage: any) => {
        memoryUpdates.push(usage);
      });

      memoryManager.startMonitoring();

      // Wait for a few memory checks
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(memoryUpdates.length).toBeGreaterThan(0);
      
      const latestUpdate = memoryUpdates[memoryUpdates.length - 1];
      expect(latestUpdate).toHaveProperty('heapUsed');
      expect(latestUpdate).toHaveProperty('heapTotal');
      expect(latestUpdate).toHaveProperty('percentageUsed');

      memoryManager.stopMonitoring();
    });

    it('should provide accurate memory status', () => {
      const status = memoryManager.getMemoryStatus();
      
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('usage');
      expect(status).toHaveProperty('recommendations');
      
      expect(['healthy', 'warning', 'critical', 'emergency']).toContain(status.status);
      expect(Array.isArray(status.recommendations)).toBe(true);
    });

    it('should handle garbage collection when available', () => {
      // Mock global.gc for testing
      const originalGC = (global as any).gc;
      (global as any).gc = jest.fn();

      const result = memoryManager.forceGarbageCollection();
      
      expect(result).toBe(true);
      expect((global as any).gc).toHaveBeenCalled();

      // Restore original
      (global as any).gc = originalGC;
    });
  });

  describe('End-to-End Performance Integration', () => {
    it('should handle complete indexing workflow with performance optimization', async () => {
      // Setup complete indexing pipeline
      asyncPipeline.clearSteps();

      const mockFiles = Array.from({ length: 50 }, (_, i) => `/path/to/file${i}.ts`);
      
      asyncPipeline
        .addStep({
          name: 'memory-validation',
          execute: async (data: any) => {
            const memoryStatus = memoryManager.getMemoryStatus();
            if (memoryStatus.status === 'emergency') {
              throw new Error('Insufficient memory');
            }
            return { ...data, memoryStatus: memoryStatus.status };
          },
          timeout: 1000
        })
        .addStep({
          name: 'file-collection',
          execute: async (data: any) => {
            // Use object pool to manage file paths
            const processedFiles = data.files.map((file: string) => {
              const filePath = objectPool.acquire();
              objectPool.release(filePath);
              return { path: file, size: Math.random() * 1000 };
            });
            return { ...data, processedFiles };
          },
          timeout: 2000
        })
        .addStep({
          name: 'batch-file-processing',
          execute: async (data: any) => {
            const result = await batchProcessor.processInBatches(
              data.processedFiles,
              async (batch: any[]) => {
                return batch.map(file => ({
                  ...file,
                  processed: true,
                  chunks: Math.floor(Math.random() * 10) + 1
                }));
              },
              {
                batchSize: 10,
                maxConcurrency: 2,
                timeout: 10000,
                continueOnError: true
              }
            );
            return { ...data, processingResult: result };
          },
          timeout: 15000
        });

      const result = await asyncPipeline.execute({
        files: mockFiles,
        projectId: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data.memoryStatus).toBeDefined();
      expect(result.data.processedFiles).toHaveLength(50);
      expect(result.data.processingResult.success).toBe(true);
      expect(result.data.processingResult.processedItems).toBe(50);

      // Verify all components worked together
      const pipelineMetrics = asyncPipeline.getMetrics();
      const poolStats = objectPool.getStats();
      
      expect(pipelineMetrics.totalExecutions).toBe(1);
      expect(pipelineMetrics.successfulExecutions).toBe(1);
      expect(poolStats.totalAcquired).toBeGreaterThan(0);
    });

    it('should maintain performance under load', async () => {
      const iterations = 5;
      const results: any[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const result = await batchProcessor.processInBatches(
          Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`),
          async (batch: string[]) => {
            // Use object pool for temporary objects
            const tempObj = objectPool.acquire();
            objectPool.release(tempObj);
            
            await new Promise(resolve => setTimeout(resolve, 5));
            return batch.map(item => ({ processed: item, iteration: i }));
          },
          {
            batchSize: 20,
            maxConcurrency: 2,
            timeout: 30000,
            continueOnError: true
          }
        );

        results.push({
          iteration: i,
          processingTime: result.processingTime,
          success: result.success
        });
      }

      // Verify consistent performance
      expect(results.every(r => r.success)).toBe(true);
      
      const processingTimes = results.map(r => r.processingTime);
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxTime = Math.max(...processingTimes);
      const minTime = Math.min(...processingTimes);

      // Performance should be relatively consistent (within 50% variance)
      expect((maxTime - minTime) / avgTime).toBeLessThan(0.5);
    });
  });
});