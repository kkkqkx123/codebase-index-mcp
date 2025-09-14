import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ConfigFactory } from '../../config/ConfigFactory';
import { MonitoringConfig } from '../../config/ConfigTypes';
import { TYPES } from '../../types';

export interface PerformanceMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    percentageUsed: number;
  };
  eventLoopDelay: number;
  activeHandles: number;
  activeRequests: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    memory: boolean;
    cpu: boolean;
    eventLoop: boolean;
    handles: boolean;
  };
  metrics: PerformanceMetrics;
  recommendations: string[];
}

export interface MonitoringOptions {
  checkInterval?: number;
  memoryThreshold?: number;
  cpuThreshold?: number;
  eventLoopThreshold?: number;
  maxHandles?: number;
}

@injectable()
export class PerformanceMonitor {
  private logger: LoggerService;
  private configService: ConfigService;
  private configFactory: ConfigFactory;
  private checkInterval: number;
  private memoryThreshold: number;
  private cpuThreshold: number;
  private eventLoopThreshold: number;
  private maxHandles: number;
  private intervalId?: NodeJS.Timeout;
  private metrics: PerformanceMetrics[] = [];
  private healthListeners: Array<(status: HealthStatus) => void> = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.ConfigFactory) configFactory: ConfigFactory,
    options: MonitoringOptions = {}
  ) {
    this.logger = logger;
    this.configService = configService;
    this.configFactory = configFactory;
    
    const monitoringConfig = configFactory.getConfig<MonitoringConfig>('services.monitoring');
    this.checkInterval = options.checkInterval || monitoringConfig.checkInterval;
    this.memoryThreshold = options.memoryThreshold || monitoringConfig.memoryThreshold;
    this.cpuThreshold = options.cpuThreshold || monitoringConfig.cpuThreshold;
    this.eventLoopThreshold = options.eventLoopThreshold || monitoringConfig.eventLoopThreshold;
    this.maxHandles = options.maxHandles || 1000;
  }

  startMonitoring(): void {
    if (this.intervalId) {
      this.logger.warn('Performance monitoring already started');
      return;
    }

    this.logger.info('Starting performance monitoring', {
      checkInterval: this.checkInterval,
      thresholds: {
        memory: this.memoryThreshold,
        cpu: this.cpuThreshold,
        eventLoop: this.eventLoopThreshold,
        maxHandles: this.maxHandles
      }
    });

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Performance monitoring stopped');
    }
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const eventLoopDelay = this.getEventLoopDelay();
    const activeHandles = this.getActiveHandles();
    const activeRequests = this.getActiveRequests();

    return {
      timestamp: new Date(),
      cpuUsage,
      memoryUsage,
      eventLoopDelay,
      activeHandles,
      activeRequests
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const metrics = await this.getCurrentMetrics();
    const checks = this.performHealthChecks(metrics);
    const status = this.determineOverallStatus(checks);
    const recommendations = this.generateRecommendations(checks, metrics);

    return {
      status,
      checks,
      metrics,
      recommendations
    };
  }

  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  getAverageMetrics(timeRange: number = 3600000): PerformanceMetrics | null {
    const cutoff = Date.now() - timeRange;
    const relevantMetrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    if (relevantMetrics.length === 0) {
      return null;
    }

    return {
      timestamp: new Date(),
      cpuUsage: this.calculateAverage(relevantMetrics.map(m => m.cpuUsage)),
      memoryUsage: {
        heapUsed: this.calculateAverage(relevantMetrics.map(m => m.memoryUsage.heapUsed)),
        heapTotal: this.calculateAverage(relevantMetrics.map(m => m.memoryUsage.heapTotal)),
        external: this.calculateAverage(relevantMetrics.map(m => m.memoryUsage.external)),
        rss: this.calculateAverage(relevantMetrics.map(m => m.memoryUsage.rss)),
        percentageUsed: this.calculateAverage(relevantMetrics.map(m => m.memoryUsage.percentageUsed))
      },
      eventLoopDelay: this.calculateAverage(relevantMetrics.map(m => m.eventLoopDelay)),
      activeHandles: this.calculateAverage(relevantMetrics.map(m => m.activeHandles)),
      activeRequests: this.calculateAverage(relevantMetrics.map(m => m.activeRequests))
    };
  }

  onHealthUpdate(listener: (status: HealthStatus) => void): () => void {
    this.healthListeners.push(listener);
    
    return () => {
      const index = this.healthListeners.indexOf(listener);
      if (index !== -1) {
        this.healthListeners.splice(index, 1);
      }
    };
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();
      this.metrics.push(metrics);

      // Keep only recent metrics (last 1000)
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Check health status
      const healthStatus = await this.getHealthStatus();
      this.notifyHealthListeners(healthStatus);

      // Log if unhealthy
      if (healthStatus.status !== 'healthy') {
        this.logger.warn('Unhealthy system status detected', {
          status: healthStatus.status,
          checks: healthStatus.checks,
          metrics: healthStatus.metrics
        });
      }
    } catch (error) {
      this.logger.error('Error collecting performance metrics', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage calculation
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    // Calculate percentage
    const totalUsage = endUsage.user + endUsage.system;
    return Math.min((totalUsage / 100000), 100); // Cap at 100%
  }

  private getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      percentageUsed: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
  }

  private getEventLoopDelay(): number {
    const start = Date.now();
    setImmediate(() => {
      // Do nothing, just measure delay
    });
    return Date.now() - start;
  }

  private getActiveHandles(): number {
    // getActiveHandlesInfo doesn't exist in Node.js Process API
    // Return 0 as a placeholder or use alternative method
    return 0;
  }

  private getActiveRequests(): number {
    return process.getActiveResourcesInfo().length;
  }

  private performHealthChecks(metrics: PerformanceMetrics) {
    return {
      memory: metrics.memoryUsage.percentageUsed < this.memoryThreshold,
      cpu: metrics.cpuUsage < this.cpuThreshold,
      eventLoop: metrics.eventLoopDelay < this.eventLoopThreshold,
      handles: metrics.activeHandles < this.maxHandles
    };
  }

  private determineOverallStatus(checks: any): 'healthy' | 'degraded' | 'unhealthy' {
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    if (passedChecks === totalChecks) {
      return 'healthy';
    } else if (passedChecks >= totalChecks / 2) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private generateRecommendations(checks: any, metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (!checks.memory) {
      recommendations.push('High memory usage detected. Consider garbage collection or reducing memory allocation.');
    }

    if (!checks.cpu) {
      recommendations.push('High CPU usage detected. Consider optimizing CPU-intensive operations.');
    }

    if (!checks.eventLoop) {
      recommendations.push('Event loop delay detected. Consider reducing blocking operations.');
    }

    if (!checks.handles) {
      recommendations.push('High number of active handles detected. Check for resource leaks.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable limits.');
    }

    return recommendations;
  }

  private notifyHealthListeners(status: HealthStatus): void {
    this.healthListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        this.logger.error('Error in health listener', { error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}