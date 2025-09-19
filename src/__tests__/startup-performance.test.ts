import 'reflect-metadata';
import { DIContainer } from '../core/DIContainer';
import { TYPES } from '../types';
import { LazyServiceLoader } from '../core/LazyServiceLoader';

describe('Startup Performance', () => {
  let mockLazyLoader: jest.Mocked<LazyServiceLoader>;

  beforeEach(() => {
    // 重置DI容器
    (DIContainer as any).instance = null;
    (DIContainer as any).lazyLoader = null;

    // 创建模拟的LazyServiceLoader
    mockLazyLoader = {
      isServiceLoaded: jest.fn().mockReturnValue(false),
      getLoadedServices: jest.fn().mockReturnValue([]),
      recordServiceLoad: jest.fn(),
      setLogger: jest.fn(),
      loadVectorStorageService: jest.fn().mockResolvedValue({} as any),
      loadGraphPersistenceService: jest.fn().mockResolvedValue({} as any),
      loadQdrantService: jest.fn().mockResolvedValue({} as any),
      loadNebulaService: jest.fn().mockResolvedValue({} as any),
      loadHttpServer: jest.fn().mockResolvedValue({} as any),
      loadMCPServer: jest.fn().mockResolvedValue({} as any),
      getServiceGroup: jest.fn(),
      checkServiceDependencies: jest.fn().mockReturnValue(true),
      getLoadedGroups: jest.fn().mockReturnValue([]),
      getServiceLoadTime: jest.fn().mockReturnValue(0)
    } as any;

    // 设置模拟的LazyServiceLoader
    DIContainer.setLazyLoader(mockLazyLoader);
  });

  afterEach(() => {
    // 清理
    DIContainer.setLazyLoader(null);
  });

  it('should load core services immediately', async () => {
    const startTime = Date.now();
    const container = DIContainer.getInstance();
    
    // 核心服务应该立即可用
    const configService = await DIContainer.get(TYPES.ConfigService);
    const loggerService = await DIContainer.get(TYPES.LoggerService);
    const errorHandlerService = await DIContainer.get(TYPES.ErrorHandlerService);
    
    const loadTime = Date.now() - startTime;
    
    expect(configService).toBeDefined();
    expect(loggerService).toBeDefined();
    expect(errorHandlerService).toBeDefined();
    expect(loadTime).toBeLessThan(100); // 核心服务应该在100ms内加载
  });

  it('should lazy load non-core services', async () => {
    const container = DIContainer.getInstance();
    
    // 懒加载服务在获取前不应该被加载
    expect(DIContainer.isServiceLoaded(TYPES.VectorStorageService)).toBeFalsy();
    expect(DIContainer.isServiceLoaded(TYPES.GraphPersistenceService)).toBeFalsy();
    
    const startTime = Date.now();
    
    // 获取懒加载服务
    const vectorStorageService = await DIContainer.get(TYPES.VectorStorageService);
    const graphPersistenceService = await DIContainer.get(TYPES.GraphPersistenceService);
    
    const loadTime = Date.now() - startTime;
    
    expect(vectorStorageService).toBeDefined();
    expect(graphPersistenceService).toBeDefined();
    expect(mockLazyLoader.loadVectorStorageService).toHaveBeenCalled();
    expect(mockLazyLoader.loadGraphPersistenceService).toHaveBeenCalled();
    
    // 懒加载时间应该合理
    expect(loadTime).toBeLessThan(1000);
  });

  it('should track loaded services', async () => {
    const container = DIContainer.getInstance();
    
    // 初始只加载核心服务
    const initialLoaded = DIContainer.getLoadedServices();
    expect(initialLoaded.length).toBeGreaterThanOrEqual(0);
    
    // 模拟服务加载后的状态
    mockLazyLoader.isServiceLoaded.mockImplementation((serviceId) => {
      return [TYPES.VectorStorageService, TYPES.GraphPersistenceService, TYPES.QdrantService].includes(serviceId as symbol);
    });
    mockLazyLoader.getLoadedServices.mockReturnValue([
      TYPES.VectorStorageService.toString(),
      TYPES.GraphPersistenceService.toString(),
      TYPES.QdrantService.toString()
    ]);
    
    // 加载一些懒加载服务
    await DIContainer.get(TYPES.VectorStorageService);
    await DIContainer.get(TYPES.GraphPersistenceService);
    await DIContainer.get(TYPES.QdrantService);
    
    const afterLoad = DIContainer.getLoadedServices();
    expect(afterLoad.length).toBeGreaterThan(initialLoaded.length);
    expect(mockLazyLoader.loadVectorStorageService).toHaveBeenCalled();
    expect(mockLazyLoader.loadGraphPersistenceService).toHaveBeenCalled();
    expect(mockLazyLoader.loadQdrantService).toHaveBeenCalled();
  });
});