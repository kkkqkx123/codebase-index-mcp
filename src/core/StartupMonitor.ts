import { DIContainer } from './DIContainer';

export interface PhaseMetrics {
  name: string;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
  timestamp: number;
  error?: string;
}

export interface StartupReport {
  totalTime: number;
  phases: PhaseMetrics[];
  slowPhases: PhaseMetrics[];
  recommendations: string[];
  loadedServices: string[];
}

export class StartupMonitor {
  private phases: Map<string, { start: number; status: string }> = new Map();
  private metrics: PhaseMetrics[] = [];
  private startTime: number;
  private readonly slowThresholds: Map<string, number> = new Map([
    ['di-container-initialization', 1000],
    ['core-services-loading', 500],
    ['servers-concurrent-startup', 2000],
    ['storage-services-initialization', 3000],
    ['service-lazy-loading', 1000]
  ]);

  constructor() {
    this.startTime = Date.now();
  }

  public startPhase(phaseName: string): void {
    if (this.phases.has(phaseName)) {
      throw new Error(`Phase ${phaseName} is already in progress`);
    }
    this.phases.set(phaseName, {
      start: Date.now(),
      status: 'running'
    });
  }

  public endPhase(phaseName: string, error?: Error): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} was not started`);
    }

    const duration = Math.max(0, Date.now() - phase.start); // Ensure duration is never negative
    const status = error ? 'failed' : 'success';
    
    const metric: PhaseMetrics = {
      name: phaseName,
      duration,
      status: error ? 'failed' : 'success',
      timestamp: Date.now(),
      error: error?.message
    };

    this.metrics.push(metric);
    this.phases.delete(phaseName);

    // 检查是否慢启动
    const threshold = this.slowThresholds.get(phaseName);
    if (threshold && duration > threshold) {
      console.warn(`Slow startup phase detected: ${phaseName} took ${duration}ms (threshold: ${threshold}ms)`);
    }
  }

  public getReport(): StartupReport {
    const totalTime = Math.max(0, Date.now() - this.startTime);
    const slowPhases = this.metrics.filter(metric => {
      const threshold = this.slowThresholds.get(metric.name);
      return threshold && metric.duration > threshold;
    });

    const recommendations = this.generateRecommendations();
    
    let loadedServices: string[] = [];
    try {
      loadedServices = DIContainer.getLoadedServices();
    } catch (error) {
      // 如果DIContainer不可用，使用空数组
      loadedServices = [];
    }

    return {
      totalTime,
      phases: this.metrics,
      slowPhases,
      recommendations,
      loadedServices
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // 检查慢启动阶段
    const slowPhases = this.metrics.filter(metric => {
      const threshold = this.slowThresholds.get(metric.name);
      return threshold && metric.duration > threshold;
    });

    if (slowPhases.length > 0) {
      recommendations.push(`优化 ${slowPhases.map(p => p.name).join(', ')} 阶段`);
      recommendations.push(`慢启动阶段: ${slowPhases.map(p => `${p.name} (${p.duration}ms)`).join(', ')}`);
    }

    // 检查服务加载数量
    try {
      const loadedServices = DIContainer.getLoadedServices();
      if (loadedServices.length > 0) {
        recommendations.push(`已加载${loadedServices.length}个服务`);
      }
      if (loadedServices.length > 10) {
        recommendations.push(`考虑延迟加载非核心服务`);
      }
    } catch (error) {
      // 如果DIContainer不可用，添加相应的建议
      recommendations.push('无法获取服务加载信息');
    }

    // 检查总启动时间
    const totalTime = this.metrics.reduce(
      (sum, metric) => sum + metric.duration, 0
    );
    if (totalTime > 5000) {
      recommendations.push('启动时间较长，建议优化');
    } else if (totalTime > 0) {
      recommendations.push('启动性能良好');
    }

    return recommendations;
  }
}