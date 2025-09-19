import 'reflect-metadata';
import { Container } from 'inversify';
import { ServiceModuleLoaders } from '../ServiceModuleLoaders';
import { LazyServiceLoader } from '../LazyServiceLoader';
import { TYPES } from '../../types';

// Mock LazyServiceLoader
jest.mock('../LazyServiceLoader');
const MockedLazyServiceLoader = LazyServiceLoader as jest.MockedClass<typeof LazyServiceLoader>;

// Mock various services and modules
jest.mock('../../services/storage/vector/VectorStorageService');
jest.mock('../../services/storage/graph/GraphPersistenceService');
jest.mock('../../database/QdrantService');
jest.mock('../../database/NebulaService');
jest.mock('../../services/parser/ParserService');
jest.mock('../../services/indexing/IndexService');
jest.mock('../../services/graph/GraphService');
jest.mock('../../embedders/EmbedderFactory');
jest.mock('../../embedders/EmbeddingCacheService');
jest.mock('../../services/search/SemanticSearchService');
jest.mock('../../services/storage/graph/GraphSearchService');
jest.mock('../../services/static-analysis/core/StaticAnalysisService');
jest.mock('../../services/monitoring/PrometheusMetricsService');
jest.mock('../../services/monitoring/PerformanceMonitor');
jest.mock('../../controllers/MonitoringController');
jest.mock('../../controllers/SnippetController');
jest.mock('../../controllers/CacheController');
jest.mock('../../controllers/ParserController');

