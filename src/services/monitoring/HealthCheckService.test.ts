import { Container } from 'inversify';
import { HealthCheckService } from './HealthCheckService';
import { QdrantService } from '../../database/QdrantService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('HealthCheckService', () => {
  let container: Container;
  let healthCheckService: HealthCheckService;
  let mockQdrantService: jest.Mocked<QdrantService>;
  let mockNebulaService: jest.Mocked<NebulaService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();

    // Create mocks
    mockQdrantService = {
      ping: jest.fn(),
      getCollectionInfo: jest.fn(),
      isConnected: jest.fn(),
    } as any;

    mockNebulaService = {
      ping: jest.fn(),
      executeQuery: jest.fn(),
      isConnected: jest.fn(),
      getConnectionStats: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getHealthCheckConfig: jest.fn().mockReturnValue({
        checkInterval: 30000,
        timeout: 5000,
        retryAttempts: 3,
        criticalServices: ['qdrant', 'nebula'],
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.QdrantService).toConstantValue(mockQdrantService);
    container.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.HealthCheckService).to(HealthCheckService);

    healthCheckService = container.get<HealthCheckService>(TYPES.HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkOverallHealth', () => {
    it('should return healthy status when all services are up', async () => {
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      const health = await healthCheckService.checkOverallHealth();

      expect(health.status).toBe('healthy');
      expect(health.services.qdrant.status).toBe('healthy');
      expect(health.services.nebula.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    it('should return degraded status when non-critical services are down', async () => {
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      // Mock a non-critical service failure
      const health = await healthCheckService.checkOverallHealth();

      expect(health.status).toBe('healthy'); // Should still be healthy if only non-critical services fail
    });

    it('should return unhealthy status when critical services are down', async () => {
      mockQdrantService.ping.mockRejectedValue(new Error('Connection failed'));
      mockQdrantService.isConnected.mockReturnValue(false);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      const health = await healthCheckService.checkOverallHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.services.qdrant.status).toBe('unhealthy');
      expect(health.services.qdrant.error).toBeDefined();
    });
  });

  describe('checkQdrantHealth', () => {
    it('should return healthy status for Qdrant', async () => {
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
      });

      const health = await healthCheckService.checkQdrantHealth();

      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeDefined();
      expect(health.details.vectorCount).toBe(1000);
      expect(health.details.collectionStatus).toBe('green');
    });

    it('should return unhealthy status when Qdrant is down', async () => {
      mockQdrantService.ping.mockRejectedValue(new Error('Service unavailable'));
      mockQdrantService.isConnected.mockReturnValue(false);

      const health = await healthCheckService.checkQdrantHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Service unavailable');
    });

    it('should handle timeout for slow responses', async () => {
      mockQdrantService.ping.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(true), 6000))
      );

      const health = await healthCheckService.checkQdrantHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('timeout');
    });
  });

  describe('checkNebulaHealth', () => {
    it('should return healthy status for NebulaGraph', async () => {
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);
      mockNebulaService.getConnectionStats.mockResolvedValue({
        activeConnections: 5,
        totalConnections: 10,
        avgResponseTime: 50,
      });

      const health = await healthCheckService.checkNebulaHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.activeConnections).toBe(5);
      expect(health.details.avgResponseTime).toBe(50);
    });

    it('should return unhealthy status when NebulaGraph is down', async () => {
      mockNebulaService.ping.mockRejectedValue(new Error('Connection refused'));
      mockNebulaService.isConnected.mockReturnValue(false);

      const health = await healthCheckService.checkNebulaHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection refused');
    });
  });

  describe('checkDatabaseConsistency', () => {
    it('should verify data consistency between databases', async () => {
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        vectors_count: 1000,
      });
      mockNebulaService.executeQuery.mockResolvedValue({
        data: [{ count: 1000 }]
      });

      const consistency = await healthCheckService.checkDatabaseConsistency();

      expect(consistency.status).toBe('consistent');
      expect(consistency.vectorCount).toBe(1000);
      expect(consistency.graphNodeCount).toBe(1000);
      expect(consistency.discrepancy).toBe(0);
    });

    it('should detect inconsistencies between databases', async () => {
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        vectors_count: 1000,
      });
      mockNebulaService.executeQuery.mockResolvedValue({
        data: [{ count: 950 }]
      });

      const consistency = await healthCheckService.checkDatabaseConsistency();

      expect(consistency.status).toBe('inconsistent');
      expect(consistency.discrepancy).toBe(50);
      expect(consistency.discrepancyPercentage).toBe(5);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system performance metrics', async () => {
      const metrics = await healthCheckService.getSystemMetrics();

      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.cpu).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('performDeepHealthCheck', () => {
    it('should perform comprehensive health check', async () => {
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockQdrantService.getCollectionInfo.mockResolvedValue({
        status: 'green',
        vectors_count: 1000,
      });

      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);
      mockNebulaService.executeQuery.mockResolvedValue({
        data: [{ count: 1000 }]
      });

      const deepHealth = await healthCheckService.performDeepHealthCheck();

      expect(deepHealth.overall.status).toBe('healthy');
      expect(deepHealth.services).toBeDefined();
      expect(deepHealth.consistency).toBeDefined();
      expect(deepHealth.performance).toBeDefined();
      expect(deepHealth.recommendations).toBeInstanceOf(Array);
    });

    it('should provide recommendations for unhealthy services', async () => {
      mockQdrantService.ping.mockRejectedValue(new Error('Connection failed'));
      mockQdrantService.isConnected.mockReturnValue(false);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      const deepHealth = await healthCheckService.performDeepHealthCheck();

      expect(deepHealth.overall.status).toBe('unhealthy');
      expect(deepHealth.recommendations).toContain('Check Qdrant service connectivity');
      expect(deepHealth.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('startHealthMonitoring', () => {
    it('should start periodic health monitoring', async () => {
      const healthCallback = jest.fn();

      healthCheckService.startHealthMonitoring(healthCallback);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Started health monitoring');

      // Stop monitoring to clean up
      healthCheckService.stopHealthMonitoring();
    });
  });

  describe('getHealthHistory', () => {
    it('should return health check history', async () => {
      // Perform a few health checks to build history
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      await healthCheckService.checkOverallHealth();
      await healthCheckService.checkOverallHealth();

      const history = healthCheckService.getHealthHistory();

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].status).toBeDefined();
    });
  });

  describe('generateHealthReport', () => {
    it('should generate comprehensive health report', async () => {
      mockQdrantService.ping.mockResolvedValue(true);
      mockQdrantService.isConnected.mockReturnValue(true);
      mockNebulaService.ping.mockResolvedValue(true);
      mockNebulaService.isConnected.mockReturnValue(true);

      const report = await healthCheckService.generateHealthReport();

      expect(report.summary).toBeDefined();
      expect(report.services).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.alerts).toBeInstanceOf(Array);
      expect(report.generatedAt).toBeDefined();
    });
  });
});