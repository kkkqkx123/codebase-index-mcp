import 'reflect-metadata';
import { Container } from 'inversify';
import { DIContainer } from '../DIContainer';
import { TYPES } from '../../types';
import { LazyServiceLoader } from '../LazyServiceLoader';

// Mock LazyServiceLoader
jest.mock('../LazyServiceLoader');
const MockedLazyServiceLoader = LazyServiceLoader as jest.MockedClass<typeof LazyServiceLoader>;

// Mock core services
jest.mock('../../config/ConfigService');
jest.mock('../LoggerService');
jest.mock('../ErrorHandlerService');
jest.mock('../GraphDatabaseErrorHandler');
jest.mock('../ErrorClassifier');

// Mock database services
jest.mock('../../database/qdrant/QdrantClientWrapper');
jest.mock('../../database/nebula/NebulaConnectionManager');
jest.mock('../../database/nebula/NebulaSpaceManager');
jest.mock('../../database/nebula/NebulaQueryBuilder');

// Mock embedder services
jest.mock('../../embedders/EmbedderFactory');
jest.mock('../../embedders/EmbeddingCacheService');

// Mock config factory
jest.mock('../../config/ConfigFactory');

describe('DIContainer', () => {
  beforeEach(() => {
    // Clear all mocks and reset DIContainer
    jest.clearAllMocks();
    DIContainer.reset();
  });

  describe('getInstance', () => {
    it('should return a Container instance', () => {
      const container = DIContainer.getInstance();
      expect(container).toBeInstanceOf(Container);
    });

    it('should return the same instance on subsequent calls', () => {
      const container1 = DIContainer.getInstance();
      const container2 = DIContainer.getInstance();
      expect(container1).toBe(container2);
    });

    it('should initialize with core modules loaded', () => {
      const container = DIContainer.getInstance();
      // Core services should be bound
      expect(container.isBound(TYPES.ConfigService)).toBeTruthy();
      expect(container.isBound(TYPES.LoggerService)).toBeTruthy();
      expect(container.isBound(TYPES.ErrorHandlerService)).toBeTruthy();
    });
  });

  describe('get', () => {
    it('should return core service instances', async () => {
      const configService = await DIContainer.get(TYPES.ConfigService);
      expect(configService).toBeDefined();
    });

    it('should throw error for unknown service', async () => {
      await expect(async () => {
        await DIContainer.get('UnknownService' as any);
      }).rejects.toThrow('Service UnknownService not found');
    });

    it('should use lazy loader for non-core services', async () => {
      // Mock lazy loader to return a service
      const mockService = { id: 'mockService' };
      const mockLoadVectorStorageService = jest.fn().mockResolvedValue(mockService);
      const mockLazyLoader = {
        setLogger: jest.fn(),
        isServiceLoaded: jest.fn().mockReturnValue(false),
        getLoadedServices: jest.fn().mockReturnValue([]),
        recordServiceLoad: jest.fn(),
        loadVectorStorageService: mockLoadVectorStorageService,
      } as any;
      
      DIContainer.reset();
      
      // Get instance first to ensure it's created, then override the lazy loader
      DIContainer.getInstance();
      DIContainer.setLazyLoader(mockLazyLoader);
      
      // This should trigger lazy loading for VectorStorageService
      const result = await DIContainer.get(TYPES.VectorStorageService);
      
      expect(mockLoadVectorStorageService).toHaveBeenCalled();
      expect(result).toBe(mockService);
    });
  });

  describe('reset', () => {
    it('should reset the container instance', () => {
      const container1 = DIContainer.getInstance();
      DIContainer.reset();
      const container2 = DIContainer.getInstance();
      expect(container1).not.toBe(container2);
    });
  });

  describe('isServiceLoaded', () => {
    it('should return false when lazy loader is not initialized', () => {
      DIContainer.reset();
      expect(DIContainer.isServiceLoaded(TYPES.VectorStorageService)).toBeFalsy();
    });

    it('should delegate to lazy loader when initialized', () => {
      const mockLazyLoader = {
        isServiceLoaded: jest.fn().mockReturnValue(true),
      } as any;
      
      DIContainer.reset();
      DIContainer.setLazyLoader(mockLazyLoader);
      
      expect(DIContainer.isServiceLoaded(TYPES.VectorStorageService)).toBeTruthy();
      expect(mockLazyLoader.isServiceLoaded).toHaveBeenCalledWith(TYPES.VectorStorageService);
    });
  });

  describe('getLoadedServices', () => {
    it('should return empty array when lazy loader is not initialized', () => {
      DIContainer.reset();
      expect(DIContainer.getLoadedServices()).toEqual([]);
    });

    it('should delegate to lazy loader when initialized', () => {
      const mockServices = ['VectorStorageService', 'GraphPersistenceService'];
      const mockLazyLoader = {
        getLoadedServices: jest.fn().mockReturnValue(mockServices),
      } as any;
      
      DIContainer.reset();
      DIContainer.setLazyLoader(mockLazyLoader);
      
      expect(DIContainer.getLoadedServices()).toEqual(mockServices);
      expect(mockLazyLoader.getLoadedServices).toHaveBeenCalled();
    });
  });
});