import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { BatchProcessingMetrics } from './BatchProcessingMetrics';
import { BatchOperationMetrics } from './BatchProcessingMetrics';

export interface PerformanceMetrics {
  timestamp: number;
  operationId: string;
  operationType: string;
  duration: number;
  throughput: number;
  errorRate: number;
  memoryUsage: {
    start: number;
    end: number;
    peak: number;
    delta: number;
  };
  cpuUsage?: {
    start: number;
    end: number;
    peak: number;
  };
  batchSize: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  retryCount: number;
  timeout: boolean;
}

export interface PerformanceAlert {
  id: string;
  timestamp: number;
  type: 'warning' | 'error' | 'critical';
  category: 'performance' | 'memory' | 'error' | 'timeout';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  operationId?: string;
  metrics?: PerformanceMetrics;
  threshold?: number;
  actualValue?: number;
}

export interface PerformanceReport {
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
  };
  summary: {
    totalOperations: number;
    averageDuration: number;
    p95Duration: number;
    p99Duration: number;
    averageThroughput: number;
    averageErrorRate: number;
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
  };
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
}

export interface PerformanceThresholds {
  highLatency: number;
  lowThroughput: number;
  highErrorRate: number;
  highMemoryUsage: number;
  criticalMemoryUsage: number;
  highCpuUsage: number;
  criticalCpuUsage: number;
}

@injectable()
export class BatchPerformanceMonitor {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  
  // Performance metrics storage
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  
  // Configuration
  private thresholds: PerformanceThresholds;
  private maxMetricsCount: number = 1000;
  private maxAlertsCount: number = 500;
  private cleanupInterval: number = 3600000; // 1 hour
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.batchMetrics = batchMetrics;
    
