import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { MonitoringController } from '../../controllers/MonitoringController';

export class MonitoringRoutes {
  private router: Router;
  private monitoringController: MonitoringController | null = null;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private getMonitoringController(): MonitoringController {
    if (!this.monitoringController) {
      const container = DIContainer.getInstance();
      this.monitoringController = container.get<MonitoringController>(TYPES.MonitoringController);
    }
    return this.monitoringController;
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/monitoring/health
     * @desc Get system health status
     * @returns {object} 200 - Health status
     */
    this.router.get('/health', this.getHealthStatus.bind(this));

    /**
     * @route GET /api/v1/monitoring/metrics
     * @desc Get system metrics
     * @returns {object} 200 - Metrics data
     */
    this.router.get('/metrics', this.getMetrics.bind(this));

    /**
     * @route GET /api/v1/monitoring/performance
     * @desc Get performance report
     * @param {string} start.query - Start date (ISO format)
     * @param {string} end.query - End date (ISO format)
     * @returns {object} 200 - Performance report
     */
    this.router.get('/performance', this.getPerformanceReport.bind(this));

    /**
     * @route GET /api/v1/monitoring/bottlenecks
     * @desc Get system bottlenecks
     * @returns {object} 200 - Bottlenecks data
     */
    this.router.get('/bottlenecks', this.getBottlenecks.bind(this));

    /**
     * @route GET /api/v1/monitoring/capacity
     * @desc Get capacity plan
     * @returns {object} 200 - Capacity plan
     */
    this.router.get('/capacity', this.getCapacityPlan.bind(this));

    /**
     * @route GET /api/v1/monitoring/dependencies
     * @desc Get system dependencies
     * @returns {object} 200 - Dependencies data
     */
    this.router.get('/dependencies', this.getDependencies.bind(this));

    /**
     * @route GET /api/v1/monitoring/benchmark
     * @desc Get benchmark results
     * @returns {object} 200 - Benchmark data
     */
    this.router.get('/benchmark', this.getBenchmark.bind(this));

    /**
     * @route GET /api/v1/monitoring/project-stats
     * @desc Get project statistics (total projects, active projects, total files, storage used)
     * @returns {object} 200 - Project statistics
     */
    this.router.get('/project-stats', this.getProjectStats.bind(this));
  }

  private async getHealthStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getHealthStatus();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getMetrics();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  }

  private async getPerformanceReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { start, end } = req.query;
      const period = start && end ? { start: start as string, end: end as string } : undefined;
      const result = await this.getMonitoringController().getPerformanceReport(period);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getBottlenecks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getBottlenecks();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getCapacityPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getCapacityPlan();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getDependencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getDependencies();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getBenchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getBenchmark();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getProjectStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getMonitoringController().getProjectStats();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
