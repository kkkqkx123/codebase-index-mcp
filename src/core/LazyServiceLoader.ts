import { Container, ContainerModule } from 'inversify';
import { Newable } from '@inversifyjs/common';
import { TYPES } from '../types';
import { 
  SERVICE_GROUPS, 
  SERVICE_DEPENDENCIES, 
  SERVICE_GROUP_MAPPING,
  ServiceGroup 
} from './ServiceGroupDefinitions';
import { ServiceModuleLoaders } from './ServiceModuleLoaders';
import { IndividualServiceLoaders } from './IndividualServiceLoaders';

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
 * 懒加载服务实现类
 * 负责按需加载非核心服务，避免启动时加载所有服务
 */
export class LazyServiceLoader {
  private container: Container;
  private loadedServices: Set<string | symbol> = new Set();
  private loadedModules = new Map<string, Promise<any>>();
  private logger: any;
  private moduleLoaders: ServiceModuleLoaders;
  private individualLoaders: IndividualServiceLoaders;
  
  // 新增：服务分组加载状态跟踪
  private loadedGroups: Set<string> = new Set();
  private serviceLoadTimes: Map<string | symbol, number> = new Map();
  private serviceDependencies: Map<string | symbol, Set<string | symbol>> = new Map();

  constructor(container: Container) {
    this.container = container;
    this.moduleLoaders = new ServiceModuleLoaders(this);
    this.individualLoaders = new IndividualServiceLoaders(this);
  }

  /**
   * 设置日志服务（在核心服务加载后设置）
   */
  setLogger(logger: any): void {
    this.logger = logger;
  }

  /**
   * 通用服务加载方法
   */
  async loadService<T>(modulePath: string, exportName: string): Promise<T> {
    if (!this.loadedModules.has(modulePath)) {
      this.loadedModules.set(modulePath, import(modulePath));
    }
    const module = await this.loadedModules.get(modulePath);
    return module[exportName] as T;
  }

  /**
   * 加载服务模块（按需加载）
   */
  private async ensureServiceModuleLoaded(): Promise<void> {
    await this.moduleLoaders.ensureServiceModuleLoaded(this.container);
  }

  /**
   * 加载控制器模块（按需加载）
   */
  private async ensureControllerModuleLoaded(): Promise<void> {
    await this.moduleLoaders.ensureControllerModuleLoaded(this.container);
  }

  /**
   * 加载监控模块（按需加载）
   */
  private async ensureMonitoringModuleLoaded(): Promise<void> {
    await this.moduleLoaders.ensureMonitoringModuleLoaded(this.container);
  }

  // 具体服务加载方法委托给IndividualServiceLoaders

  /**
   * 加载向量存储服务
   */
  async loadVectorStorageService() {
    return this.individualLoaders.loadVectorStorageService(this.container);
  }

  /**
   * 加载图持久化服务
   */
  async loadGraphPersistenceService() {
    return this.individualLoaders.loadGraphPersistenceService(this.container);
  }

  /**
   * 加载Qdrant服务
   */
  async loadQdrantService() {
    return this.individualLoaders.loadQdrantService(this.container);
  }

  /**
   * 加载Nebula服务
   */
  async loadNebulaService() {
    return this.individualLoaders.loadNebulaService(this.container);
  }

  /**
   * 加载HTTP服务器
   */
  async loadHttpServer() {
    return this.individualLoaders.loadHttpServer(this.container);
  }

  /**
   * 加载MCP服务器
   */
  async loadMCPServer() {
    return this.individualLoaders.loadMCPServer(this.container);
  }

  /**
   * 记录服务加载时间
   */
  recordServiceLoad(serviceId: string | symbol): void {
    this.serviceLoadTimes.set(serviceId, Date.now());
    this.loadedServices.add(serviceId);
    
    // 记录服务所属的分组
    const group = SERVICE_GROUP_MAPPING[String(serviceId)];
    if (group) {
      this.loadedGroups.add(group);
    }
    
    if (this.logger) {
      this.logger.info(`Lazy service loaded: ${String(serviceId)}`);
    }
  }

