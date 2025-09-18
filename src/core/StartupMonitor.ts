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
    this.phases.set(phaseName, {
      start: Date.now(),
      status: 'running'
    });
  }

  public endPhase(phaseName: string, error?: Error): void {
    const phase = this.phases.get(phaseName);
    if (!phase) {
      console.warn(`Phase ${phaseName} not started`);
      return;
    }

    const duration = Date.now() - phase.start;
    const status = error ? 'failed' : 'success';
    
    const metric: PhaseMetrics = {
      name: phaseName,
      duration,
      status,
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
    const totalTime = Date.now() - this.startTime;
    const slowPhases = this.metrics.filter(metric => {
      const threshold = this.slowThresholds.get(metric.name);
      return threshold && metric.duration > threshold;
    });

    const recommendations = this.generateRecommendations();
    const loadedServices = DIContainer.getLoadedServices();

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
      recommendations.push(`优化慢启动阶段: ${slowPhases.map(p => p.name).join(', ')}`);
    }

    // 检查服务加载数量
    const loadedServices = DIContainer.getLoadedServices();
    if (loadedServices.length > 10) {
      recommendations.push(`考虑进一步优化服务懒加载，当前已加载 ${loadedServices.length} 个服务`);
    }

    // 检查总启动时间
    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    if (totalTime > 5000) {
      recommendations.push('总启动时间超过5秒，建议检查系统资源或进一步优化');
    }

    return recommendations;
  }
}