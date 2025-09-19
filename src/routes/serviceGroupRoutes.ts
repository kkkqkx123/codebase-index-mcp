import { Router } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ServiceGroupController } from '../controllers/ServiceGroupController';

/**
 * 服务分组路由
 * 提供RESTful API接口用于管理服务分组加载状态
 */
@injectable()
export class ServiceGroupRoutes {
  public router: Router;

  constructor(
    @inject(TYPES.ServiceGroupController) private controller: ServiceGroupController
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // 获取所有服务分组信息
    this.router.get('/groups', async (req, res) => {
      try {
        const result = await this.controller.getAllGroups();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 获取特定分组信息
    this.router.get('/groups/:groupName', async (req, res) => {
      try {
        const { groupName } = req.params;
        const result = await this.controller.getGroupInfo(groupName);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 预加载服务分组
    this.router.post('/groups/preload', async (req, res) => {
      try {
        const { groups } = req.body;
        if (!groups || !Array.isArray(groups)) {
          res.status(400).json({
            success: false,
            error: 'Groups array is required',
            timestamp: Date.now()
          });
          return;
        }

        const result = await this.controller.preloadGroups(groups);
        res.json(result);
        return;
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
        return;
      }
    });

    // 获取状态报告
    this.router.get('/status', async (req, res) => {
      try {
        const result = await this.controller.getStatusReport();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 获取性能统计
    this.router.get('/performance', async (req, res) => {
      try {
        const result = await this.controller.getPerformanceStats();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 获取依赖图
    this.router.get('/dependencies', async (req, res) => {
      try {
        const result = await this.controller.getDependencyGraph();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 检查服务状态
    this.router.post('/services/status', async (req, res) => {
      try {
        const { services } = req.body;
        if (!services || !Array.isArray(services)) {
          res.status(400).json({
            success: false,
            error: 'Services array is required',
            timestamp: Date.now()
          });
          return;
        }

        const result = await this.controller.checkServicesStatus(services);
        res.json(result);
        return;
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
        return;
      }
    });

    // 检查分组状态
    this.router.post('/groups/status', async (req, res) => {
      try {
        const { groups } = req.body;
        if (!groups || !Array.isArray(groups)) {
          res.status(400).json({
            success: false,
            error: 'Groups array is required',
            timestamp: Date.now()
          });
          return;
        }

        const result = await this.controller.checkGroupsStatus(groups);
        res.json(result);
        return;
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
        return;
      }
    });

    // 重置服务加载器
    this.router.post('/reset', async (req, res) => {
      try {
        const result = await this.controller.resetServiceLoader();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 获取可用分组
    this.router.get('/groups/available', async (req, res) => {
      try {
        const result = await this.controller.getAvailableGroups();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 获取已加载服务
    this.router.get('/services/loaded', async (req, res) => {
      try {
        const result = await this.controller.getLoadedServices();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });

    // 健康检查
    this.router.get('/health', async (req, res) => {
      try {
        const result = await this.controller.healthCheck();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          timestamp: Date.now()
        });
      }
    });
  }
}

export default ServiceGroupRoutes;