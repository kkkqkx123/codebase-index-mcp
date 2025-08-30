import { IndexCoordinator } from '../../src/services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../../src/services/storage/StorageCoordinator';
import { AsyncPipeline } from '../../src/services/infrastructure/AsyncPipeline';
import { BatchProcessor } from '../../src/services/processing/BatchProcessor';
import { MemoryManager } from '../../src/services/processing/MemoryManager';
import { ObjectPool } from '../../src/services/infrastructure/ObjectPool';
import { ChangeDetectionService } from '../../src/services/filesystem/ChangeDetectionService';
import { ParserService } from '../../src/services/parser/ParserService';
import { FileSystemTraversal } from '../../src/services/filesystem/FileSystemTraversal';
import { TransactionCoordinator } from '../../src/services/sync/TransactionCoordinator';
import { VectorStorageService } from '../../src/services/storage/VectorStorageService';
import { GraphPersistenceService } from '../../src/services/storage/GraphPersistenceService';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { ConfigService } from '../../src/config/ConfigService';
import { HashUtils } from '../../src/utils/HashUtils';
import { createTestContainer } from '../setup';

describe('Module Collaboration Integration Tests', () => {
  let container: any;
  let indexCoordinator: IndexCoordinator;
  let storageCoordinator: StorageCoordinator;
  let asyncPipeline: AsyncPipeline;
  let batchProcessor: BatchProcessor;
  let memoryManager: MemoryManager;
  let objectPool: ObjectPool<string>;
  let changeDetectionService: ChangeDetectionService;
  let parserService: ParserService;
  let fileSystemTraversal: FileSystemTraversal;
  let transactionCoordinator: TransactionCoordinator;
  let vectorStorage: VectorStorageService;
  let graphStorage: GraphPersistenceService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;

  beforeEach(async () => {
    container = createTestContainer();

    // Get all services from container
    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    configService = container.get(ConfigService);

    // Create mock implementations for services that need DI
    changeDetectionService = {
      detectChanges: jest.fn(),
      startWatching: jest.fn(),
      stopWatching: jest.fn()
    } as any;

    parserService = {
      parseFiles: jest.fn(),
      parseFile: jest.fn(),
      getSupportedLanguages: jest.fn()
    } as any;

    fileSystemTraversal = {
      traverseDirectory: jest.fn(),
      getFileStats: jest.fn()
    } as any;

    vectorStorage = {
      storeChunks: jest.fn(),
      deleteChunks: jest.fn(),
      search: jest.fn(),
      getChunkById: jest.fn(),
      getChunksByFile: jest.fn(),
      getProjectStats: jest.fn()
    } as any;

    graphStorage = {
      storeChunks: jest.fn(),
      deleteNodes: jest.fn(),
      search: jest.fn(),
      getNodeById: jest.fn(),
      getNodesByFile: jest.fn(),
      getRelationships: jest.fn(),
      getProjectStats: jest.fn()
    } as any;

    transactionCoordinator = {
      beginTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      addVectorOperation: jest.fn(),
      addGraphOperation: jest.fn(),
      getStatus: jest.fn()
    } as any;

    // Create actual instances of performance components
    asyncPipeline = new AsyncPipeline({
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 100,
      continueOnError: true,
      enableMetrics: true
    }, loggerService);

    batchProcessor = new BatchProcessor(loggerService);

    memoryManager = new MemoryManager(loggerService, {
      checkInterval: 1000,
      thresholds: { warning: 70, critical: 85, emergency: 95 },
      gcThreshold: 80,
      maxMemoryMB: 512
    });

    objectPool = new ObjectPool<string>({
      initialSize: 10,
      maxSize: 100,
      creator: () => `file-${Math.random().toString(36).substr(2, 9)}`,
      resetter: (obj: string) => obj,
      validator: (obj: string) => typeof obj === 'string',
      destroy: (obj: string) => { },
      evictionPolicy: 'lru'
    }, loggerService);

    // Create coordinators
    storageCoordinator = new StorageCoordinator(
      loggerService,
      errorHandlerService,
      configService,
      vectorStorage,
      graphStorage,
      transactionCoordinator
    );

    indexCoordinator = new IndexCoordinator(
      loggerService,
      errorHandlerService,
      configService,
      changeDetectionService,
      parserService,
      storageCoordinator,
      fileSystemTraversal,
      asyncPipeline,
      batchProcessor,
      memoryManager
    );
  });

  afterEach(() => {
    if (memoryManager.isMonitoring()) {
      memoryManager.stopMonitoring();
    }
    objectPool.clear();
    asyncPipeline.clearSteps();
  });

  describe('Complete Indexing Workflow Integration', () => {
    const mockProjectPath = '/test/project';
    const mockProjectId = 'test_project_hash';

    beforeEach(() => {
      // Setup common mocks
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue({ hash: mockProjectId });

      const mockTraversalResult = {
        files: [
          { path: '/test/project/file1.ts', size: 1000 },
          { path: '/test/project/file2.ts', size: 1500 },
          { path: '/test/project/file3.ts', size: 800 }
        ],
        directories: [],
        errors: []
      };
      fileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const mockParseResults = [
        { filePath: '/test/project/file1.ts', language: 'typescript', metadata: { size: 1000 } },
        { filePath: '/test/project/file2.ts', language: 'typescript', metadata: { size: 1500 } },
        { filePath: '/test/project/file3.ts', language: 'javascript', metadata: { size: 800 } }
      ];
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      transactionCoordinator.beginTransaction.mockResolvedValue(undefined);
      transactionCoordinator.addVectorOperation.mockResolvedValue(undefined);
      transactionCoordinator.addGraphOperation.mockResolvedValue(undefined);
      transactionCoordinator.commitTransaction.mockResolvedValue(true);
    });

    it('should successfully complete full indexing workflow with all components', async () => {
      // Setup pipeline execution mock
      const mockPipelineResult = {
        success: true,
        data: {
          traversalResult: {
            files: [
              { path: '/test/project/file1.ts', size: 1000 },
              { path: '/test/project/file2.ts', size: 1500 },
              { path: '/test/project/file3.ts', size: 800 }
            ]
          },
          storageResult: { success: true, chunksStored: 15 }
        },
        totalTime: 2500,
        steps: [
          { success: true, error: null },
          { success: true, error: null },
          { success: true, error: null },
          { success: true, error: null }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath, {
        recursive: true,
        includePatterns: ['*.ts', '*.js'],
        maxFileSize: 1024 * 1024
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(3);
      expect(result.chunksCreated).toBe(15);
      expect(result.processingTime).toBe(2500);

      // Verify all components were used
      expect(asyncPipeline.execute).toHaveBeenCalled();
      expect(fileSystemTraversal.traverseDirectory).toHaveBeenCalled();
      expect(parserService.parseFiles).toHaveBeenCalled();
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.commitTransaction).toHaveBeenCalled();

      // Verify pipeline metrics
      const metrics = asyncPipeline.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
    });

    it('should handle memory constraints during indexing', async () => {
      // Mock memory constraint
      memoryManager.checkMemory = jest.fn().mockReturnValue(false); // Insufficient memory

      const mockPipelineResult = {
        success: false,
        error: 'Pipeline step failed: memory-check',
        data: null,
        totalTime: 1000,
        steps: [
          { success: false, error: 'Insufficient memory for indexing operation' }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Insufficient memory');

      // Verify memory check was used
      expect(memoryManager.checkMemory).toHaveBeenCalledWith(75);
    });

    it('should use batch processing for large file sets', async () => {
      // Create large file set
      const largeFileSet = Array.from({ length: 100 }, (_, i) => ({
        path: `/test/project/file${i}.ts`,
        size: 1000 + i
      }));

      fileSystemTraversal.traverseDirectory.mockResolvedValue({
        files: largeFileSet,
        directories: [],
        errors: []
      });

      // Mock batch processing
      const mockParseResults = largeFileSet.map(file => ({
        filePath: file.path,
        language: 'typescript',
        metadata: { size: file.size }
      }));
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      const mockPipelineResult = {
        success: true,
        data: {
          traversalResult: { files: largeFileSet },
          storageResult: { success: true, chunksStored: 250 }
        },
        totalTime: 8000,
        steps: [
          { success: true, error: null },
          { success: true, error: null },
          { success: true, error: null },
          { success: true, error: null }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex(mockProjectPath, {
        batchSize: 20,
        maxConcurrency: 3
      });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(100);
      expect(result.chunksCreated).toBe(250);

      // Verify batch processor was configured correctly
      expect(configService.get).toHaveBeenCalledWith('indexing');
    });
  });

  describe('Storage Coordination Integration', () => {
    const mockFiles = [
      {
        filePath: '/test/project/file1.ts',
        language: 'typescript',
        metadata: { size: 1000 },
        chunks: [
          {
            id: 'chunk_1',
            content: 'function test() { return true; }',
            filePath: '/test/project/file1.ts',
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            chunkType: 'function',
            metadata: {}
          }
        ]
      }
    ];

    it('should coordinate storage between vector and graph databases', async () => {
      await storageCoordinator.store(mockFiles, 'test_project');

      // Verify transaction coordination
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storeChunks',
          chunks: expect.arrayContaining([
            expect.objectContaining({ id: 'chunk_1' })
          ])
        }),
        expect.objectContaining({
          type: 'deleteChunks',
          chunkIds: ['chunk_1']
        })
      );
      expect(transactionCoordinator.addGraphOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storeChunks',
          chunks: expect.arrayContaining([
            expect.objectContaining({ id: 'chunk_1' })
          ])
        }),
        expect.objectContaining({
          type: 'deleteNodes',
          nodeIds: ['chunk_1']
        })
      );
      expect(transactionCoordinator.commitTransaction).toHaveBeenCalled();
    });

    it('should handle transaction rollback on storage failure', async () => {
      transactionCoordinator.addGraphOperation.mockRejectedValue(new Error('Graph storage failed'));

      await storageCoordinator.store(mockFiles, 'test_project');

      // Verify rollback was called
      expect(transactionCoordinator.rollbackTransaction).toHaveBeenCalled();
    });

    it('should coordinate file deletion across databases', async () => {
      jest.spyOn(storageCoordinator as any, 'getChunkIdsForFiles').mockResolvedValue(['chunk_1', 'chunk_2']);

      await storageCoordinator.deleteFiles(['/test/project/file1.ts']);

      // Verify coordinated deletion
      expect(transactionCoordinator.addVectorOperation).toHaveBeenCalledWith(
        { type: 'deleteChunks', chunkIds: ['chunk_1', 'chunk_2'] },
        { type: 'restoreChunks', chunkIds: ['chunk_1', 'chunk_2'] }
      );
      expect(transactionCoordinator.addGraphOperation).toHaveBeenCalledWith(
        { type: 'deleteNodes', nodeIds: ['chunk_1', 'chunk_2'] },
        { type: 'restoreNodes', nodeIds: ['chunk_1', 'chunk_2'] }
      );
    });
  });

  describe('Performance Components Integration', () => {
    it('should integrate async pipeline with batch processing', async () => {
      const testData = Array.from({ length: 50 }, (_, i) => `item-${i}`);

      // Setup pipeline with batch processing step
      asyncPipeline.clearSteps();
      asyncPipeline.addStep({
        name: 'batch-process',
        execute: async (data: any) => {
          const result = await batchProcessor.processInBatches(
            data.items,
            async (batch: string[]) => {
              return batch.map(item => ({ processed: item, timestamp: Date.now() }));
            },
            {
              batchSize: 10,
              maxConcurrency: 2,
              timeout: 30000,
              continueOnError: true
            }
          );
          return { ...data, batchResult: result };
        },
        timeout: 60000
      });

      const result = await asyncPipeline.execute({ items: testData });

      expect(result.success).toBe(true);
      expect(result.data.batchResult.success).toBe(true);
      expect(result.data.batchResult.processedItems).toBe(50);

      // Verify both components worked together
      const pipelineMetrics = asyncPipeline.getMetrics();
      expect(pipelineMetrics.totalExecutions).toBe(1);
      expect(pipelineMetrics.successfulExecutions).toBe(1);
    });

    it('should integrate memory management with object pooling', async () => {
      const memoryUpdates: any[] = [];
      memoryManager.onMemoryUpdate((usage: any) => {
        memoryUpdates.push(usage);
      });

      memoryManager.startMonitoring();

      // Use object pool extensively
      const acquiredObjects: string[] = [];
      for (let i = 0; i < 20; i++) {
        const obj = objectPool.acquire();
        acquiredObjects.push(obj);
      }

      // Release all objects
      acquiredObjects.forEach(obj => objectPool.release(obj));

      // Wait for memory monitoring
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify memory monitoring was active
      expect(memoryUpdates.length).toBeGreaterThan(0);
      expect(memoryUpdates[0]).toHaveProperty('heapUsed');
      expect(memoryUpdates[0]).toHaveProperty('percentageUsed');

      // Verify object pool statistics
      const poolStats = objectPool.getStats();
      expect(poolStats.totalAcquired).toBe(20);
      expect(poolStats.totalReleased).toBe(20);
    });

    it('should handle performance bottlenecks gracefully', async () => {
      // Simulate memory pressure
      memoryManager.checkMemory = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      // Setup pipeline that depends on memory
      asyncPipeline.clearSteps();
      asyncPipeline.addStep({
        name: 'memory-dependent-step',
        execute: async (data: any) => {
          const memoryOk = memoryManager.checkMemory(75);
          if (!memoryOk) {
            throw new Error('Memory constraint reached');
          }
          return { ...data, memoryOk };
        },
        timeout: 5000,
        retryAttempts: 2
      });

      const result = await asyncPipeline.execute({ test: 'data' });

      // Should handle memory constraints gracefully
      expect(result).toBeDefined();
      const memoryMetrics = asyncPipeline.getMetrics();
      expect(memoryMetrics.totalExecutions).toBe(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should propagate errors through the entire indexing pipeline', async () => {
      // Simulate parser failure
      parserService.parseFiles.mockRejectedValue(new Error('Parser timeout'));

      const mockPipelineResult = {
        success: false,
        error: 'Pipeline step failed: batch-parsing',
        data: null,
        totalTime: 5000,
        steps: [
          { success: true, error: null },
          { success: true, error: null },
          { success: false, error: 'Parser timeout' },
          { success: false, error: 'Pipeline step failed: batch-parsing' }
        ]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await indexCoordinator.createIndex('/test/project');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Pipeline step failed: batch-parsing');

      // Verify error was logged at multiple levels
      expect(loggerService.error).toHaveBeenCalledWith('Index creation failed', expect.any(Object));
    });

    it('should handle partial failures in batch processing', async () => {
      const failingProcessor = jest.fn()
        .mockResolvedValueOnce(['processed-1', 'processed-2'])
        .mockRejectedValueOnce(new Error('Batch processing failed'))
        .mockResolvedValueOnce(['processed-5', 'processed-6']);

      const result = await batchProcessor.processInBatches(
        ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6'],
        failingProcessor,
        {
          batchSize: 2,
          maxConcurrency: 2,
          timeout: 30000,
          continueOnError: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.processedItems).toBe(4); // Partial success
    });

    it('should coordinate transaction rollback on multiple failures', async () => {
      transactionCoordinator.addVectorOperation.mockRejectedValue(new Error('Vector storage unavailable'));
      transactionCoordinator.addGraphOperation.mockRejectedValue(new Error('Graph storage unavailable'));

      await storageCoordinator.store([{
        filePath: '/test/project/file1.ts',
        language: 'typescript',
        metadata: {},
        chunks: []
      }], 'test_project');

      // Verify rollback was called despite multiple failures
      expect(transactionCoordinator.rollbackTransaction).toHaveBeenCalled();
      expect(transactionCoordinator.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Module Communication', () => {
    it('should enable communication between indexing and storage coordinators', async () => {
      // Test that IndexCoordinator can call StorageCoordinator methods
      const mockFiles = [
        {
          filePath: '/test/project/file1.ts',
          language: 'typescript',
          metadata: {},
          chunks: []
        }
      ];

      await storageCoordinator.store(mockFiles, 'test_project');

      // Verify the call was made
      expect(transactionCoordinator.beginTransaction).toHaveBeenCalled();

      // Now test that IndexCoordinator can use this
      const mockProjectId = { hash: 'test_project' };
      jest.spyOn(HashUtils, 'calculateDirectoryHash').mockResolvedValue(mockProjectId);

      const mockTraversalResult = {
        files: [{ path: '/test/project/file1.ts', size: 1000 }],
        directories: [],
        errors: []
      };
      fileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const mockParseResults = [
        { filePath: '/test/project/file1.ts', language: 'typescript', metadata: {} }
      ];
      parserService.parseFiles.mockResolvedValue(mockParseResults);

      const mockPipelineResult = {
        success: true,
        data: {
          traversalResult: mockTraversalResult,
          storageResult: { success: true, chunksStored: 5 }
        },
        totalTime: 1500,
        steps: [{ success: true, error: null }]
      };
      asyncPipeline.execute.mockResolvedValue(mockPipelineResult);

      await indexCoordinator.createIndex('/test/project');

      // Verify cross-module communication
      expect(asyncPipeline.execute).toHaveBeenCalled();
    });

    it('should share configuration across modules', async () => {
      // Test that configuration is shared between components
      configService.get = jest.fn().mockImplementation((key: string) => {
        if (key === 'indexing') {
          return {
            batchSize: 25,
            maxConcurrency: 4,
            timeout: 45000
          };
        }
        return {};
      });

      // Use batch processor with shared configuration
      await batchProcessor.processInBatches(
        ['item-1', 'item-2', 'item-3'],
        async (batch: string[]) => batch.map(item => ({ processed: item })),
        {
          batchSize: 25,
          maxConcurrency: 4,
          timeout: 45000,
          continueOnError: true
        }
      );

      // Verify configuration was accessed
      expect(configService.get).toHaveBeenCalledWith('indexing');
    });

    it('should coordinate logging across all modules', async () => {
      // Perform operations that should trigger logging in multiple modules
      memoryManager.startMonitoring();
      await storageCoordinator.store([{
        filePath: '/test/project/file1.ts',
        language: 'typescript',
        metadata: {},
        chunks: []
      }], 'test_project');

      // Verify logging occurred at multiple levels
      expect(loggerService.info).toHaveBeenCalledWith('Memory monitoring started', expect.any(Object));
      expect(loggerService.info).toHaveBeenCalledWith('Storing files in databases', expect.any(Object));
    });
  });

  describe('Resource Management Integration', () => {
    it('should manage object pool lifecycle with indexing operations', async () => {
      const acquiredObjects: string[] = [];

      // Acquire objects during simulated indexing
      for (let i = 0; i < 15; i++) {
        const obj = objectPool.acquire();
        acquiredObjects.push(obj);
      }

      // Release some objects
      for (let i = 0; i < 10; i++) {
        objectPool.release(acquiredObjects[i]);
      }

      // Verify pool statistics
      let stats = objectPool.getStats();
      expect(stats.activeItems).toBe(5); // 15 acquired - 10 released
      expect(stats.availableItems).toBe(10);

      // Release remaining objects
      for (let i = 10; i < 15; i++) {
        objectPool.release(acquiredObjects[i]);
      }

      stats = objectPool.getStats();
      expect(stats.activeItems).toBe(0);
      expect(stats.availableItems).toBe(15);
    });

    it('should coordinate memory monitoring with processing activities', async () => {
      const memoryUpdates: any[] = [];
      memoryManager.onMemoryUpdate((usage: any) => {
        memoryUpdates.push(usage);
      });

      memoryManager.startMonitoring();

      // Perform memory-intensive operations
      await batchProcessor.processInBatches(
        Array.from({ length: 100 }, (_, i) => `item-${i}`),
        async (batch: string[]) => {
          // Simulate memory-intensive processing
          const largeArray = new Array(1000).fill('data');
          return batch.map(item => ({ processed: item, dataSize: largeArray.length }));
        },
        {
          batchSize: 20,
          maxConcurrency: 3,
          timeout: 30000,
          continueOnError: true
        }
      );

      // Wait for memory monitoring to capture updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify memory monitoring tracked the activity
      expect(memoryUpdates.length).toBeGreaterThan(0);
      expect(memoryUpdates[memoryUpdates.length - 1]).toHaveProperty('heapUsed');
    });
  });
});