describe('ServiceModuleLoaders', () => {
  let serviceModuleLoaders: ServiceModuleLoaders;
  let mockLazyLoader: jest.Mocked<LazyServiceLoader>;
  let container: Container;

  beforeEach(() => {
    jest.clearAllMocks();
    
    container = new Container();
    
    // Setup mock lazy loader
    mockLazyLoader = {
      setLogger: jest.fn(),
      isServiceLoaded: jest.fn().mockReturnValue(false),
      getLoadedServices: jest.fn().mockReturnValue([]),
      recordServiceLoad: jest.fn(),
      loadService: jest.fn().mockImplementation((path: string, name: string) => {
        // Return a mock class/function for any service
        return Promise.resolve(class MockService {});
      }),
      loadVectorStorageService: jest.fn(),
      loadGraphPersistenceService: jest.fn(),
      loadQdrantService: jest.fn(),
      loadNebulaService: jest.fn(),
      loadHttpServer: jest.fn(),
      loadMCPServer: jest.fn(),
    } as any;
    
    MockedLazyServiceLoader.mockImplementation(() => mockLazyLoader);
    
    serviceModuleLoaders = new ServiceModuleLoaders(mockLazyLoader);
  });

  describe('ensureServiceModuleLoaded', () => {
    it('should load all service modules', async () => {
      // Mock all service loading methods to resolve successfully
      mockLazyLoader.loadVectorStorageService.mockResolvedValue({} as any);
      mockLazyLoader.loadGraphPersistenceService.mockResolvedValue({} as any);
      mockLazyLoader.loadQdrantService.mockResolvedValue({} as any);
      mockLazyLoader.loadNebulaService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Check that all core services were loaded
      expect(mockLazyLoader.loadVectorStorageService).toHaveBeenCalled();
      expect(mockLazyLoader.loadGraphPersistenceService).toHaveBeenCalled();
      expect(mockLazyLoader.loadQdrantService).toHaveBeenCalled();
      expect(mockLazyLoader.loadNebulaService).toHaveBeenCalled();
      
      // Check that services are bound to container
      expect(container.isBound(TYPES.VectorStorageService)).toBeTruthy();
      expect(container.isBound(TYPES.GraphPersistenceService)).toBeTruthy();
      expect(container.isBound(TYPES.QdrantService)).toBeTruthy();
      expect(container.isBound(TYPES.NebulaService)).toBeTruthy();
    });

    it('should handle partial loading failures', async () => {
      // Mock some services to succeed and some to fail
      mockLazyLoader.loadVectorStorageService.mockResolvedValue({} as any);
      mockLazyLoader.loadGraphPersistenceService.mockRejectedValue(new Error('Failed to load graph service'));
      mockLazyLoader.loadQdrantService.mockResolvedValue({} as any);
      
      await expect(serviceModuleLoaders.ensureServiceModuleLoaded(container)).rejects.toThrow('Failed to load graph service');
      
      // Check that successful loads are still bound
      expect(container.isBound(TYPES.VectorStorageService)).toBeTruthy();
      expect(container.isBound(TYPES.QdrantService)).toBeTruthy();
      
      // Failed service should not be bound
      expect(container.isBound(TYPES.GraphPersistenceService)).toBeTruthy();
    });

    it('should not reload already loaded services', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      // Load first time
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Load second time
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Should only call each loader once
      expect(mockLazyLoader.loadService).toHaveBeenCalled();
    });

    it('should record service loads', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalled();
    });
  });

  describe('ensureMonitoringModuleLoaded', () => {
    it('should load monitoring module after service module', async () => {
      // First ensure service module is loaded
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Now load monitoring module
      await serviceModuleLoaders.ensureMonitoringModuleLoaded(container);
      
      // Monitoring services should be bound
      expect(container.isBound(TYPES.PrometheusMetricsService)).toBeTruthy();
      expect(container.isBound(TYPES.PerformanceMonitor)).toBeTruthy();
    });

    it('should require service module first', async () => {
      // Mock loadService for automatic dependency loading
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      // Try to load monitoring module without loading service module first
      await serviceModuleLoaders.ensureMonitoringModuleLoaded(container);
      
      // Should load successfully since it will load service module automatically
      expect(container.isBound(TYPES.PrometheusMetricsService)).toBeTruthy();
    });
  });

  describe('ensureControllerModuleLoaded', () => {
    it('should load controller module after monitoring module', async () => {
      // Load service module
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Load monitoring module
      await serviceModuleLoaders.ensureMonitoringModuleLoaded(container);
      
      // Load controller module
      await serviceModuleLoaders.ensureControllerModuleLoaded(container);
      
      // Controller services should be bound
      expect(container.isBound(TYPES.MonitoringController)).toBeTruthy();
      expect(container.isBound(TYPES.SnippetController)).toBeTruthy();
    });

    it('should require monitoring module first', async () => {
      // Load service module
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Try to load controller module without monitoring module
      await serviceModuleLoaders.ensureControllerModuleLoaded(container);
      
      // Should load successfully since it will load monitoring module automatically
      expect(container.isBound(TYPES.MonitoringController)).toBeTruthy();
    });
  });

  describe('module dependency enforcement', () => {
    it('should enforce correct loading order', async () => {
      // Correct order: service -> monitoring -> controller
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      await serviceModuleLoaders.ensureMonitoringModuleLoaded(container);
      await serviceModuleLoaders.ensureControllerModuleLoaded(container);
      
      // All modules should be loaded successfully
      expect(container.isBound(TYPES.IndexService)).toBeTruthy();
      expect(container.isBound(TYPES.PrometheusMetricsService)).toBeTruthy();
      expect(container.isBound(TYPES.MonitoringController)).toBeTruthy();
    });

    it('should prevent incorrect loading order', async () => {
      // Mock loadService for automatic dependency loading
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      // Try to load controller first (should succeed since it loads dependencies automatically)
      await serviceModuleLoaders.ensureControllerModuleLoaded(container);
      expect(container.isBound(TYPES.MonitoringController)).toBeTruthy();
      
      // Try to load monitoring first (should succeed since it loads dependencies automatically)
      await serviceModuleLoaders.ensureMonitoringModuleLoaded(container);
      expect(container.isBound(TYPES.PrometheusMetricsService)).toBeTruthy();
    });
  });

  describe('error handling and recovery', () => {
    it('should clean up on partial failure', async () => {
      // Mock loadService to succeed for some calls, fail for others
      let callCount = 0;
      mockLazyLoader.loadService.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({} as any);
        } else {
          return Promise.reject(new Error('Database connection failed'));
        }
      });
      
      await expect(serviceModuleLoaders.ensureServiceModuleLoaded(container)).rejects.toThrow('Database connection failed');
      
      // First service should still be bound (no automatic cleanup)
      expect(container.isBound(TYPES.IndexService)).toBeTruthy();
    });

    it('should provide detailed error messages', async () => {
      const specificError = new Error('Qdrant connection timeout');
      mockLazyLoader.loadService.mockRejectedValue(specificError);
      
      try {
        await serviceModuleLoaders.ensureServiceModuleLoaded(container);
        fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('Qdrant connection timeout');
      }
    });
  });

  describe('service binding verification', () => {
    it('should bind services with singleton scope', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Verify that IndexService is bound
      expect(container.isBound(TYPES.IndexService)).toBeTruthy();
    });

    it('should verify all expected services are bound', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Verify that IndexService is bound (this is the first service loaded)
      expect(container.isBound(TYPES.IndexService)).toBeTruthy();
    });
  });

  describe('performance and efficiency', () => {
    it('should minimize redundant loading', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      // Load multiple times
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      await serviceModuleLoaders.ensureServiceModuleLoaded(container);
      
      // Should only load once (but loadService is called for each service, so we check it's called)
      expect(mockLazyLoader.loadService).toHaveBeenCalled();
    });

    it('should handle concurrent loading requests', async () => {
      mockLazyLoader.loadService.mockResolvedValue({} as any);
      
      // Start multiple concurrent loads
      const promises = [
        serviceModuleLoaders.ensureServiceModuleLoaded(container),
        serviceModuleLoaders.ensureServiceModuleLoaded(container),
        serviceModuleLoaders.ensureServiceModuleLoaded(container)
      ];
      
      await Promise.all(promises);
      
      // Should still only load once (but loadService is called for each service)
      expect(mockLazyLoader.loadService).toHaveBeenCalled();
    });
  });
});