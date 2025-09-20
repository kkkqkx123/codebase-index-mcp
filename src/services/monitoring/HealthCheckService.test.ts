import { HealthCheckService, HealthStatus, ServiceDependency } from './HealthCheckService';
import { QdrantService } from '../../database/QdrantService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ErrorHandlerService, ErrorReport } from '../../core/ErrorHandlerService';
import { PrometheusMetricsService } from './PrometheusMetricsService';

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockNebulaService: jest.Mocked<NebulaService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockPrometheusMetricsService: jest.Mocked<PrometheusMetricsService>;

  beforeEach(() => {
    // Create mocks
    mockQdrantService = {
      isConnected: jest.fn(),
      getCollectionInfo: jest.fn(),
    } as any;

    mockNebulaService = {
      isConnected: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockPrometheusMetricsService = {
      recordAlert: jest.fn(),
    } as any;

    // Create HealthCheckService instance with mocked dependencies
    healthCheckService = new HealthCheckService(
      mockConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockQdrantService,
      mockNebulaService,
      mockPrometheusMetricsService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when both databases are up', async () => {
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
      });

      const health = await healthCheckService.checkDatabaseHealth();

      expect(health.qdrant.status).toBe('healthy');
      expect(health.nebula.status).toBe('healthy');
      expect(mockQdrantService.isConnected).toHaveBeenCalled();
      expect(mockNebulaService.isConnected).toHaveBeenCalled();
    });

    it('should return unhealthy status when Qdrant is down', async () => {
      mockQdrantService.isConnected.mockReturnValue(false);
      mockNebulaService.isConnected.mockReturnValue(true);

      const health = await healthCheckService.checkDatabaseHealth();

      expect(health.qdrant.status).toBe('unhealthy');
      expect(health.nebula.status).toBe('healthy');
    });

    it('should return unhealthy status when Nebula is down', async () => {
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.isConnected.mockReturnValue(false);

      const health = await healthCheckService.checkDatabaseHealth();

      expect(health.qdrant.status).toBe('healthy');
      expect(health.nebula.status).toBe('unhealthy');
    });

    it('should handle errors when checking Qdrant health', async () => {
      mockQdrantService.isConnected.mockImplementation(() => {
        throw new Error('Connection failed');
      });
      mockNebulaService.isConnected.mockReturnValue(true);

      const health = await healthCheckService.checkDatabaseHealth();

      expect(health.qdrant.status).toBe('unhealthy');
      expect(health.qdrant.message).toContain('Connection failed');
    });

    it('should handle errors when checking Nebula health', async () => {
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.isConnected.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const health = await healthCheckService.checkDatabaseHealth();

      expect(health.nebula.status).toBe('unhealthy');
      expect(health.nebula.message).toContain('Connection failed');
    });
  });

  describe('checkSystemHealth', () => {
    it('should return healthy status when system resources are normal', () => {
      // Mock process.memoryUsage to return normal memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 150 * 1024 * 1024, // 150MB
      });

      // Mock Math.random to return a low value for CPU usage
      const originalMathRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.1); // 10% CPU usage

      const health = healthCheckService.checkSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(health.cpuUsage).toBeGreaterThanOrEqual(0);
      
      // Restore original functions
      (process as any).memoryUsage = originalMemoryUsage;
      Math.random = originalMathRandom;
    });

    it('should return degraded status when system resources are elevated', () => {
      // Mock process.memoryUsage to return high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 850 * 1024 * 1024, // 850MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        external: 50 * 1024 * 1024, // 50MB
        rss: 950 * 1024 * 1024, // 950MB
      });

      // Mock Math.random to return a high value for CPU usage
      const originalMathRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.85); // 85% CPU usage

      const health = healthCheckService.checkSystemHealth();

      expect(health.status).toBe('degraded');
      
      // Restore original functions
      (process as any).memoryUsage = originalMemoryUsage;
      Math.random = originalMathRandom;
    });

    it('should return unhealthy status when system resources are critically high', () => {
      // Mock process.memoryUsage to return very high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        external: 100 * 1024 * 1024, // 100MB
        rss: 1100 * 1024 * 1024, // 1100MB
      });

      // Mock Math.random to return a very high value for CPU usage
      const originalMathRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.95); // 95% CPU usage

      const health = healthCheckService.checkSystemHealth();

      expect(health.status).toBe('unhealthy');
      
      // Restore original functions
      (process as any).memoryUsage = originalMemoryUsage;
      Math.random = originalMathRandom;
    });

    it('should handle errors when checking system health', () => {
      // Mock process.memoryUsage to throw an error
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockImplementation(() => {
        throw new Error('System error');
      });

      const health = healthCheckService.checkSystemHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('System health check failed');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
      (process as any).memoryUsage = originalMemoryUsage;
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
      });

      // Mock process.memoryUsage to return normal memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 150 * 1024 * 1024, // 150MB
      });

      // Mock Math.random to return a low value for CPU usage
      const originalMathRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.1); // 10% CPU usage

      const health = await healthCheckService.performHealthCheck();

      expect(health.status).toBe('healthy');
      expect(health.checks.qdrant.status).toBe('healthy');
      expect(health.checks.nebula.status).toBe('healthy');
      expect(health.checks.system.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
      expect(mockPrometheusMetricsService.recordAlert).toHaveBeenCalledWith('low');
      
      // Restore original functions
      (process as any).memoryUsage = originalMemoryUsage;
      Math.random = originalMathRandom;
    });

    it('should return degraded status when one check is degraded', async () => {
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
      });

      // Mock system health to be degraded
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 850 * 1024 * 1024, // 850MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        external: 50 * 1024 * 1024, // 50MB
        rss: 950 * 1024 * 1024, // 950MB
      });

      // Mock Math.random to return a high value for CPU usage
      const originalMathRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.85); // 85% CPU usage

      const health = await healthCheckService.performHealthCheck();

      expect(health.status).toBe('degraded');
      expect(mockPrometheusMetricsService.recordAlert).toHaveBeenCalledWith('high');
      
      // Restore original functions
      (process as any).memoryUsage = originalMemoryUsage;
      Math.random = originalMathRandom;
    });

    it('should return unhealthy status when one check fails', async () => {
      mockQdrantService.isConnected.mockReturnValue(false);
      mockNebulaService.isConnected.mockReturnValue(true);

      const health = await healthCheckService.performHealthCheck();

      expect(health.status).toBe('unhealthy');
      expect(mockPrometheusMetricsService.recordAlert).toHaveBeenCalledWith('critical');
    });

    it('should handle errors during health check', async () => {
      // Mock the checkDatabaseHealth method to throw an error
      const originalCheckDatabaseHealth = healthCheckService.checkDatabaseHealth;
      healthCheckService.checkDatabaseHealth = jest
        .fn()
        .mockRejectedValue(new Error('Database check failed'));

      const health = await healthCheckService.performHealthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.checks.qdrant.status).toBe('unhealthy');
      expect(health.checks.nebula.status).toBe('unhealthy');
      expect(health.checks.system.status).toBe('unhealthy');
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // Restore original method
      healthCheckService.checkDatabaseHealth = originalCheckDatabaseHealth;
    });
  });

  describe('registerDependency', () => {
    it('should register a new dependency', () => {
      const dependency: ServiceDependency = {
        name: 'TestService',
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: 50,
      };

      healthCheckService.registerDependency(dependency);

      const dependencies = healthCheckService.getDependencies();
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Dependency registered', {
        dependency: 'TestService',
      });
    });
  });

  describe('getDependencies', () => {
    it('should return registered dependencies', () => {
      const dependency1: ServiceDependency = {
        name: 'Service1',
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: 50,
      };
      const dependency2: ServiceDependency = {
        name: 'Service2',
        status: 'degraded',
        lastCheck: Date.now(),
        responseTime: 150,
      };

      healthCheckService.registerDependency(dependency1);
      healthCheckService.registerDependency(dependency2);

      const dependencies = healthCheckService.getDependencies();
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual(dependency1);
      expect(dependencies).toContainEqual(dependency2);
    });

    it('should return an empty array when no dependencies are registered', () => {
      const dependencies = healthCheckService.getDependencies();
      expect(dependencies).toHaveLength(0);
    });
  });

  describe('checkDependencies', () => {
    it('should return registered dependencies with updated timestamps', async () => {
      const dependency: ServiceDependency = {
        name: 'TestService',
        status: 'healthy',
        lastCheck: Date.now() - 10000, // 10 seconds ago
        responseTime: 50,
      };

      healthCheckService.registerDependency(dependency);

      const dependencies = await healthCheckService.checkDependencies();
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].name).toBe('TestService');
      expect(dependencies[0].lastCheck).toBeGreaterThanOrEqual(dependency.lastCheck);
    });
  });

  describe('handleDegradedService', () => {
    it('should log a warning when a service is degraded', async () => {
      await healthCheckService.handleDegradedService('TestService');

      expect(mockLoggerService.warn).toHaveBeenCalledWith('Service degradation detected', {
        serviceName: 'TestService',
      });
    });
  });

  describe('handleServiceFailure', () => {
    it('should log an error and record a critical alert when a service fails', async () => {
      await healthCheckService.handleServiceFailure('TestService');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Service failure detected', {
        serviceName: 'TestService',
      });
      expect(mockPrometheusMetricsService.recordAlert).toHaveBeenCalledWith('critical');
    });
  });
});
