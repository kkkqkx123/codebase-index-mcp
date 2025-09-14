import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

export interface BatchSizeConfig {
  serviceType: 'index' | 'vector' | 'graph' | 'file' | 'chunk';
  operationType: string;
  minBatchSize: number;
  maxBatchSize: number;
  defaultBatchSize: number;
  adaptiveSizing: boolean;
  performanceThreshold: number;
  adjustmentFactor: number;
  memoryLimit: number;
  timeLimit: number;
  retryLimit: number;
}

export interface BatchSizeAdjustment {
  timestamp: number;
  serviceType: string;
  operationType: string;
  oldBatchSize: number;
  newBatchSize: number;
  reason: string;
  metrics: {
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    processingTime: number;
  };
  success: boolean;
}

export interface BatchSizeStats {
  serviceType: string;
  operationType: string;
  currentBatchSize: number;
  adjustmentCount: number;
  averageThroughput: number;
  averageErrorRate: number;
  averageMemoryUsage: number;
  lastAdjustment: number;
  adjustmentHistory: BatchSizeAdjustment[];
}

@injectable()
export class BatchSizeConfigManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  
  // Batch size configurations
  private configs: Map<string, BatchSizeConfig> = new Map();
  private stats: Map<string, BatchSizeStats> = new Map();
  private adjustments: BatchSizeAdjustment[] = [];
  
  // Configuration
  private maxAdjustmentsHistory: number = 100;
  private evaluationInterval: number = 60000; // 1 minute
  private evaluationTimer: NodeJS.Timeout | null = null;
  
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
    
    this.initializeConfigs();
    this.startEvaluationTask();
  }

  private initializeConfigs(): void {
    const batchConfig = this.configService.get('batchProcessing');
    const adaptiveConfig = batchConfig.adaptiveBatching;
    
    // Initialize default configurations for each service type
    this.setConfig('index', 'createIndex', {
      serviceType: 'index',
      operationType: 'createIndex',
      minBatchSize: adaptiveConfig.minBatchSize,
      maxBatchSize: adaptiveConfig.maxBatchSize,
      defaultBatchSize: batchConfig.defaultBatchSize,
      adaptiveSizing: adaptiveConfig.enabled,
      performanceThreshold: adaptiveConfig.performanceThreshold,
      adjustmentFactor: adaptiveConfig.adjustmentFactor,
      memoryLimit: batchConfig.memoryThreshold,
      timeLimit: batchConfig.processingTimeout,
      retryLimit: batchConfig.retryAttempts
    });
    
    this.setConfig('vector', 'storeChunks', {
      serviceType: 'vector',
      operationType: 'storeChunks',
      minBatchSize: adaptiveConfig.minBatchSize,
      maxBatchSize: adaptiveConfig.maxBatchSize,
      defaultBatchSize: batchConfig.defaultBatchSize,
      adaptiveSizing: adaptiveConfig.enabled,
      performanceThreshold: adaptiveConfig.performanceThreshold,
      adjustmentFactor: adaptiveConfig.adjustmentFactor,
      memoryLimit: batchConfig.memoryThreshold,
      timeLimit: batchConfig.processingTimeout,
      retryLimit: batchConfig.retryAttempts
    });
    
    this.setConfig('graph', 'storeChunks', {
      serviceType: 'graph',
      operationType: 'storeChunks',
      minBatchSize: adaptiveConfig.minBatchSize,
      maxBatchSize: adaptiveConfig.maxBatchSize,
      defaultBatchSize: batchConfig.defaultBatchSize,
      adaptiveSizing: adaptiveConfig.enabled,
      performanceThreshold: adaptiveConfig.performanceThreshold,
      adjustmentFactor: adaptiveConfig.adjustmentFactor,
      memoryLimit: batchConfig.memoryThreshold,
      timeLimit: batchConfig.processingTimeout,
      retryLimit: batchConfig.retryAttempts
    });
    
    this.setConfig('file', 'processFiles', {
      serviceType: 'file',
      operationType: 'processFiles',
      minBatchSize: adaptiveConfig.minBatchSize,
      maxBatchSize: adaptiveConfig.maxBatchSize,
      defaultBatchSize: batchConfig.defaultBatchSize,
      adaptiveSizing: adaptiveConfig.enabled,
      performanceThreshold: adaptiveConfig.performanceThreshold,
      adjustmentFactor: adaptiveConfig.adjustmentFactor,
      memoryLimit: batchConfig.memoryThreshold,
      timeLimit: batchConfig.processingTimeout,
      retryLimit: batchConfig.retryAttempts
    });
    
    this.setConfig('chunk', 'processChunks', {
      serviceType: 'chunk',
      operationType: 'processChunks',
      minBatchSize: adaptiveConfig.minBatchSize,
      maxBatchSize: adaptiveConfig.maxBatchSize,
      defaultBatchSize: batchConfig.defaultBatchSize,
      adaptiveSizing: adaptiveConfig.enabled,
      performanceThreshold: adaptiveConfig.performanceThreshold,
      adjustmentFactor: adaptiveConfig.adjustmentFactor,
      memoryLimit: batchConfig.memoryThreshold,
      timeLimit: batchConfig.processingTimeout,
      retryLimit: batchConfig.retryAttempts
    });
    
    this.logger.info('Batch size configurations initialized', {
      configCount: this.configs.size
    });
  }

  private startEvaluationTask(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateBatchSizePerformance();
    }, this.evaluationInterval);
    
    this.logger.info('Batch size evaluation task started', { 
      interval: this.evaluationInterval 
    });
  }

  private stopEvaluationTask(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
      this.logger.info('Batch size evaluation task stopped');
    }
  }

  setConfig(serviceType: string, operationType: string, config: BatchSizeConfig): void {
    const key = this.getConfigKey(serviceType, operationType);
    this.configs.set(key, config);
    
    // Initialize stats if not exists
    if (!this.stats.has(key)) {
      this.stats.set(key, {
        serviceType,
        operationType,
        currentBatchSize: config.defaultBatchSize,
        adjustmentCount: 0,
        averageThroughput: 0,
        averageErrorRate: 0,
        averageMemoryUsage: 0,
        lastAdjustment: 0,
        adjustmentHistory: []
      });
    }
    
    this.logger.debug('Batch size configuration set', {
      serviceType,
      operationType,
      config
    });
  }

  getConfig(serviceType: string, operationType: string): BatchSizeConfig | null {
    const key = this.getConfigKey(serviceType, operationType);
    return this.configs.get(key) || null;
  }

  getOptimalBatchSize(serviceType: string, operationType: string, itemCount: number): number {
    const config = this.getConfig(serviceType, operationType);
    if (!config) {
      this.logger.warn('No batch size configuration found', {
        serviceType,
        operationType
      });
      return Math.min(50, itemCount); // Default fallback
    }
    
    const stats = this.getStats(serviceType, operationType);
    
    // If adaptive sizing is disabled, use default batch size
    if (!config.adaptiveSizing) {
      return Math.min(config.defaultBatchSize, itemCount);
    }
    
    // Calculate optimal batch size based on performance metrics
    const optimalBatchSize = this.calculateOptimalBatchSize(config, stats, itemCount);
    
    return Math.max(config.minBatchSize, Math.min(optimalBatchSize, config.maxBatchSize));
  }

  private calculateOptimalBatchSize(
    config: BatchSizeConfig,
    stats: BatchSizeStats,
    itemCount: number
  ): number {
    // Start with current batch size
    let optimalBatchSize = stats.currentBatchSize;
    
    // Calculate performance score (0-1, where 1 is best)
    const performanceScore = this.calculatePerformanceScore(stats);
    
    // Calculate memory pressure score (0-1, where 1 is least pressure)
    const memoryUsage = process.memoryUsage();
    const memoryPressureScore = 1 - Math.min(1, (memoryUsage.heapUsed / memoryUsage.heapTotal) / (config.memoryLimit / 100));
    
    // Combined adjustment factor
    const adjustmentFactor = (performanceScore * 0.6 + memoryPressureScore * 0.4);
    
    // Adjust batch size based on performance
    if (adjustmentFactor > config.performanceThreshold) {
      // Good performance, increase batch size
      optimalBatchSize = Math.floor(optimalBatchSize * config.adjustmentFactor);
    } else if (adjustmentFactor < config.performanceThreshold * 0.7) {
      // Poor performance, decrease batch size
      optimalBatchSize = Math.floor(optimalBatchSize / config.adjustmentFactor);
    }
    
    // Ensure batch size is within limits and doesn't exceed item count
    optimalBatchSize = Math.max(config.minBatchSize, Math.min(optimalBatchSize, config.maxBatchSize));
    optimalBatchSize = Math.min(optimalBatchSize, itemCount);
    
    return optimalBatchSize;
  }

  private calculatePerformanceScore(stats: BatchSizeStats): number {
    // Normalize throughput (higher is better)
    const throughputScore = Math.min(1, stats.averageThroughput / 100);
    
    // Normalize error rate (lower is better)
    const errorRateScore = 1 - Math.min(1, stats.averageErrorRate);
    
    // Normalize memory usage (lower is better)
    const memoryUsageScore = 1 - Math.min(1, stats.averageMemoryUsage / 100);
    
    // Combined score with weights
    return (throughputScore * 0.5 + errorRateScore * 0.3 + memoryUsageScore * 0.2);
  }

  recordOperationMetrics(
    serviceType: string,
    operationType: string,
    metrics: BatchOperationMetrics
  ): void {
    const stats = this.getStats(serviceType, operationType);
    
    // Update stats with exponential moving average
    const alpha = 0.2; // Smoothing factor
    
    stats.averageThroughput = alpha * (metrics.throughput || 0) + (1 - alpha) * stats.averageThroughput;
    stats.averageErrorRate = alpha * (metrics.errorRate || 0) + (1 - alpha) * stats.averageErrorRate;
    stats.averageMemoryUsage = alpha * (metrics.memoryUsage.end / process.memoryUsage().heapTotal * 100) + 
                                (1 - alpha) * stats.averageMemoryUsage;
    
    this.logger.debug('Operation metrics recorded for batch size evaluation', {
      serviceType,
      operationType,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate,
      memoryUsage: metrics.memoryUsage.end / process.memoryUsage().heapTotal * 100
    });
  }

  private evaluateBatchSizePerformance(): void {
    this.logger.debug('Evaluating batch size performance');
    
    for (const [key, stats] of this.stats.entries()) {
      const config = this.configs.get(key);
      if (!config || !config.adaptiveSizing) {
        continue;
      }
      
      // Check if enough time has passed since last adjustment
      const now = Date.now();
      if (now - stats.lastAdjustment < this.evaluationInterval * 2) {
        continue;
      }
      
      // Calculate optimal batch size
      const optimalBatchSize = this.calculateOptimalBatchSize(config, stats, Infinity);
      
      // Check if adjustment is needed
      if (Math.abs(optimalBatchSize - stats.currentBatchSize) > stats.currentBatchSize * 0.1) {
        // Determine reason for adjustment
        const reason = this.determineAdjustmentReason(config, stats);
        
        // Record adjustment
        this.recordAdjustment(
          stats.serviceType,
          stats.operationType,
          stats.currentBatchSize,
          optimalBatchSize,
          reason,
          {
            throughput: stats.averageThroughput,
            errorRate: stats.averageErrorRate,
            memoryUsage: stats.averageMemoryUsage,
            processingTime: 0 // Not currently tracked
          }
        );
        
        // Update current batch size
        stats.currentBatchSize = optimalBatchSize;
        stats.lastAdjustment = now;
        stats.adjustmentCount++;
        
        this.logger.info('Batch size adjusted', {
          serviceType: stats.serviceType,
          operationType: stats.operationType,
          oldBatchSize: optimalBatchSize !== stats.currentBatchSize ? stats.currentBatchSize : 'unknown',
          newBatchSize: optimalBatchSize,
          reason,
          stats: {
            throughput: stats.averageThroughput,
            errorRate: stats.averageErrorRate,
            memoryUsage: stats.averageMemoryUsage
          }
        });
      }
    }
  }

  private determineAdjustmentReason(config: BatchSizeConfig, stats: BatchSizeStats): string {
    const performanceScore = this.calculatePerformanceScore(stats);
    
    if (performanceScore > config.performanceThreshold) {
      return 'Performance optimization';
    } else if (stats.averageMemoryUsage > config.memoryLimit * 0.9) {
      return 'Memory pressure';
    } else if (stats.averageErrorRate > 0.1) {
      return 'High error rate';
    } else {
      return 'Performance degradation';
    }
  }

  private recordAdjustment(
    serviceType: string,
    operationType: string,
    oldBatchSize: number,
    newBatchSize: number,
    reason: string,
    metrics: {
      throughput: number;
      errorRate: number;
      memoryUsage: number;
      processingTime: number;
    }
  ): void {
    const adjustment: BatchSizeAdjustment = {
      timestamp: Date.now(),
      serviceType,
      operationType,
      oldBatchSize,
      newBatchSize,
      reason,
      metrics,
      success: true
    };
    
    this.adjustments.push(adjustment);
    
    // Maintain adjustments history size
    if (this.adjustments.length > this.maxAdjustmentsHistory) {
      this.adjustments = this.adjustments.slice(-this.maxAdjustmentsHistory);
    }
    
    // Update stats history
    const stats = this.getStats(serviceType, operationType);
    stats.adjustmentHistory.push(adjustment);
    
    // Maintain stats history size
    if (stats.adjustmentHistory.length > 20) {
      stats.adjustmentHistory = stats.adjustmentHistory.slice(-20);
    }
  }

  private getConfigKey(serviceType: string, operationType: string): string {
    return `${serviceType}:${operationType}`;
  }

  getStats(serviceType: string, operationType: string): BatchSizeStats {
    const key = this.getConfigKey(serviceType, operationType);
    let stats = this.stats.get(key);
    
    if (!stats) {
      stats = {
        serviceType,
        operationType,
        currentBatchSize: 50, // Default
        adjustmentCount: 0,
        averageThroughput: 0,
        averageErrorRate: 0,
        averageMemoryUsage: 0,
        lastAdjustment: 0,
        adjustmentHistory: []
      };
      this.stats.set(key, stats);
    }
    
    return stats;
  }

  getAllStats(): BatchSizeStats[] {
    return Array.from(this.stats.values());
  }

  getAdjustments(serviceType?: string, operationType?: string, limit: number = 50): BatchSizeAdjustment[] {
    let filtered = this.adjustments;
    
    if (serviceType) {
      filtered = filtered.filter(a => a.serviceType === serviceType);
    }
    
    if (operationType) {
      filtered = filtered.filter(a => a.operationType === operationType);
    }
    
    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  exportConfigurations(): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      configurations: Array.from(this.configs.entries()).map(([key, config]) => ({
        key,
        config
      })),
      stats: Array.from(this.stats.entries()).map(([key, stats]) => ({
        key,
        stats
      })),
      adjustments: this.adjustments
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  cleanup(): void {
    this.stopEvaluationTask();
    this.configs.clear();
    this.stats.clear();
    this.adjustments = [];
    this.logger.info('Batch size config manager cleaned up');
  }
}