  /**
   * 检查分组是否已加载
   */
  isGroupLoaded(group: string): boolean {
    return this.loadedGroups.has(group);
  }

  /**
   * 获取服务所属分组
   */
  getServiceGroup(serviceIdentifier: string | symbol): string | undefined {
    return SERVICE_GROUP_MAPPING[String(serviceIdentifier)];
  }

  /**
   * 获取服务的依赖关系
   */
  getServiceDependencies(serviceIdentifier: string | symbol): string[] {
    const group = this.getServiceGroup(serviceIdentifier);
    return group ? SERVICE_DEPENDENCIES[group] || [] : [];
  }

  /**
   * 检查服务依赖是否满足
   */
  checkServiceDependencies(serviceIdentifier: string | symbol): boolean {
    const dependencies = this.getServiceDependencies(serviceIdentifier);
    return dependencies.every(dep => this.isGroupLoaded(dep));
  }

  /**
   * 获取已加载的服务分组列表
   */
  getLoadedGroups(): string[] {
    return Array.from(this.loadedGroups);
  }

  /**
   * 获取服务加载时间
   */
  getServiceLoadTime(serviceIdentifier: string | symbol): number | undefined {
    return this.serviceLoadTimes.get(serviceIdentifier);
  }

  /**
   * 获取服务加载统计信息
   */
  getServiceLoadStats(): { total: number; byGroup: Record<string, number> } {
    const byGroup: Record<string, number> = {};
    
    for (const service of this.loadedServices) {
      const group = this.getServiceGroup(service);
      if (group) {
        byGroup[group] = (byGroup[group] || 0) + 1;
      }
    }
    
    return {
      total: this.loadedServices.size,
      byGroup
    };
  }

  /**
   * 检查服务是否已加载
   */
  isServiceLoaded(serviceIdentifier: string | symbol): boolean {
    return this.loadedServices.has(serviceIdentifier);
  }

  /**
   * 获取已加载的服务列表
   */
  getLoadedServices(): string[] {
    return Array.from(this.loadedServices).map(key => String(key));
  }

  /**
   * 加载服务分组
   */
  async loadServiceGroup(group: string): Promise<void> {
    if (this.loadedGroups.has(group)) {
      if (this.logger) {
        this.logger.info(`Service group ${group} is already loaded`);
      }
      return;
    }

    // 检查并加载依赖分组
    const dependencies = SERVICE_DEPENDENCIES[group] || [];
    for (const depGroup of dependencies) {
      if (!this.isGroupLoaded(depGroup)) {
        await this.loadServiceGroup(depGroup);
      }
    }

    // 加载当前分组
    await this.loadGroupServices(group);
    
    if (this.logger) {
      this.logger.info(`Service group ${group} loaded successfully`);
    }
  }

  /**
   * 加载特定分组的服务
   */
  private async loadGroupServices(group: string): Promise<void> {
    const servicesToLoad = Object.entries(SERVICE_GROUP_MAPPING)
      .filter(([_, serviceGroup]) => serviceGroup === group)
      .map(([serviceIdentifier]) => serviceIdentifier);

    if (servicesToLoad.length === 0) {
      if (this.logger) {
        this.logger.warn(`No services found for group: ${group}`);
      }
      return;
    }

    // 根据分组类型选择不同的加载策略
    switch (group) {
      case SERVICE_GROUPS.CORE:
        // 核心服务应该在启动时已加载
        break;
      case SERVICE_GROUPS.PARSER:
      case SERVICE_GROUPS.STATIC_ANALYSIS:
      case SERVICE_GROUPS.STORAGE:
      case SERVICE_GROUPS.SEARCH:
      case SERVICE_GROUPS.LSP:
      case SERVICE_GROUPS.MONITORING:
      case SERVICE_GROUPS.INFRASTRUCTURE:
      case SERVICE_GROUPS.ADVANCED_PARSER:
      case SERVICE_GROUPS.SYNC:
        await this.ensureServiceModuleLoaded();
        break;
      case SERVICE_GROUPS.CONTROLLERS:
        await this.ensureControllerModuleLoaded();
        break;
      case SERVICE_GROUPS.SERVER:
        // 服务器服务需要特殊处理
        await this.loadServerServices();
        break;
      default:
        if (this.logger) {
          this.logger.warn(`Unknown service group: ${group}`);
        }
        break;
    }

    // 标记分组为已加载
    this.loadedGroups.add(group);
  }

