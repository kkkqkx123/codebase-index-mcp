import { Container } from 'inversify';
import { Newable } from '@inversifyjs/common';
import { TYPES } from '../types';
import { LazyServiceLoader } from './LazyServiceLoader';

// 导入所有需要的服务类型
import type { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';
import type { LoggerService } from '../core/LoggerService';
import type { ErrorHandlerService } from '../core/ErrorHandlerService';
import type { ConfigService } from '../config/ConfigService';
import type { BatchProcessingMetrics } from '../services/monitoring/BatchProcessingMetrics';
import type { EmbedderFactory } from '../embedders/EmbedderFactory';
import type { BatchProcessingService } from '../services/storage/BatchProcessingService';
import type { EmbeddingService } from '../services/storage/EmbeddingService';
import type { NebulaService } from '../database/NebulaService';
import type { NebulaSpaceManager } from '../database/nebula/NebulaSpaceManager';
import type { NebulaQueryBuilder } from '../database/nebula/NebulaQueryBuilder';
import type { GraphDatabaseErrorHandler } from '../core/GraphDatabaseErrorHandler';
import type { GraphPersistenceUtils } from '../services/storage/graph/GraphPersistenceUtils';
import type { GraphCacheService } from '../services/storage/graph/GraphCacheService';
import type { GraphPerformanceMonitor } from '../services/storage/graph/GraphPerformanceMonitor';
import type { GraphBatchOptimizer } from '../services/storage/graph/GraphBatchOptimizer';
import type { GraphQueryBuilder } from '../services/storage/graph/GraphQueryBuilder';
import type { GraphSearchService } from '../services/storage/graph/GraphSearchService';
import type { NebulaConnectionManager } from '../database/nebula/NebulaConnectionManager';
import type { IndexService } from '../services/indexing/IndexService';
import type { GraphService } from '../services/graph/GraphService';
import type { MCPServer } from '../mcp/MCPServer';

/**
 * 具体服务加载器实现类
 * 包含所有具体的服务加载方法
 */
export class IndividualServiceLoaders {
  constructor(private lazyLoader: LazyServiceLoader) {}

  /**
   * 加载向量存储服务
   */
  async loadVectorStorageService(container: Container) {
    if (!container.isBound(TYPES.VectorStorageService)) {
      const VectorStorageService = await this.lazyLoader.loadService('../services/storage/vector/VectorStorageService', 'VectorStorageService');
      const qdrantClient = container.get<QdrantClientWrapper>(TYPES.QdrantClientWrapper);
      const loggerService = container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const configService = container.get<ConfigService>(TYPES.ConfigService);
      const batchMetrics = container.get<BatchProcessingMetrics>(TYPES.BatchProcessingMetrics);
      const embedderFactory = container.get<EmbedderFactory>(TYPES.EmbedderFactory);
      const batchProcessingService = container.get<BatchProcessingService>(TYPES.BatchProcessingService);
      const embeddingService = container.get<EmbeddingService>(TYPES.EmbeddingService);
      
      container.bind(TYPES.VectorStorageService).toDynamicValue(() => {
        return new (VectorStorageService as unknown as Newable<any>)(
          qdrantClient,
          loggerService,
          errorHandlerService,
          configService,
          batchMetrics,
          embedderFactory,
          batchProcessingService,
          embeddingService
        );
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.VectorStorageService);
    return container.get(TYPES.VectorStorageService);
  }

  /**
   * 加载图持久化服务
   */
  async loadGraphPersistenceService(container: Container) {
    if (!container.isBound(TYPES.GraphPersistenceService)) {
      const GraphPersistenceService = await this.lazyLoader.loadService('../services/storage/graph/GraphPersistenceService', 'GraphPersistenceService');
      const nebulaService = container.get<NebulaService>(TYPES.NebulaService);
      const nebulaSpaceManager = container.get<NebulaSpaceManager>(TYPES.NebulaSpaceManager);
      const loggerService = container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const configService = container.get<ConfigService>(TYPES.ConfigService);
      const batchMetrics = container.get<BatchProcessingMetrics>(TYPES.BatchProcessingMetrics);
      const queryBuilder = container.get<NebulaQueryBuilder>(TYPES.NebulaQueryBuilder);
      const graphErrorHandler = container.get<GraphDatabaseErrorHandler>(TYPES.GraphDatabaseErrorHandler);
      const persistenceUtils = container.get<GraphPersistenceUtils>(TYPES.GraphPersistenceUtils);
      const cacheService = container.get<GraphCacheService>(TYPES.GraphCacheService);
      const performanceMonitor = container.get<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor);
      const batchOptimizer = container.get<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer);
      const enhancedQueryBuilder = container.get<GraphQueryBuilder>(TYPES.GraphQueryBuilder);
      const searchService = container.get<GraphSearchService>(TYPES.GraphSearchService);
      
      container.bind(TYPES.GraphPersistenceService).toDynamicValue(() => {
        return new (GraphPersistenceService as unknown as Newable<any>)(
          nebulaService,
          nebulaSpaceManager,
          loggerService,
          errorHandlerService,
          configService,
          batchMetrics,
          queryBuilder,
          graphErrorHandler,
          persistenceUtils,
          cacheService,
          performanceMonitor,
          batchOptimizer,
          enhancedQueryBuilder,
          searchService
        );
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.GraphPersistenceService);
    return container.get(TYPES.GraphPersistenceService);
  }

  /**
   * 加载Qdrant服务
   */
  async loadQdrantService(container: Container) {
    if (!container.isBound(TYPES.QdrantService)) {
      const QdrantService = await this.lazyLoader.loadService('../database/QdrantService', 'QdrantService');
      const configService = container.get<ConfigService>(TYPES.ConfigService);
      const loggerService = container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const qdrantClient = container.get<QdrantClientWrapper>(TYPES.QdrantClientWrapper);
      
      container.bind(TYPES.QdrantService).toDynamicValue(() => {
        return new (QdrantService as unknown as Newable<any>)(
          configService,
          loggerService,
          errorHandlerService,
          qdrantClient
        );
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.QdrantService);
    return container.get(TYPES.QdrantService);
  }

  /**
   * 加载Nebula服务
   */
  async loadNebulaService(container: Container) {
    if (!container.isBound(TYPES.NebulaService)) {
      const NebulaService = await this.lazyLoader.loadService('../database/NebulaService', 'NebulaService');
      const loggerService = container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const nebulaConnection = container.get<NebulaConnectionManager>(TYPES.NebulaConnectionManager);
      
      container.bind(TYPES.NebulaService).toDynamicValue(() => {
        return new (NebulaService as unknown as Newable<any>)(
          loggerService,
          errorHandlerService,
          nebulaConnection
        );
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.NebulaService);
    return container.get(TYPES.NebulaService);
  }

  /**
   * 加载HTTP服务器
   */
  async loadHttpServer(container: Container) {
    if (!container.isBound(TYPES.HttpServer)) {
      const HttpServer = await this.lazyLoader.loadService('../api/HttpServer', 'HttpServer');
      
      container.bind(TYPES.HttpServer).toDynamicValue(() => {
        return new (HttpServer as unknown as Newable<any>)();
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.HttpServer);
    return container.get(TYPES.HttpServer);
  }

  /**
   * 加载MCP服务器
   */
  async loadMCPServer(container: Container) {
    if (!container.isBound(TYPES.MCPServer)) {
      const MCPServer = await this.lazyLoader.loadService('../mcp/MCPServer', 'MCPServer');
      const loggerService = container.get<LoggerService>(TYPES.LoggerService);
      const indexService = container.get<IndexService>(TYPES.IndexService);
      const graphService = container.get<GraphService>(TYPES.GraphService);
      
      container.bind(TYPES.MCPServer).toDynamicValue(() => {
        return new (MCPServer as unknown as Newable<any>)(
          loggerService,
          indexService,
          graphService
        );
      }).inSingletonScope();
    }
    this.lazyLoader.recordServiceLoad(TYPES.MCPServer);
    return container.get(TYPES.MCPServer);
  }

  /**
   * 获取服务加载状态
   */
  isServiceLoaded(serviceIdentifier: string | symbol): boolean {
    return this.lazyLoader.isServiceLoaded(serviceIdentifier);
  }

  /**
   * 获取已加载的服务列表
   */
  getLoadedServices(): string[] {
    return this.lazyLoader.getLoadedServices();
  }

  /**
   * 记录服务加载
   */
  recordServiceLoad(serviceIdentifier: string | symbol): void {
    this.lazyLoader.recordServiceLoad(serviceIdentifier);
  }

  /**
   * 获取服务所属分组
   */
  getServiceGroup(serviceIdentifier: string | symbol): string | undefined {
    return this.lazyLoader.getServiceGroup(serviceIdentifier);
  }

  /**
   * 检查服务依赖是否满足
   */
  checkServiceDependencies(serviceIdentifier: string | symbol): boolean {
    return this.lazyLoader.checkServiceDependencies(serviceIdentifier);
  }

  /**
   * 获取已加载的服务分组列表
   */
  getLoadedGroups(): string[] {
    return this.lazyLoader.getLoadedGroups();
  }

  /**
   * 获取服务加载时间
   */
  getServiceLoadTime(serviceIdentifier: string | symbol): number | undefined {
    return this.lazyLoader.getServiceLoadTime(serviceIdentifier);
  }

  /**
   * 获取服务加载统计信息
   */
  getServiceLoadStats(): { total: number; byGroup: Record<string, number> } {
    return this.lazyLoader.getServiceLoadStats();
  }

  /**
   * 卸载服务分组（可选实现）
   */
  async unloadServiceGroup(group: string): Promise<void> {
    return this.lazyLoader.unloadServiceGroup(group);
  }

  /**
   * 获取服务加载性能统计
   */
  getPerformanceStats(): Array<{service: string; loadTime: number; group: string}> {
    return this.lazyLoader.getPerformanceStats();
  }

  /**
   * 批量检查服务是否已加载
   */
  areServicesLoaded(serviceIdentifiers: (string | symbol)[]): Record<string, boolean> {
    return this.lazyLoader.areServicesLoaded(serviceIdentifiers);
  }

  /**
   * 批量检查分组是否已加载
   */
  areGroupsLoaded(groups: string[]): Record<string, boolean> {
    return this.lazyLoader.areGroupsLoaded(groups);
  }

  /**
   * 获取服务加载时间统计
   */
  getLoadTimeStatistics(): {
    average: number;
    median: number;
    min: number;
    max: number;
    total: number;
  } {
    return this.lazyLoader.getLoadTimeStatistics();
  }

  /**
   * 获取服务依赖图
   */
  getDependencyGraph(): {
    nodes: Array<{ id: string; group: string; loaded: boolean }>;
    links: Array<{ source: string; target: string; type: string }>;
  } {
    return this.lazyLoader.getDependencyGraph();
  }
}