    this.initializeThresholds();
    this.startCleanupTask();
  }

  private initializeThresholds(): void {
    const config = this.configService.get('batchProcessing');
    const monitoringConfig = config.monitoring;
    
    this.thresholds = {
      highLatency: monitoringConfig.alertThresholds.highLatency,
      lowThroughput: monitoringConfig.alertThresholds.lowThroughput,
      highErrorRate: monitoringConfig.alertThresholds.highErrorRate,
      highMemoryUsage: monitoringConfig.alertThresholds.highMemoryUsage,
      criticalMemoryUsage: monitoringConfig.alertThresholds.criticalMemoryUsage,
      highCpuUsage: monitoringConfig.alertThresholds.highCpuUsage,
      criticalCpuUsage: monitoringConfig.alertThresholds.criticalCpuUsage
    };
    
    this.logger.info('Performance thresholds initialized', this.thresholds);
  }

  private startCleanupTask(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
      this.cleanupOldAlerts();
    }, this.cleanupInterval);
    
    this.logger.info('Performance monitor cleanup task started', { 
      interval: this.cleanupInterval 
    });
  }

  private stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.info('Performance monitor cleanup task stopped');
    }
  }

  recordOperationMetrics(batchMetrics: BatchOperationMetrics): void {
    const memoryUsage = process.memoryUsage();
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      operationId: batchMetrics.operationId,
      operationType: batchMetrics.operationType,
      duration: batchMetrics.duration || 0,
      throughput: batchMetrics.throughput || 0,
      errorRate: batchMetrics.errorRate || 0,
      memoryUsage: {
        start: batchMetrics.memoryUsage.start,
        end: batchMetrics.memoryUsage.end,
        peak: batchMetrics.memoryUsage.peak,
        delta: batchMetrics.memoryUsage.end - batchMetrics.memoryUsage.start
      },
      batchSize: batchMetrics.batchSize,
      processedCount: batchMetrics.processedCount,
      successCount: batchMetrics.successCount,
      errorCount: batchMetrics.errorCount,
      retryCount: batchMetrics.retryCount,
      timeout: batchMetrics.timeout || false
    };
    
    this.metrics.push(metrics);
    
    // Maintain metrics history size
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount);
    }
    
    // Check for alerts
    this.checkForAlerts(metrics);
    
    this.logger.debug('Operation metrics recorded', {
      operationId: metrics.operationId,
      duration: metrics.duration,
      throughput: metrics.throughput,
      errorRate: metrics.errorRate
    });
  }

  private checkForAlerts(metrics: PerformanceMetrics): void {
    // High latency alert
    if (metrics.duration > this.thresholds.highLatency) {
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: `High operation latency: ${metrics.duration}ms`,
        severity: metrics.duration > this.thresholds.highLatency * 2 ? 'high' : 'medium',
        operationId: metrics.operationId,
        metrics,
        threshold: this.thresholds.highLatency,
        actualValue: metrics.duration
      });
    }
    
    // Low throughput alert
    if (metrics.throughput < this.thresholds.lowThroughput) {
      this.createAlert({
        type: 'warning',
        category: 'performance',
        message: `Low operation throughput: ${metrics.throughput.toFixed(2)} ops/sec`,
        severity: 'medium',
        operationId: metrics.operationId,
        metrics,
        threshold: this.thresholds.lowThroughput,
        actualValue: metrics.throughput
      });
    }
    
    // High error rate alert
    if (metrics.errorRate > this.thresholds.highErrorRate) {
      this.createAlert({
        type: 'error',
        category: 'error',
        message: `High operation error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        severity: metrics.errorRate > this.thresholds.highErrorRate * 2 ? 'critical' : 'high',
        operationId: metrics.operationId,
        metrics,
        threshold: this.thresholds.highErrorRate,
        actualValue: metrics.errorRate
      });
    }
    
    // High memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.peak / process.memoryUsage().heapTotal) * 100;
    if (memoryUsagePercent > this.thresholds.highMemoryUsage) {
      this.createAlert({
        type: 'error',
        category: 'memory',
        message: `High memory usage during operation: ${memoryUsagePercent.toFixed(1)}%`,
        severity: memoryUsagePercent > this.thresholds.criticalMemoryUsage ? 'critical' : 'high',
        operationId: metrics.operationId,
        metrics,
        threshold: this.thresholds.highMemoryUsage,
        actualValue: memoryUsagePercent
      });
    }
    
    // Timeout alert
    if (metrics.timeout) {
      this.createAlert({
        type: 'error',
        category: 'timeout',
        message: `Operation timed out`,
        severity: 'high',
        operationId: metrics.operationId,
        metrics
      });
    }
  }

  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const fullAlert: PerformanceAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    this.alerts.push(fullAlert);
    this.logger.warn('Performance alert generated', {
      alertId: fullAlert.id,
      type: fullAlert.type,
      category: fullAlert.category,
      message: fullAlert.message,
      severity: fullAlert.severity
    });
    
    // Maintain alerts history size
    if (this.alerts.length > this.maxAlertsCount) {
      this.alerts = this.alerts.slice(-this.maxAlertsCount);
    }
  }

  generatePerformanceReport(timeRange: { start: number; end: number }): PerformanceReport {
    const filteredMetrics = this.metrics.filter(metric => 
      metric.timestamp >= timeRange.start && 
      metric.timestamp <= timeRange.end
    );
    
    const filteredAlerts = this.alerts.filter(alert => 
      alert.timestamp >= timeRange.start && 
      alert.timestamp <= timeRange.end
    );
    
    if (filteredMetrics.length === 0) {
      return this.getEmptyReport(timeRange);
    }
    
    const completedMetrics = filteredMetrics.filter(m => m.duration > 0);
    const durations = completedMetrics.map(m => m.duration);
    const throughputs = completedMetrics.map(m => m.throughput).filter(t => t > 0);
    const errorRates = completedMetrics.map(m => m.errorRate);
    
    // Calculate percentiles
    const p95Latency = this.percentile(durations, 95);
    const p99Latency = this.percentile(durations, 99);
    
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
      generatedAt: Date.now(),
      timeRange,
      summary: {
        totalOperations: filteredMetrics.length,
        averageDuration: averageLatency,
        p95Duration: p95Latency,
        p99Duration: p99Latency,
        averageThroughput: averageThroughput,
        averageErrorRate: averageErrorRate,
        memoryEfficiency,
        adaptiveBatchingStats,
        systemHealth
      },
      metrics: filteredMetrics,
      alerts: filteredAlerts
    };
  }

  private getEmptyReport(timeRange: { start: number; end: number }): PerformanceReport {
    return {
      generatedAt: Date.now(),
      timeRange,
      summary: {
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
      },
      metrics: [],
      alerts: []
    };
  }

  private calculateMemoryEfficiency(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const totalMemoryDelta = metrics.reduce((sum, m) => 
      sum + Math.abs(m.memoryUsage.delta), 0);
    const totalProcessed = metrics.reduce((sum, m) => sum + m.processedCount, 0);
    
    return totalProcessed > 0 ? (totalProcessed / totalMemoryDelta) * 1000 : 0;
  }

  private calculateAdaptiveBatchingStats(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) {
      return {
        averageBatchSize: 0,
        adjustmentCount: 0,
        improvementRate: 0
      };
    }
    
    const averageBatchSize = metrics.reduce((sum, m) => sum + m.batchSize, 0) / metrics.length;
    const totalAdjustments = metrics.reduce((sum, m) => sum + m.retryCount, 0);
    
    // Calculate improvement rate based on performance trends
    const improvements = metrics.filter(m => 
      m.throughput > this.thresholds.lowThroughput && 
      m.errorRate < this.thresholds.highErrorRate
    ).length;
    const improvementRate = metrics.length > 0 ? improvements / metrics.length : 0;
    
    return {
      averageBatchSize,
      adjustmentCount: totalAdjustments,
      improvementRate
    };
  }

  private calculateSystemHealth(metrics: PerformanceMetrics[]) {
    const memoryUsages = metrics.map(m => 
      (m.memoryUsage.peak / process.memoryUsage().heapTotal) * 100);
    
    return {
      averageMemoryUsage: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
      averageCpuUsage: 0, // CPU usage not currently tracked
      peakMemoryUsage: Math.max(...memoryUsages),
      peakCpuUsage: 0 // CPU usage not currently tracked
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  getRecentAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getMetrics(timeRange?: { start: number; end: number }): PerformanceMetrics[] {
    if (!timeRange) {
      return this.metrics;
    }
    
    return this.metrics.filter(metric => 
      metric.timestamp >= timeRange.start && 
      metric.timestamp <= timeRange.end
    );
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        metrics: this.metrics,
        alerts: this.alerts,
        summary: this.generatePerformanceReport({
          start: Date.now() - 24 * 60 * 60 * 1000,
          end: Date.now()
        }).summary
      }, null, 2);
    } else {
      return this.exportToCsv();
    }
  }

  private exportToCsv(): string {
    const headers = [
      'timestamp',
      'operationId',
      'operationType',
      'duration',
      'throughput',
      'errorRate',
      'memoryStart',
      'memoryEnd',
      'memoryPeak',
      'memoryDelta',
      'batchSize',
      'processedCount',
      'successCount',
      'errorCount',
      'retryCount',
      'timeout'
    ];

    const rows = this.metrics.map(metric => [
      metric.timestamp,
      metric.operationId,
      metric.operationType,
      metric.duration,
      metric.throughput,
      metric.errorRate,
      metric.memoryUsage.start,
      metric.memoryUsage.end,
      metric.memoryUsage.peak,
      metric.memoryUsage.delta,
      metric.batchSize,
      metric.processedCount,
      metric.successCount,
      metric.errorCount,
      metric.retryCount,
      metric.timeout
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private cleanupOldMetrics(): void {
    const config = this.configService.get('batchProcessing');
    const retentionPeriod = config.monitoring.metricsInterval * 100; // Keep 100 intervals
    const cutoffTime = Date.now() - retentionPeriod;

    const initialSize = this.metrics.length;
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffTime);

    const cleanedCount = initialSize - this.metrics.length;
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old performance metrics', { 
        count: cleanedCount 
      });
    }
  }

  private cleanupOldAlerts(): void {
    const config = this.configService.get('batchProcessing');
    const retentionPeriod = config.monitoring.metricsInterval * 100; // Keep 100 intervals
    const cutoffTime = Date.now() - retentionPeriod;

    const initialSize = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffTime);

    const cleanedCount = initialSize - this.alerts.length;
    
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old performance alerts', { 
        count: cleanedCount 
      });
    }
  }

  cleanup(): void {
    this.stopCleanupTask();
    this.metrics = [];
    this.alerts = [];
    this.logger.info('Performance monitor cleaned up');
  }
}