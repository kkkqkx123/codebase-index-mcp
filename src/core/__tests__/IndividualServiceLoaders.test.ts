import 'reflect-metadata';
import { Container } from 'inversify';
import { IndividualServiceLoaders } from '../IndividualServiceLoaders';
import { LazyServiceLoader } from '../LazyServiceLoader';
import { TYPES } from '../../types';

// Mock LazyServiceLoader
jest.mock('../LazyServiceLoader');
const MockedLazyServiceLoader = LazyServiceLoader as jest.MockedClass<typeof LazyServiceLoader>;

// Mock various services
jest.mock('../../database/qdrant/VectorStorageService');
jest.mock('../../database/nebula/GraphPersistenceService');
jest.mock('../../database/qdrant/QdrantService');
jest.mock('../../database/nebula/NebulaService');
jest.mock('../../server/HttpServer');
jest.mock('../../server/MCPServer');

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
      loadVectorStorageService: jest.fn(),
      loadGraphPersistenceService: jest.fn(),
      loadQdrantService: jest.fn(),
      loadNebulaService: jest.fn(),
      loadHttpServer: jest.fn(),
      loadMCPServer: jest.fn(),
    } as any;
    
    MockedLazyServiceLoader.mockImplementation(() => mockLazyLoader);
    
    serviceLoaders = new IndividualServiceLoaders(mockLazyLoader);
  });

  describe('loadVectorStorageService', () => {
    it('should load vector storage service', async () => {
      const mockService = {};
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadVectorStorageService(container);
      
      expect(mockLazyLoader.loadVectorStorageService).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.VectorStorageService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadVectorStorageService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.VectorStorageService);
    });

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load service');
      mockLazyLoader.loadVectorStorageService.mockRejectedValue(error);
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Failed to load service');
    });
  });

  describe('loadGraphPersistenceService', () => {
    it('should load graph persistence service', async () => {
      const mockService = {};
      mockLazyLoader.loadGraphPersistenceService.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadGraphPersistenceService(container);
      
      expect(mockLazyLoader.loadGraphPersistenceService).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.GraphPersistenceService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadGraphPersistenceService.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadGraphPersistenceService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.GraphPersistenceService);
    });
  });

  describe('loadQdrantService', () => {
    it('should load Qdrant service', async () => {
      const mockService = {};
      mockLazyLoader.loadQdrantService.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadQdrantService(container);
      
      expect(mockLazyLoader.loadQdrantService).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.QdrantService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadQdrantService.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadQdrantService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.QdrantService);
    });
  });

  describe('loadNebulaService', () => {
    it('should load Nebula service', async () => {
      const mockService = {};
      mockLazyLoader.loadNebulaService.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadNebulaService(container);
      
      expect(mockLazyLoader.loadNebulaService).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.NebulaService)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadNebulaService.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadNebulaService(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.NebulaService);
    });
  });

  describe('loadHttpServer', () => {
    it('should load HTTP server', async () => {
      const mockService = {};
      mockLazyLoader.loadHttpServer.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadHttpServer(container);
      
      expect(mockLazyLoader.loadHttpServer).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.HttpServer)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadHttpServer.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadHttpServer(container);
      
      expect(mockLazyLoader.recordServiceLoad).toHaveBeenCalledWith(TYPES.HttpServer);
    });
  });

  describe('loadMCPServer', () => {
    it('should load MCP server', async () => {
      const mockService = {};
      mockLazyLoader.loadMCPServer.mockResolvedValue(mockService as any);
      
      const result = await serviceLoaders.loadMCPServer(container);
      
      expect(mockLazyLoader.loadMCPServer).toHaveBeenCalledWith(container);
      expect(result).toBe(mockService);
      expect(container.isBound(TYPES.MCPServer)).toBeTruthy();
    });

    it('should record service load', async () => {
      const mockService = {};
      mockLazyLoader.loadMCPServer.mockResolvedValue(mockService as any);
      
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
      const mockService = {};
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockService as any);
      
      // Initially not loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(false);
      
      // Load the service
      await serviceLoaders.loadVectorStorageService(container);
      
      // Should now be loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(true);
    });

    it('should handle multiple service loads', async () => {
      const mockServices = [{}, {}, {}];
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockServices[0] as any);
      mockLazyLoader.loadGraphPersistenceService.mockResolvedValue(mockServices[1] as any);
      mockLazyLoader.loadQdrantService.mockResolvedValue(mockServices[2] as any);
      
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
      mockLazyLoader.loadVectorStorageService.mockRejectedValue(error);
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Service initialization failed');
      
      // Service should not be marked as loaded
      expect(serviceLoaders.isServiceLoaded(TYPES.VectorStorageService)).toBe(false);
      expect(mockLazyLoader.recordServiceLoad).not.toHaveBeenCalled();
    });

    it('should propagate errors from lazy loader', async () => {
      const error = new Error('Dependency injection failed');
      mockLazyLoader.loadVectorStorageService.mockRejectedValue(error);
      
      await expect(serviceLoaders.loadVectorStorageService(container)).rejects.toThrow('Dependency injection failed');
    });
  });

  describe('container binding', () => {
    it('should bind services to container with singleton scope', async () => {
      const mockService = {};
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockService as any);
      
      await serviceLoaders.loadVectorStorageService(container);
      
      // Service should be bound as singleton
      const service1 = container.get(TYPES.VectorStorageService);
      const service2 = container.get(TYPES.VectorStorageService);
      expect(service1).toBe(service2);
    });

    it('should not rebind already bound services', async () => {
      const mockService = {};
      mockLazyLoader.loadVectorStorageService.mockResolvedValue(mockService as any);
      
      // Load service twice
      await serviceLoaders.loadVectorStorageService(container);
      await serviceLoaders.loadVectorStorageService(container);
      
      // Should only call lazy loader once
      expect(mockLazyLoader.loadVectorStorageService).toHaveBeenCalledTimes(1);
    });
  });
});