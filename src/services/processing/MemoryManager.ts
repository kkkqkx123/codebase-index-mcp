import { injectable, inject, optional } from 'inversify';

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  percentageUsed: number;
}

export interface MemoryThreshold {
  warning: number;
  critical: number;
  emergency: number;
}

export interface MemoryManagerOptions {
  checkInterval?: number;
  thresholds?: MemoryThreshold;
  gcThreshold?: number;
  maxMemoryMB?: number;
}

@injectable()
export class MemoryManager {
  getCurrentMemoryUsage(): number {
    throw new Error('Method not implemented.');
  }
  private checkInterval: number;
  private thresholds: MemoryThreshold;
  private gcThreshold: number;
  private maxMemoryBytes: number;
  private intervalId?: NodeJS.Timeout;
  private listeners: Array<(usage: MemoryUsage) => void> = [];

  constructor(
    @inject('LoggerService') @optional() private logger?: any,
    @inject('MemoryManagerOptions') @optional() options: MemoryManagerOptions = {}
  ) {
    // 从环境变量读取内存配置
    const envMaxMemory = parseInt(process.env.MAX_MEMORY_MB || '1024');
    const envWarning = parseInt(process.env.MEMORY_WARNING_THRESHOLD || '85');
    const envCritical = parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '95');
    const envEmergency = parseInt(process.env.MEMORY_EMERGENCY_THRESHOLD || '98');
    
    this.checkInterval = options.checkInterval || 5000;
    this.thresholds = options.thresholds || {
      warning: Math.min(envWarning, 90),
      critical: Math.min(envCritical, 95),
      emergency: Math.min(envEmergency, 98)
    };
    this.gcThreshold = options.gcThreshold || 90;
    this.maxMemoryBytes = (options.maxMemoryMB || envMaxMemory) * 1024 * 1024;
  }

  startMonitoring(): void {
    if (this.intervalId) {
      this.logger?.warn('Memory monitoring already started');
      return;
    }

    this.logger?.info('Starting memory monitoring', {
      checkInterval: this.checkInterval,
      thresholds: this.thresholds,
      gcThreshold: this.gcThreshold,
      maxMemoryMB: this.maxMemoryBytes / (1024 * 1024)
    });

    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger?.info('Memory monitoring stopped');
    }
  }

  isMonitoring(): boolean {
    return this.intervalId !== undefined;
  }

  getCurrentUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    const percentageUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      percentageUsed
    };
  }

  checkMemory(threshold?: number): boolean {
    const usage = this.getCurrentUsage();
    const checkThreshold = threshold || this.thresholds.warning;

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(usage);
      } catch (error) {
        this.logger?.error('Error in memory listener', { error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Check thresholds and take action
    if (usage.percentageUsed >= this.thresholds.emergency) {
      this.handleEmergencyMemory(usage);
      return false;
    }

    if (usage.percentageUsed >= this.thresholds.critical) {
      this.handleCriticalMemory(usage);
      return false;
    }

    if (usage.percentageUsed >= this.thresholds.warning) {
      this.handleWarningMemory(usage);
      return false;
    }

    return usage.percentageUsed <= checkThreshold;
  }

  forceGarbageCollection(): boolean {
    try {
      // Check if global.gc is available
      if (typeof global.gc === 'function') {
        const before = this.getCurrentUsage();
        global.gc();
        const after = this.getCurrentUsage();
        
        const freedMB = (before.heapUsed - after.heapUsed) / (1024 * 1024);
        
        this.logger?.info('Garbage collection completed', {
          beforeHeapUsedMB: before.heapUsed / (1024 * 1024),
          afterHeapUsedMB: after.heapUsed / (1024 * 1024),
          freedMB
        });
        
        return true;
      } else {
        this.logger?.warn('Garbage collection not available. Run with --expose-gc flag.');
        return false;
      }
    } catch (error) {
      this.logger?.error('Error during garbage collection', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  getMemoryStatus(): {
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
    usage: MemoryUsage;
    recommendations: string[];
  } {
    const usage = this.getCurrentUsage();
    
    if (usage.percentageUsed >= this.thresholds.emergency) {
      return {
        status: 'emergency',
        usage,
        recommendations: [
          'Stop all non-essential operations',
          'Force garbage collection',
          'Consider restarting the application',
          'Reduce memory allocation'
        ]
      };
    }

    if (usage.percentageUsed >= this.thresholds.critical) {
      return {
        status: 'critical',
        usage,
        recommendations: [
          'Stop new operations',
          'Force garbage collection',
          'Reduce batch sizes',
          'Clear caches if possible'
        ]
      };
    }

    if (usage.percentageUsed >= this.thresholds.warning) {
      return {
        status: 'warning',
        usage,
        recommendations: [
          'Monitor memory usage closely',
          'Consider garbage collection',
          'Reduce batch sizes for new operations'
        ]
      };
    }

    return {
      status: 'healthy',
      usage,
      recommendations: [
        'Memory usage is normal',
        'Continue current operations'
      ]
    };
  }

  onMemoryUpdate(listener: (usage: MemoryUsage) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private handleEmergencyMemory(usage: MemoryUsage): void {
    this.logger?.error('Emergency memory threshold exceeded', {
      usage: {
        heapUsedMB: usage.heapUsed / (1024 * 1024),
        heapTotalMB: usage.heapTotal / (1024 * 1024),
        percentageUsed: usage.percentageUsed
      },
      threshold: this.thresholds.emergency
    });

    // Force garbage collection
    this.forceGarbageCollection();
    
    // Log emergency status
    this.logger?.error('EMERGENCY: Memory usage critical - immediate action required');
  }

  private handleCriticalMemory(usage: MemoryUsage): void {
    this.logger?.warn('Critical memory threshold exceeded', {
      usage: {
        heapUsedMB: usage.heapUsed / (1024 * 1024),
        heapTotalMB: usage.heapTotal / (1024 * 1024),
        percentageUsed: usage.percentageUsed
      },
      threshold: this.thresholds.critical
    });

    // Force garbage collection if above threshold
    if (usage.percentageUsed >= this.gcThreshold) {
      this.forceGarbageCollection();
    }
  }

  private handleWarningMemory(usage: MemoryUsage): void {
    this.logger?.info('Warning memory threshold exceeded', {
      usage: {
        heapUsedMB: usage.heapUsed / (1024 * 1024),
        heapTotalMB: usage.heapTotal / (1024 * 1024),
        percentageUsed: usage.percentageUsed
      },
      threshold: this.thresholds.warning
    });
  }
}