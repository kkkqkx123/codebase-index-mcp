import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import {
  BatchProcessingMetrics,
  BatchOperationMetrics,
} from '../monitoring/BatchProcessingMetrics';

export interface ProcessingTask<T, R> {
  id: string;
  item: T;
  processor: (item: T) => Promise<R>;
  priority?: number;
  retryCount?: number;
  timeout?: number;
}

export interface ProcessingOptions {
  maxConcurrency?: number;
  batchSize?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  memoryThreshold?: number;
  continueOnError?: boolean;
}

export interface ProcessingResult<T, R> {
  taskId: string;
  success: boolean;
  result?: R;
  error?: string;
  processingTime: number;
  retryCount: number;
}

export interface BatchProcessingResult<T, R> {
  batchId: string;
  success: boolean;
  results: ProcessingResult<T, R>[];
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  processingTime: number;
  throughput: number; // items per second
  memoryUsage: {
    start: number;
    end: number;
    peak: number;
  };
}

@injectable()
export class ConcurrentProcessingService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;

  // Default configuration
  private maxConcurrency: number = 5;
  private defaultBatchSize: number = 50;
  private maxBatchSize: number = 500;
  private defaultTimeout: number = 30000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private memoryThreshold: number = 80;
  private continueOnError: boolean = true;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.batchMetrics = batchMetrics;

    this.initializeConfig();
  }

  private initializeConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');

    this.maxConcurrency = batchConfig.maxConcurrentOperations;
    this.defaultBatchSize = batchConfig.defaultBatchSize;
    this.maxBatchSize = batchConfig.maxBatchSize;
    this.defaultTimeout = batchConfig.processingTimeout;
    this.retryAttempts = batchConfig.retryAttempts;
    this.retryDelay = batchConfig.retryDelay;
    this.memoryThreshold = batchConfig.memoryThreshold;
    this.continueOnError = batchConfig.continueOnError;

    this.logger.info('Concurrent processing service initialized', {
      maxConcurrency: this.maxConcurrency,
      defaultBatchSize: this.defaultBatchSize,
      maxBatchSize: this.maxBatchSize,
      defaultTimeout: this.defaultTimeout,
      retryAttempts: this.retryAttempts,
      memoryThreshold: this.memoryThreshold,
      continueOnError: this.continueOnError,
    });
  }

  async processConcurrently<T, R>(
    tasks: ProcessingTask<T, R>[],
    options: ProcessingOptions = {}
  ): Promise<BatchProcessingResult<T, R>> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    let peakMemory = startMemory;

    // Apply options with defaults
    const maxConcurrency = options.maxConcurrency || this.maxConcurrency;
    const batchSize = options.batchSize || this.defaultBatchSize;
    const timeout = options.timeout || this.defaultTimeout;
    const retryAttempts = options.retryAttempts || this.retryAttempts;
    const retryDelay = options.retryDelay || this.retryDelay;
    const memoryThreshold = options.memoryThreshold || this.memoryThreshold;
    const continueOnError =
      options.continueOnError !== undefined ? options.continueOnError : this.continueOnError;

    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(batchId, 'file', batchSize);

    this.logger.info('Starting concurrent processing', {
      batchId,
      totalItems: tasks.length,
      maxConcurrency,
      batchSize,
      timeout,
    });

    const results: ProcessingResult<T, R>[] = [];
    let successfulItems = 0;
    let failedItems = 0;

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage(memoryThreshold)) {
        throw new Error('Insufficient memory available for concurrent processing');
      }

      // Process tasks in batches
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const batchResults = await this.processBatchWithConcurrency(
          batch,
          maxConcurrency,
          timeout,
          retryAttempts,
          retryDelay,
          memoryThreshold,
          continueOnError
        );

        results.push(...batchResults);
        successfulItems += batchResults.filter(r => r.success).length;
        failedItems += batchResults.filter(r => !r.success).length;

        // Update peak memory usage
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory;
        }

        // Check memory usage between batches
        if (!this.checkMemoryUsage(memoryThreshold)) {
          this.logger.warn('Memory threshold exceeded during batch processing', {
            batchId,
            memoryUsage: (currentMemory / process.memoryUsage().heapTotal) * 100,
            threshold: memoryThreshold,
          });

          if (!continueOnError) {
            throw new Error('Memory threshold exceeded and continueOnError is false');
          }
        }
      }

      const processingTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const throughput = processingTime > 0 ? successfulItems / (processingTime / 1000) : 0;

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(batchId, {
        processedCount: tasks.length,
        successCount: successfulItems,
        errorCount: failedItems,
      });

      const result: BatchProcessingResult<T, R> = {
        batchId,
        success: failedItems === 0 || continueOnError,
        results,
        totalItems: tasks.length,
        successfulItems,
        failedItems,
        processingTime,
        throughput,
        memoryUsage: {
          start: startMemory,
          end: endMemory,
          peak: peakMemory,
        },
      };

      this.logger.info('Concurrent processing completed', {
        batchId,
        totalItems: tasks.length,
        successfulItems,
        failedItems,
        processingTime,
        throughput: throughput.toFixed(2),
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;

      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(batchId, {
        processedCount: tasks.length,
        successCount: successfulItems,
        errorCount: tasks.length - successfulItems,
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Concurrent processing failed', {
        batchId,
        error: errorMessage,
        processingTime,
      });

      return {
        batchId,
        success: false,
        results,
        totalItems: tasks.length,
        successfulItems,
        failedItems: tasks.length - successfulItems,
        processingTime,
        throughput: 0,
        memoryUsage: {
          start: startMemory,
          end: endMemory,
          peak: peakMemory,
        },
      };
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(batchId, failedItems === 0 || continueOnError);
    }
  }

  private async processBatchWithConcurrency<T, R>(
    tasks: ProcessingTask<T, R>[],
    maxConcurrency: number,
    timeout: number,
    retryAttempts: number,
    retryDelay: number,
    memoryThreshold: number,
    continueOnError: boolean
  ): Promise<ProcessingResult<T, R>[]> {
    const results: ProcessingResult<T, R>[] = [];
    const inProgress: Map<string, Promise<void>> = new Map();
    const pendingTasks = [...tasks];

    while (pendingTasks.length > 0 || inProgress.size > 0) {
      // Start new tasks if we have capacity
      while (pendingTasks.length > 0 && inProgress.size < maxConcurrency) {
        const task = pendingTasks.shift()!;

        // Check memory usage before starting each task
        if (!this.checkMemoryUsage(memoryThreshold)) {
          this.logger.warn('Memory threshold exceeded before starting task', {
            taskId: task.id,
            memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
            threshold: memoryThreshold,
          });

          if (!continueOnError) {
            // Add failed result for this task
            results.push({
              taskId: task.id,
              success: false,
              error: 'Memory threshold exceeded',
              processingTime: 0,
              retryCount: 0,
            });
            continue;
          }
        }

        const taskPromise = this.processTaskWithRetry(task, timeout, retryAttempts, retryDelay)
          .then(result => {
            results.push(result);
          })
          .finally(() => {
            inProgress.delete(task.id);
          });

        inProgress.set(task.id, taskPromise);
      }

      // Wait for at least one task to complete if we're at capacity
      if (inProgress.size >= maxConcurrency || (pendingTasks.length === 0 && inProgress.size > 0)) {
        await Promise.race(inProgress.values());
      }
    }

    return results;
  }

  private async processTaskWithRetry<T, R>(
    task: ProcessingTask<T, R>,
    timeout: number,
    maxAttempts: number,
    retryDelay: number
  ): Promise<ProcessingResult<T, R>> {
    const startTime = Date.now();
    let lastError: string = 'Unknown error';
    const actualTimeout = task.timeout || timeout;
    const actualMaxAttempts = (task.retryCount || 0) + 1 + maxAttempts;

    for (let attempt = 1; attempt <= actualMaxAttempts; attempt++) {
      try {
        const result = await this.processWithTimeout(
          () => task.processor(task.item),
          actualTimeout
        );

        const processingTime = Date.now() - startTime;

        return {
          taskId: task.id,
          success: true,
          result,
          processingTime,
          retryCount: attempt - 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < actualMaxAttempts) {
          this.logger.debug('Task failed, retrying', {
            taskId: task.id,
            attempt,
            maxAttempts: actualMaxAttempts,
            error: lastError,
          });

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      taskId: task.id,
      success: false,
      error: lastError,
      processingTime,
      retryCount: actualMaxAttempts - 1,
    };
  }

  private async processWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private checkMemoryUsage(threshold: number): boolean {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return memoryUsagePercent <= threshold;
  }

  async processFilesConcurrently<T extends { filePath: string }, R>(
    files: T[],
    processor: (file: T) => Promise<R>,
    options: ProcessingOptions = {}
  ): Promise<BatchProcessingResult<T, R>> {
    // Create processing tasks for each file
    const tasks: ProcessingTask<T, R>[] = files.map(file => ({
      id: `file_${file.filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      item: file,
      processor,
    }));

    return this.processConcurrently(tasks, options);
  }

  async processChunksConcurrently<T extends { id: string }, R>(
    chunks: T[],
    processor: (chunk: T) => Promise<R>,
    options: ProcessingOptions = {}
  ): Promise<BatchProcessingResult<T, R>> {
    // Create processing tasks for each chunk
    const tasks: ProcessingTask<T, R>[] = chunks.map(chunk => ({
      id: `chunk_${chunk.id}`,
      item: chunk,
      processor,
    }));

    return this.processConcurrently(tasks, options);
  }
}