  /**
   * 加载服务器相关服务
   */
  private async loadServerServices(): Promise<void> {
    // 确保基础服务已加载
    await this.ensureServiceModuleLoaded();
    
    // 加载HTTP服务器
    if (!this.container.isBound(TYPES.HttpServer)) {
      await this.loadHttpServer();
    }
    
    // 加载MCP服务器
    if (!this.container.isBound(TYPES.MCPServer)) {
      await this.loadMCPServer();
    }
  }

  /**
   * 按服务标识符加载服务（兼容现有接口）
   */
  async loadServiceByIdentifier(serviceIdentifier: string | symbol): Promise<any> {
    const group = this.getServiceGroup(serviceIdentifier);
    if (!group) {
      throw new Error(`Unknown service identifier: ${String(serviceIdentifier)}`);
    }

    // 加载服务分组
    await this.loadServiceGroup(group);

    // 返回服务实例
    return this.container.get(serviceIdentifier);
  }

  /**
   * 批量加载多个服务
   */
  async loadServices(serviceIdentifiers: (string | symbol)[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const identifier of serviceIdentifiers) {
      try {
        const service = await this.loadServiceByIdentifier(identifier);
        results.push(service);
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Failed to load service ${String(identifier)}:`, error);
        }
        throw error;
      }
    }
    
    return results;
  }

  /**
   * 卸载服务分组（可选实现）
   */
  async unloadServiceGroup(group: string): Promise<void> {
    if (!this.isGroupLoaded(group)) {
      return;
    }

    // 这里可以实现服务卸载逻辑
    // 注意：由于Inversify的限制，完全卸载服务可能比较复杂
    
    this.loadedGroups.delete(group);
    
    if (this.logger) {
      this.logger.info(`Service group ${group} unloaded`);
    }
  }

  /**
   * 获取服务加载性能统计
   */
  getPerformanceStats(): Array<{service: string; loadTime: number; group: string}> {
    const stats: Array<{service: string; loadTime: number; group: string}> = [];
    
    for (const [service, loadTime] of this.serviceLoadTimes.entries()) {
      const group = this.getServiceGroup(service);
      stats.push({
        service: String(service),
        loadTime: loadTime,
        group: group || 'unknown'
      });
    }
    
    return stats.sort((a, b) => a.loadTime - b.loadTime);
  }

  /**
   * 获取所有可用的服务分组
   */
  getAllServiceGroups(): string[] {
    return Object.values(SERVICE_GROUPS);
  }

  /**
   * 获取分组的详细信息
   */
  getGroupInfo(group: string): { name: string; dependencies: string[]; services: string[] } | null {
    if (!Object.values(SERVICE_GROUPS).includes(group as any)) {
      return null;
    }

    const services = Object.entries(SERVICE_GROUP_MAPPING)
      .filter(([_, serviceGroup]) => serviceGroup === group)
      .map(([serviceIdentifier]) => serviceIdentifier);

    return {
      name: group,
      dependencies: SERVICE_DEPENDENCIES[group] || [],
      services
    };
  }

  /**
   * 获取所有分组的详细信息
   */
  getAllGroupsInfo(): Record<string, { name: string; dependencies: string[]; services: string[]; loaded: boolean }> {
    const result: Record<string, { name: string; dependencies: string[]; services: string[]; loaded: boolean }> = {};
    
    for (const group of Object.values(SERVICE_GROUPS)) {
      const info = this.getGroupInfo(group);
      if (info) {
        result[group] = {
          ...info,
          loaded: this.isGroupLoaded(group)
        };
      }
    }
    
    return result;
  }

  /**
   * 预加载多个服务分组
   */
  async preloadGroups(groups: string[]): Promise<void> {
    const uniqueGroups = [...new Set(groups)];
    
    for (const group of uniqueGroups) {
      if (!Object.values(SERVICE_GROUPS).includes(group as any)) {
        if (this.logger) {
          this.logger.warn(`Unknown service group: ${group}`);
        }
        continue;
      }
      
      try {
        await this.loadServiceGroup(group);
      } catch (error) {
        if (this.logger) {
          this.logger.error(`Failed to preload group ${group}:`, error);
        }
        throw error;
      }
    }
  }

  /**
   * 获取服务加载状态报告
   */
  getStatusReport(): {
    totalServices: number;
    loadedServices: number;
    loadedGroups: string[];
    pendingGroups: string[];
    performanceStats: Array<{service: string; loadTime: number; group: string}>;
  } {
    const allServices = Object.keys(SERVICE_GROUP_MAPPING).length;
    const loadedServices = this.loadedServices.size;
    const loadedGroups = this.getLoadedGroups();
    const pendingGroups = Object.values(SERVICE_GROUPS).filter(group => !this.isGroupLoaded(group));
    const performanceStats = this.getPerformanceStats();

    return {
      totalServices: allServices,
      loadedServices,
      loadedGroups,
      pendingGroups,
      performanceStats
    };
  }

  /**
   * 重置服务加载状态（用于测试）
   */
  reset(): void {
    this.loadedServices.clear();
    this.loadedGroups.clear();
    this.serviceLoadTimes.clear();
    this.serviceDependencies.clear();
    
    if (this.logger) {
      this.logger.info('LazyServiceLoader reset');
    }
  }

  /**
   * 获取服务依赖图
   */
  getDependencyGraph(): {
    nodes: Array<{ id: string; group: string; loaded: boolean }>;
    links: Array<{ source: string; target: string; type: string }>;
  } {
    const nodes: Array<{ id: string; group: string; loaded: boolean }> = [];
    const links: Array<{ source: string; target: string; type: string }> = [];

    // 添加分组节点
    for (const group of Object.values(SERVICE_GROUPS)) {
      nodes.push({
        id: group,
        group,
        loaded: this.isGroupLoaded(group)
      });
    }

    // 添加服务节点
    for (const [serviceId, group] of Object.entries(SERVICE_GROUP_MAPPING)) {
      nodes.push({
        id: serviceId,
        group,
        loaded: this.isServiceLoaded(serviceId)
      });

      // 添加服务到分组的链接
      links.push({
        source: serviceId,
        target: group,
        type: 'belongs_to'
      });
    }

    // 添加分组依赖链接
    for (const [group, dependencies] of Object.entries(SERVICE_DEPENDENCIES)) {
      for (const dep of dependencies) {
        links.push({
          source: group,
          target: dep,
          type: 'depends_on'
        });
      }
    }

    return { nodes, links };
  }

  /**
   * 批量检查服务是否已加载
   */
  areServicesLoaded(serviceIdentifiers: (string | symbol)[]): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    
    for (const identifier of serviceIdentifiers) {
      result[String(identifier)] = this.isServiceLoaded(identifier);
    }
    
    return result;
  }

  /**
   * 批量检查分组是否已加载
   */
  areGroupsLoaded(groups: string[]): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    
    for (const group of groups) {
      result[group] = this.isGroupLoaded(group);
    }
    
    return result;
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
    const loadTimes = Array.from(this.serviceLoadTimes.values());
    
    if (loadTimes.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        total: 0
      };
    }

    const sortedTimes = [...loadTimes].sort((a, b) => a - b);
    const total = sortedTimes.reduce((sum, time) => sum + time, 0);
    const average = total / sortedTimes.length;
    const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const min = sortedTimes[0];
    const max = sortedTimes[sortedTimes.length - 1];

    return {
      average,
      median,
      min,
      max,
      total
    };
  }
}