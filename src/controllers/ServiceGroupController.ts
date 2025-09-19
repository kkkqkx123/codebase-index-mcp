import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { LazyServiceLoader } from '../core/LazyServiceLoader';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';

/**
 * 服务分组控制器
 * 提供对服务分组加载状态的查询和控制接口
 */
@injectable()
export class ServiceGroupController {
  constructor(
    @inject(TYPES.LazyServiceLoader) private lazyServiceLoader: LazyServiceLoader,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  /**
   * 获取所有服务分组信息
   */
  async getAllGroups() {
    try {
      const groupsInfo = this.lazyServiceLoader.getAllGroupsInfo();
      return {
        success: true,
        data: groupsInfo,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get all groups:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getAllGroups',
        metadata: { service: 'getAllGroupsInfo' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取特定分组的详细信息
   */
  async getGroupInfo(groupName: string) {
    try {
      const groupInfo = this.lazyServiceLoader.getGroupInfo(groupName);
      if (!groupInfo) {
        return {
          success: false,
          error: `Group '${groupName}' not found`,
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        data: groupInfo,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Failed to get group info for ${groupName}:`, error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getGroupInfo',
        input: { groupName },
        metadata: { service: 'getGroupInfo' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 预加载服务分组
   */
  async preloadGroups(groups: string[]) {
    try {
      await this.lazyServiceLoader.preloadGroups(groups);
      
      return {
        success: true,
        message: `Successfully preloaded groups: ${groups.join(', ')}`,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to preload groups:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'preloadGroups',
        input: { groups },
        metadata: { service: 'preloadGroups' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取服务加载状态报告
   */
  async getStatusReport() {
    try {
      const status = this.lazyServiceLoader.getStatusReport();
      
      return {
        success: true,
        data: status,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get status report:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getStatusReport',
        metadata: { service: 'getStatusReport' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取服务加载性能统计
   */
  async getPerformanceStats() {
    try {
      const stats = this.lazyServiceLoader.getPerformanceStats();
      const timeStats = this.lazyServiceLoader.getLoadTimeStatistics();
      
      return {
        success: true,
        data: {
          individualStats: stats,
          summaryStats: timeStats
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get performance stats:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getPerformanceStats',
        metadata: { service: 'getPerformanceStats' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取服务依赖图
   */
  async getDependencyGraph() {
    try {
      const graph = this.lazyServiceLoader.getDependencyGraph();
      
      return {
        success: true,
        data: graph,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get dependency graph:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getDependencyGraph',
        metadata: { service: 'getDependencyGraph' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 批量检查服务加载状态
   */
  async checkServicesStatus(serviceIdentifiers: string[]) {
    try {
      const status = this.lazyServiceLoader.areServicesLoaded(serviceIdentifiers);
      
      return {
        success: true,
        data: status,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to check services status:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'checkServicesStatus',
        input: { serviceIdentifiers },
        metadata: { service: 'areServicesLoaded' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 批量检查分组加载状态
   */
  async checkGroupsStatus(groups: string[]) {
    try {
      const status = this.lazyServiceLoader.areGroupsLoaded(groups);
      
      return {
        success: true,
        data: status,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to check groups status:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'checkGroupsStatus',
        input: { groups },
        metadata: { service: 'areGroupsLoaded' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 重置服务加载状态（用于测试和调试）
   */
  async resetServiceLoader() {
    try {
      this.lazyServiceLoader.reset();
      
      return {
        success: true,
        message: 'Service loader reset successfully',
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to reset service loader:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'resetServiceLoader',
        metadata: { service: 'reset' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取所有可用的服务分组名称
   */
  async getAvailableGroups() {
    try {
      const groups = this.lazyServiceLoader.getAllServiceGroups();
      
      return {
        success: true,
        data: groups,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get available groups:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getAvailableGroups',
        metadata: { service: 'getAllServiceGroups' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 获取已加载的服务列表
   */
  async getLoadedServices() {
    try {
      const services = this.lazyServiceLoader.getLoadedServices();
      const stats = this.lazyServiceLoader.getServiceLoadStats();
      
      return {
        success: true,
        data: {
          services,
          statistics: stats
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get loaded services:', error);
      const errorReport = this.errorHandler.handleError(error as Error, {
        component: 'ServiceGroupController',
        operation: 'getLoadedServices',
        metadata: { service: 'getLoadedServices' }
      });
      return {
        success: false,
        error: errorReport.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 健康检查端点
   */
  async healthCheck() {
    try {
      const status = this.lazyServiceLoader.getStatusReport();
      const isHealthy = status.loadedServices > 0; // 至少有一个服务已加载
      
      return {
        success: true,
        data: {
          healthy: isHealthy,
          status: 'Service loader is operational',
          details: status
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        success: false,
        error: 'Service loader health check failed',
        timestamp: Date.now()
      };
    }
  }
}

export default ServiceGroupController;