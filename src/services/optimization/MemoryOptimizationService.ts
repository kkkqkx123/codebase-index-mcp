import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

export interface MemoryUsageInfo {
  used: number;
  total: number;
  external: number;
  percentage: number;
}

export interface MemoryOptimizationOptions {
  threshold: number;
  gcInterval: number;
  maxRetries: number;
  adaptiveSizing: boolean;
  minBatchSize: number;
  maxBatchSize: number;
}

export interface BatchMemoryProfile {
  batchId: string;
  startTime: number;
  endTime?: number;
  startMemory: MemoryUsageInfo;
  endMemory?: MemoryUsageInfo;
  peakMemory: MemoryUsageInfo;
  memoryDelta: number;
  efficiency: number; // items processed per MB
  itemsProcessed: number;
}

@injectable()
export class MemoryOptimizationService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;

  // Default configuration
  private defaultThreshold: number = 80;
  private gcInterval: number = 60000; // 1 minute
  private maxRetries: number = 3;
  private adaptiveSizing: boolean = true;
  private minBatchSize: number = 10;
  private maxBatchSize: number = 500;

  // Memory profiles for batch operations
  private batchProfiles: Map<string, BatchMemoryProfile> = new Map();
  private gcTimer: NodeJS.Timeout | null = null;

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
    this.startGcTimer();
  }

  private initializeConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');

    this.defaultThreshold = batchConfig.memoryThreshold;
    this.adaptiveSizing = batchConfig.adaptiveBatching.enabled;
    this.minBatchSize = batchConfig.adaptiveBatching.minBatchSize;
    this.maxBatchSize = batchConfig.adaptiveBatching.maxBatchSize;

    this.logger.info('Memory optimization service initialized', {
      defaultThreshold: this.defaultThreshold,
      gcInterval: this.gcInterval,
      adaptiveSizing: this.adaptiveSizing,
      minBatchSize: this.minBatchSize,
      maxBatchSize: this.maxBatchSize
    });
  }

  private startGcTimer(): void {
    this.gcTimer = setInterval(() => {
      this.performGarbageCollection();
    }, this.gcInterval);

    this.logger.info('Garbage collection timer started', { interval: this.gcInterval });
  }

  private stopGcTimer(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
      this.logger.info('Garbage collection timer stopped');
    }
  }

  getMemoryUsage(): MemoryUsageInfo {
    const memUsage = process.memoryUsage();
    const percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      external: memUsage.external,
      percentage
    };
  }

  isMemoryUsageAcceptable(threshold?: number): boolean {
    const memoryUsage = this.getMemoryUsage();
    const actualThreshold = threshold || this.defaultThreshold;

    return memoryUsage.percentage <= actualThreshold;
  }

  async waitForMemoryAvailability(threshold?: number, timeoutMs: number = 30000): Promise<boolean> {
    const actualThreshold = threshold || this.defaultThreshold;
    const startTime = Date.now();

    this.logger.debug('Waiting for memory availability', {
      currentUsage: this.getMemoryUsage().percentage,
      threshold: actualThreshold,
      timeoutMs
    });

    while (Date.now() - startTime < timeoutMs) {
      if (this.isMemoryUsageAcceptable(actualThreshold)) {
        return true;
      }

      // Perform garbage collection and wait
      this.performGarbageCollection();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.logger.warn('Timeout waiting for memory availability', {
      currentUsage: this.getMemoryUsage().percentage,
      threshold: actualThreshold,
      timeoutMs
    });

    return false;
  }

  performGarbageCollection(): void {
    const beforeMemory = this.getMemoryUsage();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();

      const afterMemory = this.getMemoryUsage();
      const freedMemory = beforeMemory.used - afterMemory.used;

      this.logger.debug('Garbage collection performed', {
        beforeUsage: beforeMemory.percentage,
        afterUsage: afterMemory.percentage,
        freedMemory
      });
    } else {
      this.logger.debug('Garbage collection not available');
    }
  }

  startBatchMemoryProfile(batchId: string, itemsCount: number): BatchMemoryProfile {
    const memoryUsage = this.getMemoryUsage();

    const profile: BatchMemoryProfile = {
      batchId,
      startTime: Date.now(),
      startMemory: memoryUsage,
      peakMemory: memoryUsage,
      memoryDelta: 0,
      efficiency: 0,
      itemsProcessed: itemsCount
    };

    this.batchProfiles.set(batchId, profile);

    this.logger.debug('Started batch memory profile', {
      batchId,
      itemsCount,
      initialMemoryUsage: memoryUsage.percentage
    });

    return profile;
  }

  updateBatchMemoryProfile(batchId: string): void {
    const profile = this.batchProfiles.get(batchId);
    if (!profile) {
      this.logger.warn('Batch memory profile not found for update', { batchId });
      return;
    }

    const memoryUsage = this.getMemoryUsage();

    // Update peak memory if current usage is higher
    if (memoryUsage.used > profile.peakMemory.used) {
      profile.peakMemory = memoryUsage;
    }

    this.logger.debug('Updated batch memory profile', {
      batchId,
      currentMemoryUsage: memoryUsage.percentage,
      peakMemoryUsage: profile.peakMemory.percentage
    });
  }

  endBatchMemoryProfile(batchId: string): BatchMemoryProfile | null {
    const profile = this.batchProfiles.get(batchId);
    if (!profile) {
      this.logger.warn('Batch memory profile not found for end', { batchId });
      return null;
    }

    const endMemory = this.getMemoryUsage();

    profile.endTime = Date.now();
    profile.endMemory = endMemory;
    profile.memoryDelta = endMemory.used - profile.startMemory.used;

    // Calculate efficiency (items processed per MB of memory used)
    const memoryUsedMB = Math.abs(profile.memoryDelta) / (1024 * 1024);
    profile.efficiency = memoryUsedMB > 0 ? profile.itemsProcessed / memoryUsedMB : 0;

    // Remove from active profiles
    this.batchProfiles.delete(batchId);

    this.logger.debug('Ended batch memory profile', {
      batchId,
      duration: profile.endTime - profile.startTime,
      memoryDelta: profile.memoryDelta,
      efficiency: profile.efficiency
    });

    return profile;
  }

  calculateOptimalBatchSize(
    currentBatchSize: number,
    memoryEfficiency: number,
    performanceMetrics: { processingTime: number; successRate: number }
  ): number {
    if (!this.adaptiveSizing) {
      return currentBatchSize;
    }

    const memoryUsage = this.getMemoryUsage();
    const memoryPressure = memoryUsage.percentage / this.defaultThreshold;

    // Calculate efficiency factor (0-1, where 1 is most efficient)
    const efficiencyFactor = Math.min(1, memoryEfficiency / 100);

    // Calculate performance factor (0-1, where 1 is best performance)
    const performanceFactor = performanceMetrics.successRate *
      (1 - Math.min(1, performanceMetrics.processingTime / 10000));

    // Calculate memory pressure factor (0-1, where 1 is least pressure)
    const memoryPressureFactor = 1 - Math.min(1, memoryPressure);

    // Combined adjustment factor
    const adjustmentFactor = (efficiencyFactor * 0.3 +
      performanceFactor * 0.4 +
      memoryPressureFactor * 0.3);

    // Calculate new batch size
    let newBatchSize = currentBatchSize;

    if (adjustmentFactor > 0.7) {
      // Good performance, increase batch size
      newBatchSize = Math.min(
        Math.floor(currentBatchSize * 1.2),
        this.maxBatchSize
      );
    } else if (adjustmentFactor < 0.3) {
      // Poor performance, decrease batch size
      newBatchSize = Math.max(
        Math.floor(currentBatchSize / 1.2),
        this.minBatchSize
      );
    }

    this.logger.debug('Calculated optimal batch size', {
      currentBatchSize,
      newBatchSize,
      memoryEfficiency,
      performanceMetrics,
      memoryPressure,
      adjustmentFactor
    });

    return newBatchSize;
  }

  async executeWithMemoryOptimization<T>(
    operation: () => Promise<T>,
    batchId: string,
    options: MemoryOptimizationOptions = {
      threshold: 0,
      gcInterval: 0,
      maxRetries: 0,
      adaptiveSizing: false,
      minBatchSize: 0,
      maxBatchSize: 0
    }
  ): Promise<T> {
    const threshold = options.threshold || this.defaultThreshold;
    const maxRetries = options.maxRetries || this.maxRetries;

    // Start memory profile
    const profile = this.startBatchMemoryProfile(batchId, 0);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for memory availability before starting
        const memoryAvailable = await this.waitForMemoryAvailability(threshold);
        if (!memoryAvailable) {
          throw new Error('Memory not available within timeout period');
        }

        // Execute the operation
        const result = await operation();

        // Update and end memory profile
        this.updateBatchMemoryProfile(batchId);
        this.endBatchMemoryProfile(batchId);

        return result;
      } catch (error) {
        lastError = error as Error;

        // Update memory profile with error
        this.updateBatchMemoryProfile(batchId);

        this.logger.warn('Operation failed with memory optimization', {
          batchId,
          attempt,
          maxRetries,
          error: lastError.message,
          memoryUsage: this.getMemoryUsage().percentage
        });

        // Perform garbage collection before retry
        this.performGarbageCollection();

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // End memory profile with error
    this.endBatchMemoryProfile(batchId);

    throw lastError || new Error('Unknown error in memory optimization');
  }

  getMemoryProfiles(): BatchMemoryProfile[] {
    return Array.from(this.batchProfiles.values());
  }

  getAverageMemoryEfficiency(): number {
    const profiles = Array.from(this.batchProfiles.values())
      .filter(p => p.efficiency > 0);

    if (profiles.length === 0) {
      return 0;
    }

    const totalEfficiency = profiles.reduce((sum, p) => sum + p.efficiency, 0);
    return totalEfficiency / profiles.length;
  }

  cleanup(): void {
    this.stopGcTimer();
    this.batchProfiles.clear();
    this.logger.info('Memory optimization service cleaned up');
  }
}