import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

export interface BatchOperationMetrics {
  operationId: string;
  operationType: 'index' | 'vector' | 'graph' | 'file';
  startTime: number;
  endTime?: number;
  duration?: number;
  batchSize: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  memoryUsage: {
    start: number;
    end: number;
    peak: number;
  };
  cpuUsage?: {
    start: number;
    end: number;
  };
  throughput?: number; // operations per second
  errorRate?: number;
  retryCount: number;
  timeout: boolean;
  adaptiveBatching?: {
    initialBatchSize: number;
    finalBatchSize: number;
    adjustments: number;
  };
}

export interface BatchProcessingStats {
  timestamp: number;
  totalOperations: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  memoryEfficiency: number;
  adaptiveBatchingStats: {
    averageBatchSize: number;
    adjustmentCount: number;
    improvementRate: number;
  };
  systemHealth: {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  };
}

export interface BatchAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  category: 'performance' | 'memory' | 'error' | 'timeout';
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

@injectable()
export class BatchProcessingMetrics {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private metrics: BatchOperationMetrics[] = [];
  private alerts: BatchAlert[] = [];
  private maxMetricsHistory = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private adaptiveBatchingHistory: Map<string, number[]> = new Map();

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    this.startCleanupTask();
  }

  startBatchOperation(
    operationId: string,
    operationType: BatchOperationMetrics['operationType'],
    batchSize: number
  ): BatchOperationMetrics {
    const memoryUsage = process.memoryUsage();
    const metrics: BatchOperationMetrics = {
      operationId,
      operationType,
      startTime: Date.now(),
      batchSize,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      memoryUsage: {
        start: memoryUsage.heapUsed,
        end: 0,
        peak: memoryUsage.heapUsed
      },
      retryCount: 0,
      timeout: false
    };

    this.metrics.push(metrics);
    this.logger.debug('Batch operation started', {
      operationId,
      operationType,
      batchSize
    });

    return metrics;
  }

  updateBatchOperation(
    operationId: string,
    updates: Partial<BatchOperationMetrics>
  ): void {
    const metrics = this.metrics.find(m => m.operationId === operationId);
    if (!metrics) {
      this.logger.warn('Batch operation not found for update', { operationId });
      return;
    }

    Object.assign(metrics, updates);

    // Update peak memory usage
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > metrics.memoryUsage.peak) {
      metrics.memoryUsage.peak = currentMemory;
    }

    this.logger.debug('Batch operation updated', {
      operationId,
      processedCount: metrics.processedCount,
      successCount: metrics.successCount,
      errorCount: metrics.errorCount
    });
  }

  endBatchOperation(
    operationId: string,
    success: boolean = true,
    timeout: boolean = false
  ): void {
    const metrics = this.metrics.find(m => m.operationId === operationId);
    if (!metrics) {
      this.logger.warn('Batch operation not found for end', { operationId });
      return;
    }

    const endTime = Date.now();
    const memoryUsage = process.memoryUsage();

    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;
    metrics.memoryUsage.end = memoryUsage.heapUsed;
    metrics.timeout = timeout;

    // Calculate derived metrics
    metrics.throughput = metrics.processedCount > 0 ? 
      (metrics.processedCount / (metrics.duration / 1000)) : 0;
    metrics.errorRate = metrics.processedCount > 0 ? 
      (metrics.errorCount / metrics.processedCount) : 0;

    this.logger.info('Batch operation completed', {
      operationId,
      success,
      duration: metrics.duration,
      processedCount: metrics.processedCount,
      successCount: metrics.successCount,
      errorCount: metrics.errorCount,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate,
      timeout
    });

    // Check for alerts
    this.checkForAlerts(metrics);

    // Update adaptive batching history
    if (metrics.adaptiveBatching) {
      this.updateAdaptiveBatchingHistory(operationId, metrics);
    }
  }

  recordAdaptiveBatchingAdjustment(
    operationId: string,
    oldBatchSize: number,
    newBatchSize: number,
    reason: string
  ): void {
    const metrics = this.metrics.find(m => m.operationId === operationId);
    if (!metrics) {
      return;
    }

    if (!metrics.adaptiveBatching) {
      metrics.adaptiveBatching = {
        initialBatchSize: oldBatchSize,
        finalBatchSize: newBatchSize,
        adjustments: 0
      };
    }

    metrics.adaptiveBatching.adjustments++;
    metrics.adaptiveBatching.finalBatchSize = newBatchSize;

    this.logger.debug('Adaptive batching adjustment recorded', {
      operationId,
      oldBatchSize,
      newBatchSize,
      reason,
      adjustments: metrics.adaptiveBatching.adjustments
    });
  }

  getStats(timeRange: { start: Date; end: Date }): BatchProcessingStats {
    const filteredMetrics = this.metrics.filter(metric => 
      metric.startTime >= timeRange.start.getTime() && 
      (metric.endTime || Date.now()) <= timeRange.end.getTime()
    );

    if (filteredMetrics.length === 0) {
      return this.getEmptyStats(timeRange);
    }

    const completedMetrics = filteredMetrics.filter(m => m.endTime);
    const durations = completedMetrics.map(m => m.duration || 0);
    const throughputs = completedMetrics.map(m => m.throughput || 0).filter(t => t > 0);
    const errorRates = completedMetrics.map(m => m.errorRate || 0);

    // Calculate percentiles
    const sortedDurations = durations.sort((a, b) => a - b);
    const p95Latency = this.percentile(sortedDurations, 95);
    const p99Latency = this.percentile(sortedDurations, 99);

    // Calculate averages
    const averageLatency = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const averageThroughput = throughputs.length > 0 ? 
      throughputs.reduce((sum, t) => sum + t, 0) / throughputs.length : 0;
    const averageErrorRate = errorRates.reduce((sum, r) => sum + r, 0) / errorRates.length;

    // Calculate memory efficiency
    const memoryEfficiency = this.calculateMemoryEfficiency(completedMetrics);

    // Calculate adaptive batching stats
    const adaptiveBatchingStats = this.calculateAdaptiveBatchingStats(completedMetrics);

    // Calculate system health
    const systemHealth = this.calculateSystemHealth(completedMetrics);

    return {
      timestamp: Date.now(),
      totalOperations: filteredMetrics.length,
      averageLatency,
      p95Latency,
      p99Latency,
      throughput: averageThroughput,
      errorRate: averageErrorRate,
      memoryEfficiency,
      adaptiveBatchingStats,
      systemHealth
    };
  }

  getRecentAlerts(limit: number = 50): BatchAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getOperationHistory(operationType?: BatchOperationMetrics['operationType']): BatchOperationMetrics[] {
    const filtered = operationType ? 
      this.metrics.filter(m => m.operationType === operationType) : 
      this.metrics;
    
    return filtered
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 1000);
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        metrics: this.metrics,
        alerts: this.alerts,
        summary: this.getStats({
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        })
      }, null, 2);
    } else {
      return this.exportToCsv();
    }
  }

  private checkForAlerts(metrics: BatchOperationMetrics): void {
    const config = this.configService.get('batchProcessing');
    const thresholds = config?.monitoring?.alertThresholds || {};

    // High latency alert
    if (metrics.duration && thresholds.highLatency && metrics.duration > thresholds.highLatency) {
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: `High batch operation latency: ${metrics.duration}ms`,
        severity: metrics.duration && thresholds.highLatency && metrics.duration > thresholds.highLatency * 2 ? 'high' : 'medium',
        metadata: {
          operationId: metrics.operationId,
          duration: metrics.duration,
          threshold: thresholds.highLatency
        }
      });
    }

    // Low throughput alert
    if (metrics.throughput && thresholds.lowThroughput && metrics.throughput < thresholds.lowThroughput) {
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: `Low batch operation throughput: ${metrics.throughput.toFixed(2)} ops/sec`,
        severity: 'medium',
        metadata: {
          operationId: metrics.operationId,
          throughput: metrics.throughput,
          threshold: thresholds.lowThroughput
        }
      });
    }

    // High error rate alert
    if (thresholds.highErrorRate && metrics.errorRate !== undefined && metrics.errorRate > thresholds.highErrorRate) {
      this.createAlert({
        type: 'error',
        category: 'error',
        message: `High batch operation error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        severity: thresholds.highErrorRate && metrics.errorRate !== undefined && metrics.errorRate > thresholds.highErrorRate * 2 ? 'critical' : 'high',
        metadata: {
          operationId: metrics.operationId,
          errorRate: metrics.errorRate,
          threshold: thresholds.highErrorRate
        }
      });
    }

    // High memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.peak / process.memoryUsage().heapTotal) * 100;
    if (thresholds.highMemoryUsage && memoryUsagePercent > thresholds.highMemoryUsage) {
      this.createAlert({
        type: 'error',
        category: 'memory',
        message: `High memory usage during batch operation: ${memoryUsagePercent.toFixed(1)}%`,
        severity: thresholds.highMemoryUsage && memoryUsagePercent > thresholds.highMemoryUsage * 1.1 ? 'critical' : 'high',
        metadata: {
          operationId: metrics.operationId,
          memoryUsage: memoryUsagePercent,
          threshold: thresholds.highMemoryUsage
        }
      });
    }

    // Timeout alert
    if (metrics.timeout) {
      this.createAlert({
        type: 'error',
        category: 'timeout',
        message: `Batch operation timed out`,
        severity: 'high',
        metadata: {
          operationId: metrics.operationId,
          duration: metrics.duration
        }
      });
    }
  }

  private createAlert(alert: Omit<BatchAlert, 'id' | 'timestamp'>): void {
    const fullAlert: BatchAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.alerts.push(fullAlert);
    this.logger.warn('Batch processing alert generated', {
      alertId: fullAlert.id,
      type: fullAlert.type,
      category: fullAlert.category,
      message: fullAlert.message,
      severity: fullAlert.severity
    });

    // Maintain alerts history size
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private updateAdaptiveBatchingHistory(operationId: string, metrics: BatchOperationMetrics): void {
    if (!metrics.adaptiveBatching) return;

    const history = this.adaptiveBatchingHistory.get(operationId) || [];
    history.push(metrics.adaptiveBatching.finalBatchSize);
    this.adaptiveBatchingHistory.set(operationId, history);

    // Maintain history size
    if (history.length > 100) {
      history.shift();
    }
  }

  private calculateMemoryEfficiency(metrics: BatchOperationMetrics[]): number {
    if (metrics.length === 0) return 0;

    const totalMemoryDelta = metrics.reduce((sum, m) => 
      sum + (m.memoryUsage.end - m.memoryUsage.start), 0);
    const totalProcessed = metrics.reduce((sum, m) => sum + m.processedCount, 0);

    return totalProcessed > 0 ? (totalProcessed / totalMemoryDelta) * 1000 : 0;
  }

  private calculateAdaptiveBatchingStats(metrics: BatchOperationMetrics[]) {
    const adaptiveMetrics = metrics.filter(m => m.adaptiveBatching);
    
    if (adaptiveMetrics.length === 0) {
      return {
        averageBatchSize: 0,
        adjustmentCount: 0,
        improvementRate: 0
      };
    }

    const averageBatchSize = adaptiveMetrics.reduce((sum, m) => 
      sum + m.adaptiveBatching!.finalBatchSize, 0) / adaptiveMetrics.length;
    const totalAdjustments = adaptiveMetrics.reduce((sum, m) => 
      sum + m.adaptiveBatching!.adjustments, 0);
    
    // Calculate improvement rate based on performance trends
    const improvements = adaptiveMetrics.filter(m => 
      m.adaptiveBatching!.finalBatchSize > m.adaptiveBatching!.initialBatchSize
    ).length;
    const improvementRate = adaptiveMetrics.length > 0 ? 
      improvements / adaptiveMetrics.length : 0;

    return {
      averageBatchSize,
      adjustmentCount: totalAdjustments,
      improvementRate
    };
  }

  private calculateSystemHealth(metrics: BatchOperationMetrics[]) {
    const memoryUsages = metrics.map(m => 
      (m.memoryUsage.peak / process.memoryUsage().heapTotal) * 100);
    const cpuUsages = metrics.map(m => m.cpuUsage?.end || 0);

    return {
      averageMemoryUsage: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
      averageCpuUsage: cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length,
      peakMemoryUsage: Math.max(...memoryUsages),
      peakCpuUsage: Math.max(...cpuUsages)
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))] || 0;
  }

  private getEmptyStats(timeRange: { start: Date; end: Date }): BatchProcessingStats {
    return {
      timestamp: Date.now(),
      totalOperations: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      errorRate: 0,
      memoryEfficiency: 0,
      adaptiveBatchingStats: {
        averageBatchSize: 0,
        adjustmentCount: 0,
        improvementRate: 0
      },
      systemHealth: {
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0
      }
    };
  }

  private exportToCsv(): string {
    const headers = [
      'operationId',
      'operationType',
      'startTime',
      'endTime',
      'duration',
      'batchSize',
      'processedCount',
      'successCount',
      'errorCount',
      'memoryStart',
      'memoryEnd',
      'memoryPeak',
      'throughput',
      'errorRate',
      'retryCount',
      'timeout'
    ];

    const rows = this.metrics.map(metric => [
      metric.operationId,
      metric.operationType,
      metric.startTime,
      metric.endTime || '',
      metric.duration || '',
      metric.batchSize,
      metric.processedCount,
      metric.successCount,
      metric.errorCount,
      metric.memoryUsage.start,
      metric.memoryUsage.end,
      metric.memoryUsage.peak,
      metric.throughput || '',
      metric.errorRate || '',
      metric.retryCount,
      metric.timeout
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private startCleanupTask(): void {
    const config = this.configService.get('batchProcessing');
    const cleanupInterval = config?.monitoring?.metricsInterval || 60000; // Default to 1 minute

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, cleanupInterval);
    
    // Ensure interval doesn't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    this.logger.info('Batch processing metrics cleanup task started', {
      interval: cleanupInterval
    });
  }

  private cleanupOldMetrics(): void {
    const config = this.configService.get('batchProcessing');
    const metricsInterval = config?.monitoring?.metricsInterval || 60000; // Default to 1 minute
    const retentionPeriod = metricsInterval * 100; // Keep 100 intervals
    const cutoffTime = Date.now() - retentionPeriod;

    const initialSize = this.metrics.length;
    this.metrics = this.metrics.filter(metric => metric.startTime > cutoffTime);

    const cleanedCount = initialSize - this.metrics.length;
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old batch processing metrics', { 
        count: cleanedCount 
      });
    }

    // Clean up old alerts
    const initialAlertSize = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffTime);
    const cleanedAlertCount = initialAlertSize - this.alerts.length;
    
    if (cleanedAlertCount > 0) {
      this.logger.debug('Cleaned up old batch processing alerts', { 
        count: cleanedAlertCount 
      });
    }
  }

  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Batch processing metrics cleanup task stopped');
    }
  }
}