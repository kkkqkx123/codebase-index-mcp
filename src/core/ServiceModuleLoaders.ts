import { Container, ContainerModule } from 'inversify';
import { Newable } from '@inversifyjs/common';
import { TYPES } from '../types';
import { LazyServiceLoader } from './LazyServiceLoader';

// Import the modules from DIContainer
import { serviceModule, monitoringModule, controllerModule, queueModule, syncModule } from './DIContainer';

export class ServiceModuleLoaders {
  constructor(private loader: LazyServiceLoader) {}

  private serviceModuleLoaded = false;
  private monitoringModuleLoaded = false;
  private controllerModuleLoaded = false;
  private loadingMonitoringModule: Promise<void> | null = null;

  /**
   * 加载服务模块（按需加载）
   */
  async ensureServiceModuleLoaded(container: Container): Promise<void> {
    if (this.serviceModuleLoaded) {
      return;
    }
    
    // Load the service module from DIContainer
    await container.load(serviceModule);
    
    // Record all services from the service module as loaded
    this.loader.recordServiceLoad(TYPES.BatchProcessingService);
    this.loader.recordServiceLoad(TYPES.EmbeddingService);
    this.loader.recordServiceLoad(TYPES.VectorStorageService);
    this.loader.recordServiceLoad(TYPES.GraphPersistenceService);
    this.loader.recordServiceLoad(TYPES.QdrantService);
    this.loader.recordServiceLoad(TYPES.NebulaService);
    this.loader.recordServiceLoad(TYPES.GraphPersistenceUtils);
    this.loader.recordServiceLoad(TYPES.IndexService);
    this.loader.recordServiceLoad(TYPES.SnippetExtractionRules);
    this.loader.recordServiceLoad(TYPES.StaticAnalysisService);
    this.loader.recordServiceLoad(TYPES.SemgrepIntegrationService);
    this.loader.recordServiceLoad(TYPES.AnalysisCoordinatorService);
    this.loader.recordServiceLoad(TYPES.ResultProcessorService);
    this.loader.recordServiceLoad(TYPES.RuleManagerService);
    this.loader.recordServiceLoad(TYPES.EnhancementService);
    this.loader.recordServiceLoad(TYPES.SmartCodeParser);
    this.loader.recordServiceLoad(TYPES.FileSystemTraversal);
    this.loader.recordServiceLoad(TYPES.FileWatcherService);
    this.loader.recordServiceLoad(TYPES.ChangeDetectionService);
    this.loader.recordServiceLoad(TYPES.HashBasedDeduplicator);
    this.loader.recordServiceLoad(TYPES.GraphCacheService);
    this.loader.recordServiceLoad(TYPES.GraphPerformanceMonitor);
    this.loader.recordServiceLoad(TYPES.GraphBatchOptimizer);
    this.loader.recordServiceLoad(TYPES.GraphQueryBuilder);
    this.loader.recordServiceLoad(TYPES.GraphSearchService);
    
    this.serviceModuleLoaded = true;
  }

  /**
   * 加载控制器模块（按需加载）
   */
  async ensureControllerModuleLoaded(container: Container): Promise<void> {
    if (this.controllerModuleLoaded) {
      return;
    }
    
    // Load the controller module from DIContainer
    await container.load(controllerModule);
    
    // Record all services from the controller module as loaded
    this.loader.recordServiceLoad(TYPES.MonitoringController);
    this.loader.recordServiceLoad(TYPES.SnippetController);
    this.loader.recordServiceLoad(TYPES.CacheController);
    this.loader.recordServiceLoad(TYPES.ParserController);
    this.loader.recordServiceLoad(TYPES.ServiceGroupController);
    
    this.controllerModuleLoaded = true;
  }

  /**
   * 加载监控模块（按需加载）
   */
  async ensureMonitoringModuleLoaded(container: Container): Promise<void> {
    // 首先检查是否已经加载
    if (this.monitoringModuleLoaded || container.isBound(TYPES.BatchProcessingMetrics)) {
      console.log('Monitoring module already loaded');
      return;
    }
    
    // 检查是否已经有加载中的Promise
    if (this.loadingMonitoringModule) {
      console.log('Monitoring module is being loaded, waiting for completion');
      return this.loadingMonitoringModule;
    }
    
    // 创建新的加载Promise
    const loadingPromise = this.loadMonitoringModuleInternal(container);
    this.loadingMonitoringModule = loadingPromise;
    
    try {
      await loadingPromise;
      this.monitoringModuleLoaded = true;
    } finally {
      // 清理加载状态
      this.loadingMonitoringModule = null;
    }
  }
  
  /**
   * 内部监控模块加载方法
   */
  private async loadMonitoringModuleInternal(container: Container): Promise<void> {
    console.log(`[loadMonitoringModuleInternal] Starting load, BatchProcessingMetrics bound: ${container.isBound(TYPES.BatchProcessingMetrics)}`);
    
    if (!container.isBound(TYPES.BatchProcessingMetrics)) {
      console.log(`[loadMonitoringModuleInternal] Binding BatchProcessingMetrics...`);
      // 加载监控模块
      await container.load(monitoringModule);
      
      // 记录所有监控服务为已加载
      this.loader.recordServiceLoad(TYPES.BatchProcessingMetrics);
      this.loader.recordServiceLoad(TYPES.LoggerService);
      this.loader.recordServiceLoad(TYPES.ErrorHandlerService);
      
      console.log('Monitoring module loaded successfully');
    } else {
      console.log(`[loadMonitoringModuleInternal] BatchProcessingMetrics already bound, skipping module load`);
    }
    
    this.monitoringModuleLoaded = true;
    console.log(`[loadMonitoringModuleInternal] Monitoring module load completed`);
  }
}