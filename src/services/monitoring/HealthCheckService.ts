import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { QdrantService } from '../../database/QdrantService';
import { NebulaService } from '../../database/NebulaService';
import { PrometheusMetricsService } from './PrometheusMetricsService';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: {
    qdrant: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      responseTime: number;
    };
    nebula: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      responseTime: number;
    };
    system: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      memoryUsage: number;
      cpuUsage: number;
    };
  };
}

export interface ServiceDependency {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  responseTime: number;
}

@injectable()
export class HealthCheckService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private qdrantService: QdrantService;
  private nebulaService: NebulaService;
  private prometheusMetricsService: PrometheusMetricsService;
  private dependencies: ServiceDependency[] = [];

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.QdrantService) qdrantService: QdrantService,
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.PrometheusMetricsService) prometheusMetricsService: PrometheusMetricsService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.qdrantService = qdrantService;
    this.nebulaService = nebulaService;
    this.prometheusMetricsService = prometheusMetricsService;

    this.logger.info('Health check service initialized');
  }

  async checkDatabaseHealth(): Promise<{
    qdrant: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      responseTime: number;
    };
    nebula: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      responseTime: number;
    };
  }> {
    const results = {
      qdrant: {
        status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy',
        message: '',
        responseTime: 0,
      },
      nebula: {
        status: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy',
        message: '',
        responseTime: 0,
      },
    };

    try {
      // Check Qdrant health
      const qdrantStart = Date.now();
      try {
        const isConnected = this.qdrantService.isConnected();
        if (isConnected) {
          results.qdrant.status = 'healthy';
          results.qdrant.message = 'Qdrant is connected and responding';
        } else {
          results.qdrant.status = 'unhealthy';
          results.qdrant.message = 'Qdrant is not connected';
        }
      } catch (error) {
        results.qdrant.status = 'unhealthy';
        results.qdrant.message = `Qdrant connection failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      results.qdrant.responseTime = Date.now() - qdrantStart;

      // Check Nebula health
      const nebulaStart = Date.now();
      try {
        const isConnected = this.nebulaService.isConnected();
        if (isConnected) {
          results.nebula.status = 'healthy';
          results.nebula.message = 'Nebula is connected and responding';
        } else {
          results.nebula.status = 'unhealthy';
          results.nebula.message = 'Nebula is not connected';
        }
      } catch (error) {
        results.nebula.status = 'unhealthy';
        results.nebula.message = `Nebula connection failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      results.nebula.responseTime = Date.now() - nebulaStart;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to check database health: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HealthCheckService', operation: 'checkDatabaseHealth' }
      );

      // Set both databases as unhealthy if we can't check
      results.qdrant.status = 'unhealthy';
      results.qdrant.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;

      results.nebula.status = 'unhealthy';
      results.nebula.message = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return results;
  }

  checkSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    memoryUsage: number;
    cpuUsage: number;
  } {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      // Mock CPU usage
      const cpuUsage = Math.random() * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'System resources are within normal limits';

      if (memoryPercent > 90 || cpuUsage > 90) {
        status = 'unhealthy';
        message = 'System resources are critically high';
      } else if (memoryPercent > 80 || cpuUsage > 80) {
        status = 'degraded';
        message = 'System resources are elevated';
      }

      return {
        status,
        message,
        memoryUsage: memoryPercent,
        cpuUsage,
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to check system health: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HealthCheckService', operation: 'checkSystemHealth' }
      );

      return {
        status: 'unhealthy',
        message: `System health check failed: ${error instanceof Error ? error.message : String(error)}`,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }
  }

  async performHealthCheck(): Promise<HealthStatus> {
    try {
      const [databaseChecks, systemCheck] = await Promise.all([
        this.checkDatabaseHealth(),
        Promise.resolve(this.checkSystemHealth()),
      ]);

      // Determine overall status
      const statuses = [
        databaseChecks.qdrant.status,
        databaseChecks.nebula.status,
        systemCheck.status,
      ];

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (statuses.includes('unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (statuses.includes('degraded')) {
        overallStatus = 'degraded';
      }

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: Date.now(),
        checks: {
          qdrant: databaseChecks.qdrant,
          nebula: databaseChecks.nebula,
          system: systemCheck,
        },
      };

      // Update Prometheus metrics
      this.prometheusMetricsService.recordAlert(
        overallStatus === 'unhealthy' ? 'critical' : overallStatus === 'degraded' ? 'high' : 'low'
      );

      this.logger.info('Health check completed', {
        overallStatus,
        qdrant: databaseChecks.qdrant.status,
        nebula: databaseChecks.nebula.status,
        system: systemCheck.status,
      });

      return healthStatus;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to perform health check: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'HealthCheckService', operation: 'performHealthCheck' }
      );

      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        checks: {
          qdrant: {
            status: 'unhealthy',
            message: 'Health check failed',
            responseTime: 0,
          },
          nebula: {
            status: 'unhealthy',
            message: 'Health check failed',
            responseTime: 0,
          },
          system: {
            status: 'unhealthy',
            message: 'Health check failed',
            memoryUsage: 0,
            cpuUsage: 0,
          },
        },
      };
    }
  }

  registerDependency(dependency: ServiceDependency): void {
    this.dependencies.push(dependency);
    this.logger.info('Dependency registered', { dependency: dependency.name });
  }

  getDependencies(): ServiceDependency[] {
    return [...this.dependencies];
  }

  async checkDependencies(): Promise<ServiceDependency[]> {
    // In a real implementation, this would check the actual status of dependencies
    // For now, we'll just return the registered dependencies with updated timestamps
    return this.dependencies.map(dep => ({
      ...dep,
      lastCheck: Date.now(),
      status: dep.status, // In real implementation, this would be dynamically determined
    }));
  }

  async handleDegradedService(serviceName: string): Promise<void> {
    this.logger.warn('Service degradation detected', { serviceName });

    // In a real implementation, this would trigger recovery mechanisms
    // For now, we'll just log the event
  }

  async handleServiceFailure(serviceName: string): Promise<void> {
    this.logger.error('Service failure detected', { serviceName });

    // In a real implementation, this would trigger automatic recovery mechanisms
    // For now, we'll just log the event and record an alert
    this.prometheusMetricsService.recordAlert('critical');
  }
}
