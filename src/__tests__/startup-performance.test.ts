import 'reflect-metadata';
import { DIContainer } from '../core/DIContainer';
import { TYPES } from '../types';

describe('Startup Performance', () => {
  beforeEach(() => {
    // 重置DI容器
    (DIContainer as any).instance = null;
    (DIContainer as any).lazyLoader = null;
  });

  it('should load core services immediately', () => {
    const startTime = Date.now();
    const container = DIContainer.getInstance();
    
    // 核心服务应该立即可用
    const configService = DIContainer.get(TYPES.ConfigService);
    const loggerService = DIContainer.get(TYPES.LoggerService);
    const errorHandlerService = DIContainer.get(TYPES.ErrorHandlerService);
    
    const loadTime = Date.now() - startTime;
    
    expect(configService).toBeDefined();
    expect(loggerService).toBeDefined();
    expect(errorHandlerService).toBeDefined();
    expect(loadTime).toBeLessThan(100); // 核心服务应该在100ms内加载
  });

  it('should lazy load non-core services', () => {
    const container = DIContainer.getInstance();
    
    // 懒加载服务在获取前不应该被加载
    expect(DIContainer.isServiceLoaded(TYPES.VectorStorageService)).toBeFalsy();
    expect(DIContainer.isServiceLoaded(TYPES.GraphPersistenceService)).toBeFalsy();
    
    const startTime = Date.now();
    
    // 获取懒加载服务
    const vectorStorageService = DIContainer.get(TYPES.VectorStorageService);
    const graphPersistenceService = DIContainer.get(TYPES.GraphPersistenceService);
    
    const loadTime = Date.now() - startTime;
    
    expect(vectorStorageService).toBeDefined();
    expect(graphPersistenceService).toBeDefined();
    expect(DIContainer.isServiceLoaded(TYPES.VectorStorageService)).toBeTruthy();
    expect(DIContainer.isServiceLoaded(TYPES.GraphPersistenceService)).toBeTruthy();
    
    // 懒加载时间应该合理
    expect(loadTime).toBeLessThan(1000);
  });

  it('should track loaded services', () => {
    const container = DIContainer.getInstance();
    
    // 初始只加载核心服务
    const initialLoaded = DIContainer.getLoadedServices();
    expect(initialLoaded.length).toBeGreaterThanOrEqual(0);
    
    // 加载一些懒加载服务
    DIContainer.get(TYPES.VectorStorageService);
    DIContainer.get(TYPES.GraphPersistenceService);
    DIContainer.get(TYPES.QdrantService);
    
    const afterLoad = DIContainer.getLoadedServices();
    expect(afterLoad.length).toBeGreaterThan(initialLoaded.length);
    expect(afterLoad).toContain(TYPES.VectorStorageService.toString());
    expect(afterLoad).toContain(TYPES.GraphPersistenceService.toString());
    expect(afterLoad).toContain(TYPES.QdrantService.toString());
  });
});