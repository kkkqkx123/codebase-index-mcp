import 'reflect-metadata';
import { Container } from 'inversify';
import { IndividualServiceLoaders } from '../IndividualServiceLoaders';
import { LazyServiceLoader } from '../LazyServiceLoader';
import { TYPES } from '../../types';

// Mock LazyServiceLoader
jest.mock('../LazyServiceLoader');
const MockedLazyServiceLoader = LazyServiceLoader as jest.MockedClass<typeof LazyServiceLoader>;

// Mock various services - only mock the actual service files that exist
jest.mock('../../services/storage/vector/VectorStorageService');
jest.mock('../../services/storage/graph/GraphPersistenceService');
jest.mock('../../database/QdrantService');
jest.mock('../../database/NebulaService');
jest.mock('../../api/HttpServer');
jest.mock('../../mcp/MCPServer');

describe('IndividualServiceLoaders', () => {
  let serviceLoaders: IndividualServiceLoaders;
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
      loadService: jest.fn(),
    } as any;
    
    MockedLazyServiceLoader.mockImplementation(() => mockLazyLoader);
    
    serviceLoaders = new IndividualServiceLoaders(mockLazyLoader);
  });

  describe('loadVectorStorageService', () => {
    it('should load vector storage service', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      const result = await serviceLoaders.loadVectorStorageService(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../services/storage/vector/VectorStorageService', 'VectorStorageService');
      expect(container.isBound(TYPES.VectorStorageService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      await serviceLoaders.loadVectorStorageService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.VectorStorageService);
    });

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load service');
      mockLazyLoader.loadService.mockRejectedValue(error);
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Failed to load service');
    });
  });

  describe('loadGraphPersistenceService', () => {
    it('should load graph persistence service', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.NebulaService).toConstantValue({});
      container.bind(TYPES.NebulaSpaceManager).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.NebulaQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphDatabaseErrorHandler).toConstantValue({});
      container.bind(TYPES.GraphPersistenceUtils).toConstantValue({});
      container.bind(TYPES.GraphCacheService).toConstantValue({});
      container.bind(TYPES.GraphPerformanceMonitor).toConstantValue({});
      container.bind(TYPES.GraphBatchOptimizer).toConstantValue({});
      container.bind(TYPES.GraphQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphSearchService).toConstantValue({});
      
      await serviceLoaders.loadGraphPersistenceService(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../services/storage/graph/GraphPersistenceService', 'GraphPersistenceService');
      expect(container.isBound(TYPES.GraphPersistenceService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.NebulaService).toConstantValue({});
      container.bind(TYPES.NebulaSpaceManager).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.NebulaQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphDatabaseErrorHandler).toConstantValue({});
      container.bind(TYPES.GraphPersistenceUtils).toConstantValue({});
      container.bind(TYPES.GraphCacheService).toConstantValue({});
      container.bind(TYPES.GraphPerformanceMonitor).toConstantValue({});
      container.bind(TYPES.GraphBatchOptimizer).toConstantValue({});
      container.bind(TYPES.GraphQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphSearchService).toConstantValue({});
      
      await serviceLoaders.loadGraphPersistenceService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.GraphPersistenceService);
    });
  });

  describe('loadQdrantService', () => {
    it('should load Qdrant service', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      
      await serviceLoaders.loadQdrantService(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../database/QdrantService', 'QdrantService');
      expect(container.isBound(TYPES.QdrantService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      
      await serviceLoaders.loadQdrantService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.QdrantService);
    });
  });

  describe('loadNebulaService', () => {
    it('should load Nebula service', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.NebulaConnectionManager).toConstantValue({});
      
      await serviceLoaders.loadNebulaService(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../database/NebulaService', 'NebulaService');
      expect(container.isBound(TYPES.NebulaService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.NebulaConnectionManager).toConstantValue({});
      
      await serviceLoaders.loadNebulaService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.NebulaService);
    });
  });

  describe('loadHttpServer', () => {
    it('should load HTTP server', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      await serviceLoaders.loadHttpServer(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../api/HttpServer', 'HttpServer');
      expect(container.isBound(TYPES.HttpServer)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      await serviceLoaders.loadHttpServer(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.HttpServer);
    });
  });

  describe('loadMCPServer', () => {
    it('should load MCP server', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.IndexService).toConstantValue({});
      container.bind(TYPES.GraphService).toConstantValue({});
      
      await serviceLoaders.loadMCPServer(container);
      
      expect(mockLazyLoader.loadService).toHaveBeenCalledWith('../mcp/MCPServer', 'MCPServer');
      expect(container.isBound(TYPES.MCPServer)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.IndexService).toConstantValue({});
      container.bind(TYPES.GraphService).toConstantValue({});
      
      await serviceLoaders.loadMCPServer(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.MCPServer);
    });
  });

  describe('isServiceLoaded', () => {
    it('should delegate to lazy loader', () => {
      mockLazyLoader.isServiceLoaded.mockReturnValue(true);
      
      const result = serviceLoaders.isServiceLoaded(TYPES.VectorStorageService);
      
      expect(mockLazyLoader.isServiceLoaded).toHaveBeenCalledWith(TYPES.VectorStorageService);
      expect(result).toBe(true);
    });

    it('should return false for unloaded service', () => {
      mockLazyLoader.isServiceLoaded.mockReturnValue(false);
      
      const result = serviceLoaders.isServiceLoaded(TYPES.VectorStorageService);
      
      expect(result).toBe(false);
    });
  });

  describe('service loading state tracking', () => {
    it('should track loaded services', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      // Mock isServiceLoaded to return false initially
      mockLazyLoader.isServiceLoaded.mockReturnValue(false);
      
      // Initially not loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(false);
      
      // Load the service
      await serviceLoaders.loadVectorStorageService(container);
      
      // Mock isServiceLoaded to return true after loading
      mockLazyLoader.isServiceLoaded.mockImplementation((serviceId) => {
        return serviceId === TYPES.VectorStorageService;
      });
      
      // Should now be loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(true);
    });

    it('should handle multiple service loads', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock dependencies for all services
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      container.bind(TYPES.NebulaService).toConstantValue({});
      container.bind(TYPES.NebulaSpaceManager).toConstantValue({});
      container.bind(TYPES.NebulaQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphDatabaseErrorHandler).toConstantValue({});
      container.bind(TYPES.GraphPersistenceUtils).toConstantValue({});
      container.bind(TYPES.GraphCacheService).toConstantValue({});
      container.bind(TYPES.GraphPerformanceMonitor).toConstantValue({});
      container.bind(TYPES.GraphBatchOptimizer).toConstantValue({});
      container.bind(TYPES.GraphQueryBuilder).toConstantValue({});
      container.bind(TYPES.GraphSearchService).toConstantValue({});
      container.bind(TYPES.NebulaConnectionManager).toConstantValue({});
      
      // Mock isServiceLoaded to track loaded services
      const loadedServices = new Set();
      mockLazyLoader.isServiceLoaded.mockImplementation((serviceId) => {
        return loadedServices.has(serviceId);
      });
      mockLazyLoader.recordServiceLoad.mockImplementation((serviceId) => {
        loadedServices.add(serviceId);
      });
      
      await serviceLoaders.loadVectorStorageService(container);
      await serviceLoaders.loadGraphPersistenceService(container);
      await serviceLoaders.loadQdrantService(container);
      
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(true);
      expect(serviceLoaders.isServiceLoaded(TYPES.GraphPersistenceService)).toBe(true);
      expect(serviceLoaders.isServiceLoaded(TYPES.QdrantService)).toBe(true);
      expect(serviceLoaders.isServiceLoaded(TYPES.NebulaService)).toBe(false); // Not loaded
    });
  });

  describe('error handling', () => {
    it('should not mark service as loaded on failure', async () => {
      const error = new Error('Service initialization failed');
      mockLazyLoader.loadService.mockRejectedValue(error);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Service initialization failed');
      
      // Service should not be marked as loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(false);
      expect(mockLazyLoader.recordServiceLoad).not.toHaveBeenCalled();
    });

    it('should propagate errors from lazy loader', async () => {
      const error = new Error('Dependency injection failed');
      mockLazyLoader.loadService.mockRejectedValue(error);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Dependency injection failed');
    });
  });

  describe('container binding', () => {
    it('should bind services to container with singleton scope', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      await serviceLoaders.loadVectorStorageService(container);
      
      // Service should be bound as singleton
      const service1 = container.get(TYPES.VectorStorageService);
      const service2 = container.get(TYPES.VectorStorageService);
      expect(service1).toBe(service2);
    });

    it('should not rebind already bound services', async () => {
      const mockService = jest.fn();
      mockLazyLoader.loadService.mockResolvedValue(mockService);
      
      // Mock container dependencies
      container.bind(TYPES.QdrantClientWrapper).toConstantValue({});
      container.bind(TYPES.LoggerService).toConstantValue({});
      container.bind(TYPES.ErrorHandlerService).toConstantValue({});
      container.bind(TYPES.ConfigService).toConstantValue({});
      container.bind(TYPES.BatchProcessingMetrics).toConstantValue({});
      container.bind(TYPES.EmbedderFactory).toConstantValue({});
      container.bind(TYPES.BatchProcessingService).toConstantValue({});
      container.bind(TYPES.EmbeddingService).toConstantValue({});
      
      // Load service twice
      await serviceLoaders.loadVectorStorageService(container);
      await serviceLoaders.loadVectorStorageService(container);
      
      // Should only call lazy loader once
      expect(mockLazyLoader.loadService).toHaveBeenCalledTimes(1);
    });
  });
});