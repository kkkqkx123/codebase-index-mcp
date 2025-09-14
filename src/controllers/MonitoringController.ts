import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { PrometheusMetricsService } from '../services/monitoring/PrometheusMetricsService';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../services/monitoring/PerformanceAnalysisService';
import { TYPES } from '../types';

@injectable()
export class MonitoringController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private prometheusMetricsService: PrometheusMetricsService;
  private healthCheckService: HealthCheckService;
  private performanceAnalysisService: PerformanceAnalysisService;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.PrometheusMetricsService) prometheusMetricsService: PrometheusMetricsService,
    @inject(TYPES.HealthCheckService) healthCheckService: HealthCheckService,
    @inject(TYPES.PerformanceAnalysisService) performanceAnalysisService: PerformanceAnalysisService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.prometheusMetricsService = prometheusMetricsService;
    this.healthCheckService = healthCheckService;
    this.performanceAnalysisService = performanceAnalysisService;

    this.logger.info('Monitoring controller initialized');
  }

  async getHealthStatus(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.performHealthCheck();
      return {
        success: true,
        data: healthStatus
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get health status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getHealthStatus' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getMetrics(): Promise<any> {
    try {
      const metrics = await this.prometheusMetricsService.collectAllMetrics();
      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get metrics: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getMetrics' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getPerformanceReport(period?: { start: string; end: string }): Promise<any> {
    try {
      // Default to last 24 hours if no period specified
      const endDate = new Date();
      const startDate = period 
        ? new Date(period.start) 
        : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      const endDateObj = period 
        ? new Date(period.end) 
        : endDate;

      const report = await this.performanceAnalysisService.generatePerformanceReport({
        start: startDate,
        end: endDateObj
      });

      return {
        success: true,
        data: report
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get performance report: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getPerformanceReport' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBottlenecks(): Promise<any> {
    try {
      const bottlenecks = await this.performanceAnalysisService.identifyBottlenecksInRealTime();
      return {
        success: true,
        data: bottlenecks
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get bottlenecks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getBottlenecks' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getCapacityPlan(): Promise<any> {
    try {
      const capacityPlan = await this.performanceAnalysisService.generateCapacityPlan();
      return {
        success: true,
        data: capacityPlan
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get capacity plan: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getCapacityPlan' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getDependencies(): Promise<any> {
    try {
      const dependencies = await this.healthCheckService.checkDependencies();
      return {
        success: true,
        data: dependencies
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get dependencies: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getDependencies' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBenchmark(): Promise<any> {
    try {
      const benchmark = await this.performanceAnalysisService.benchmarkPerformance();
      return {
        success: true,
        data: benchmark
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get benchmark: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getBenchmark' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getMetricsEndpoint(): string {
    return this.prometheusMetricsService.getMetricsEndpoint();
  }
}