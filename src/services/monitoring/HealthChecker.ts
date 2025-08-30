import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { PerformanceMonitor, HealthStatus } from './PerformanceMonitor';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  details?: Record<string, any>;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealth[];
  system: HealthStatus;
  uptime: number;
  version: string;
}

export interface HealthCheckOptions {
  timeout?: number;
  includeServices?: string[];
  excludeServices?: string[];
}

@injectable()
export class HealthChecker {
  private logger: LoggerService;
  private configService: ConfigService;
  private performanceMonitor: PerformanceMonitor;
  private services: Map<string, () => Promise<ServiceHealth>> = new Map();
  private startTime: Date;
  private version: string;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(PerformanceMonitor) performanceMonitor: PerformanceMonitor
  ) {
    this.logger = logger;
    this.configService = configService;
    this.performanceMonitor = performanceMonitor;
    this.startTime = new Date();
    this.version = '1.0.0'; // Version config not available in ConfigService
    
    this.registerDefaultServices();
  }

  registerService(name: string, healthCheck: () => Promise<ServiceHealth>): void {
    this.services.set(name, healthCheck);
    this.logger.info('Health check service registered', { name });
  }

  unregisterService(name: string): void {
    if (this.services.delete(name)) {
      this.logger.info('Health check service unregistered', { name });
    }
  }

  async checkHealth(options: HealthCheckOptions = {}): Promise<SystemHealth> {
    const timeout = options.timeout || 5000;
    const includeServices = options.includeServices;
    const excludeServices = options.excludeServices;

    this.logger.info('Starting health check', {
      timeout,
      includeServices,
      excludeServices
    });

    try {
      // Get system health
      const system = await this.performanceMonitor.getHealthStatus();
      
      // Check service health
      const services = await this.checkServicesHealth(timeout, includeServices, excludeServices);
      
      // Determine overall health
      const overall = this.determineOverallHealth(system, services);

      const result: SystemHealth = {
        overall,
        timestamp: new Date(),
        services,
        system,
        uptime: Date.now() - this.startTime.getTime(),
        version: this.version
      };

      this.logger.info('Health check completed', {
        overall,
        servicesCount: services.length,
        healthyServices: services.filter(s => s.status === 'healthy').length,
        uptime: result.uptime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Health check failed', { error: errorMessage });

      // Return unhealthy status on error
      return {
        overall: 'unhealthy',
        timestamp: new Date(),
        services: [],
        system: await this.performanceMonitor.getHealthStatus(),
        uptime: Date.now() - this.startTime.getTime(),
        version: this.version
      };
    }
  }

  async checkServiceHealth(name: string): Promise<ServiceHealth> {
    const healthCheck = this.services.get(name);
    
    if (!healthCheck) {
      throw new Error(`Health check not found for service: ${name}`);
    }

    try {
      const startTime = Date.now();
      const result = await healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        ...result,
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Service health check failed', {
        service: name,
        error: errorMessage
      });

      return {
        name,
        status: 'unhealthy',
        responseTime: 0,
        lastCheck: new Date(),
        error: errorMessage
      };
    }
  }

  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  private async checkServicesHealth(
    timeout: number,
    includeServices?: string[],
    excludeServices?: string[]
  ): Promise<ServiceHealth[]> {
    let serviceNames = Array.from(this.services.keys());

    // Filter services based on options
    if (includeServices && includeServices.length > 0) {
      serviceNames = serviceNames.filter(name => includeServices.includes(name));
    }

    if (excludeServices && excludeServices.length > 0) {
      serviceNames = serviceNames.filter(name => !excludeServices.includes(name));
    }

    // Check services in parallel with timeout
    const promises = serviceNames.map(async (name) => {
      try {
        return await Promise.race([
          this.checkServiceHealth(name),
          new Promise<ServiceHealth>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), timeout)
          )
        ]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        return {
          name,
          status: 'unhealthy' as const,
          responseTime: timeout,
          lastCheck: new Date(),
          error: errorMessage
        };
      }
    });

    return Promise.all(promises);
  }

  private determineOverallHealth(system: HealthStatus, services: ServiceHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    // Count unhealthy services
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const totalServices = services.length;

    // If system is unhealthy, overall is unhealthy
    if (system.status === 'unhealthy') {
      return 'unhealthy';
    }

    // If more than 50% of services are unhealthy, overall is unhealthy
    if (totalServices > 0 && unhealthyServices / totalServices > 0.5) {
      return 'unhealthy';
    }

    // If any services are unhealthy or system is degraded, overall is degraded
    if (unhealthyServices > 0 || degradedServices > 0 || system.status === 'degraded') {
      return 'degraded';
    }

    // Otherwise, healthy
    return 'healthy';
  }

  private registerDefaultServices(): void {
    // Register default health checks for core services
    this.registerService('database', async () => {
      // Mock database health check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      return {
        name: 'database',
        status: 'healthy',
        responseTime: 10,
        lastCheck: new Date(),
        details: {
          connections: 5,
          maxConnections: 100,
          queryTime: 2
        }
      };
    });

    this.registerService('vector-storage', async () => {
      // Mock vector storage health check
      await new Promise(resolve => setTimeout(resolve, 15));
      
      return {
        name: 'vector-storage',
        status: 'healthy',
        responseTime: 15,
        lastCheck: new Date(),
        details: {
          vectorCount: 10000,
          indexSize: '50MB',
          queryTime: 5
        }
      };
    });

    this.registerService('graph-storage', async () => {
      // Mock graph storage health check
      await new Promise(resolve => setTimeout(resolve, 20));
      
      return {
        name: 'graph-storage',
        status: 'healthy',
        responseTime: 20,
        lastCheck: new Date(),
        details: {
          nodeCount: 5000,
          relationshipCount: 15000,
          queryTime: 8
        }
      };
    });

    this.registerService('embedding-service', async () => {
      // Mock embedding service health check
      await new Promise(resolve => setTimeout(resolve, 25));
      
      return {
        name: 'embedding-service',
        status: 'healthy',
        responseTime: 25,
        lastCheck: new Date(),
        details: {
          model: 'text-embedding-ada-002',
          queueLength: 0,
          averageResponseTime: 100
        }
      };
    });
  }
}