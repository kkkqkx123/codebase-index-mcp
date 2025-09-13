import { CacheInterface, CacheStats } from './CacheInterface';
import { LoggerService } from '../../core/LoggerService';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalOperations: number;
  hitRate: number;
  errorRate: number;
  avgResponseTime: number;
  lastError?: string;
  lastErrorTime?: number;
}

export interface CacheOperationLog {
  operation: 'get' | 'set' | 'del' | 'clear' | 'exists';
  key?: string;
  success: boolean;
  duration: number;
  timestamp: number;
  error?: string;
}

export class EnhancedCacheMonitor {
  private logger: LoggerService;
  // 移除对MonitoringService的依赖
  private metrics: Map<string, CacheMetrics> = new Map();
  private operationLogs: CacheOperationLog[] = [];
  private maxLogs = 1000;

  constructor() {
    this.logger = LoggerService.getInstance();
  }

  /**
   * 监控缓存操作
   */
  async monitorOperation<T>(
    cacheName: string,
    operation: 'get' | 'set' | 'del' | 'clear' | 'exists',
    key: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const logEntry: CacheOperationLog = {
      operation,
      key,
      success: false,
      duration: 0,
      timestamp: startTime
    };

    try {
      this.initializeMetrics(cacheName);
      
      const result = await fn();
      const duration = Date.now() - startTime;
      
      logEntry.success = true;
      logEntry.duration = duration;
      
      this.updateMetrics(cacheName, operation, true, duration);
      this.recordOperation(logEntry);
      
      // 记录性能指标
      this.logger.debug(`缓存操作性能指标`, {
        operation,
        cache: cacheName,
        key: key || 'unknown',
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logEntry.success = false;
      logEntry.duration = duration;
      logEntry.error = errorMessage;
      
      this.updateMetrics(cacheName, operation, false, duration, errorMessage);
      this.recordOperation(logEntry);
      
      // 记录错误详情
      this.logger.error(`缓存操作错误详情`, {
        cache: cacheName,
        operation,
        key,
        error: errorMessage
      });

      this.logger.error(`缓存操作失败 [${cacheName}.${operation}]`, {
        key,
        error: errorMessage,
        duration
      });

      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(cacheName: string): CacheMetrics {
    return this.metrics.get(cacheName) || this.createEmptyMetrics();
  }

  /**
   * 获取所有缓存的统计信息
   */
  getAllCacheStats(): Record<string, CacheMetrics> {
    const stats: Record<string, CacheMetrics> = {};
    for (const [name, metrics] of this.metrics) {
      stats[name] = { ...metrics };
    }
    return stats;
  }

  /**
   * 获取操作日志（支持分页）
   */
  getOperationLogs(limit = 100, offset = 0): CacheOperationLog[] {
    const start = Math.max(0, this.operationLogs.length - offset - limit);
    const end = this.operationLogs.length - offset;
    return this.operationLogs.slice(start, end).reverse();
  }

  /**
   * 获取错误统计
   */
  getErrorStats(cacheName?: string): {
    totalErrors: number;
    recentErrors: CacheOperationLog[];
    errorRate: number;
  } {
    const recentErrors = this.operationLogs
      .filter(log => !log.success)
      .slice(-100);

    let totalErrors = 0;
    let totalOperations = 0;

    if (cacheName) {
      const metrics = this.metrics.get(cacheName);
      if (metrics) {
        totalErrors = metrics.errors;
        totalOperations = metrics.totalOperations;
      }
    } else {
      for (const metrics of this.metrics.values()) {
        totalErrors += metrics.errors;
        totalOperations += metrics.totalOperations;
      }
    }

    return {
      totalErrors,
      recentErrors,
      errorRate: totalOperations > 0 ? totalErrors / totalOperations : 0
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(cacheName?: string): void {
    if (cacheName) {
      this.metrics.set(cacheName, this.createEmptyMetrics());
    } else {
      this.metrics.clear();
    }
  }

  /**
   * 生成健康检查报告
   */
  async generateHealthReport(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    details: Record<string, any>;
    recommendations: string[];
  }> {
    const stats = this.getAllCacheStats();
    const errorStats = this.getErrorStats();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];
    const criticalCaches: string[] = [];
    const warningCaches: string[] = [];

    for (const [cacheName, metrics] of Object.entries(stats)) {
      // 检查错误率
      if (metrics.errorRate > 0.1) {
        status = 'critical';
        criticalCaches.push(cacheName);
        recommendations.push(`缓存 ${cacheName} 错误率过高 (${(metrics.errorRate * 100).toFixed(1)}%)，建议检查连接配置`);
      } else if (metrics.errorRate > 0.05) {
        status = status === 'healthy' ? 'warning' : status;
        warningCaches.push(cacheName);
        recommendations.push(`缓存 ${cacheName} 错误率偏高 (${(metrics.errorRate * 100).toFixed(1)}%)，建议监控`);
      }

      // 检查命中率
      if (metrics.hitRate < 0.5 && metrics.totalOperations > 100) {
        status = status === 'healthy' ? 'warning' : status;
        recommendations.push(`缓存 ${cacheName} 命中率过低 (${(metrics.hitRate * 100).toFixed(1)}%)，建议优化TTL设置`);
      }
    }

    return {
      status,
      details: {
        totalCaches: Object.keys(stats).length,
        totalOperations: Object.values(stats).reduce((sum, m) => sum + m.totalOperations, 0),
        totalErrors: errorStats.totalErrors,
        averageHitRate: Object.values(stats).reduce((sum, m) => sum + m.hitRate, 0) / Object.keys(stats).length || 0,
        criticalCaches,
        warningCaches
      },
      recommendations
    };
  }

  private initializeMetrics(cacheName: string): void {
    if (!this.metrics.has(cacheName)) {
      this.metrics.set(cacheName, this.createEmptyMetrics());
    }
  }

  private updateMetrics(
    cacheName: string,
    operation: string,
    success: boolean,
    duration: number,
    error?: string
  ): void {
    const metrics = this.metrics.get(cacheName)!;
    
    metrics.totalOperations++;
    
    if (!success) {
      metrics.errors++;
      metrics.lastError = error;
      metrics.lastErrorTime = Date.now();
    } else {
      switch (operation) {
        case 'get':
          // 注意：这里需要外部传入是否命中
          break;
        case 'set':
          metrics.sets++;
          break;
        case 'del':
          metrics.deletes++;
          break;
      }
    }

    // 更新平均响应时间
    metrics.avgResponseTime = 
      (metrics.avgResponseTime * (metrics.totalOperations - 1) + duration) / 
      metrics.totalOperations;

    // 重新计算命中率和错误率
    metrics.hitRate = (metrics.hits + metrics.misses) > 0 
      ? metrics.hits / (metrics.hits + metrics.misses) 
      : 0;
    metrics.errorRate = metrics.totalOperations > 0 
      ? metrics.errors / metrics.totalOperations 
      : 0;
  }

  private recordOperation(log: CacheOperationLog): void {
    this.operationLogs.push(log);
    
    // 限制日志数量
    if (this.operationLogs.length > this.maxLogs) {
      this.operationLogs.shift();
    }
  }

  private createEmptyMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      totalOperations: 0,
      hitRate: 0,
      errorRate: 0,
      avgResponseTime: 0
    };
  }

  /**
   * 更新缓存命中统计
   */
  updateHitMiss(cacheName: string, isHit: boolean): void {
    this.initializeMetrics(cacheName);
    const metrics = this.metrics.get(cacheName)!;
    
    if (isHit) {
      metrics.hits++;
    } else {
      metrics.misses++;
    }
    
    metrics.hitRate = (metrics.hits + metrics.misses) > 0 
      ? metrics.hits / (metrics.hits + metrics.misses) 
      : 0;
  }
}