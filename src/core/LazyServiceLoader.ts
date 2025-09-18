import { Container, ContainerModule } from 'inversify';
import { TYPES } from '../types';

/**
 * 懒加载服务实现类
 * 负责按需加载非核心服务，避免启动时加载所有服务
 */
export class LazyServiceLoader {
  private container: Container;
  private loadedServices: Set<string | symbol> = new Set();
  private logger: any;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * 设置日志服务（在核心服务加载后设置）
   */
  setLogger(logger: any): void {
    this.logger = logger;
  }

  /**
   * 加载服务模块
   */
  /**
   * 加载服务模块
   */
  /**
   * 加载服务模块
   */
  private loadServiceModule() {
    if (!this.container.isBound(TYPES.IndexService)) {
      const serviceModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
        // 从原始serviceModule中提取所有绑定
        bind(TYPES.IndexService).to(require('../services/indexing/IndexService').IndexService).inSingletonScope();
        bind(TYPES.GraphService).to(require('../services/graph/GraphService').GraphService).inSingletonScope();
        bind(TYPES.ParserService).to(require('../services/parser/ParserService').ParserService).inSingletonScope();
        bind(TYPES.TreeSitterService).to(require('../services/parser/TreeSitterService').TreeSitterService).inSingletonScope();
        bind(TYPES.TreeSitterCoreService).to(require('../services/parser/TreeSitterCoreService').TreeSitterCoreService).inSingletonScope();
        bind(TYPES.SnippetExtractionService).to(require('../services/parser/SnippetExtractionService').SnippetExtractionService).inSingletonScope();
        bind(TYPES.SnippetExtractionRules).toConstantValue(require('../services/parser/treesitter-rule/EnhancedRuleFactory').default.createAllRules());
        
        // Unified static analysis services
        bind(TYPES.StaticAnalysisService).to(require('../services/static-analysis/core/StaticAnalysisService').StaticAnalysisService).inSingletonScope();
        bind(TYPES.SemgrepIntegrationService).to(require('../services/static-analysis/core/SemgrepIntegrationService').SemgrepIntegrationService).inSingletonScope();
        bind(TYPES.AnalysisCoordinatorService).to(require('../services/static-analysis/core/AnalysisCoordinatorService').AnalysisCoordinatorService).inSingletonScope();
        bind(TYPES.ResultProcessorService).to(require('../services/static-analysis/processing/ResultProcessorService').ResultProcessorService).inSingletonScope();
        bind(TYPES.RuleManagerService).to(require('../services/static-analysis/processing/RuleManagerService').RuleManagerService).inSingletonScope();
        bind(TYPES.EnhancementService).to(require('../services/static-analysis/processing/EnhancementService').EnhancementService).inSingletonScope();
        
        // Other services
        bind(TYPES.SmartCodeParser).to(require('../services/parser/SmartCodeParser').SmartCodeParser).inSingletonScope();
        bind(TYPES.FileSystemTraversal).to(require('../services/filesystem/FileSystemTraversal').FileSystemTraversal).inSingletonScope();
        bind(TYPES.FileWatcherService).to(require('../services/filesystem/FileWatcherService').FileWatcherService).inSingletonScope();
        bind(TYPES.ChangeDetectionService).to(require('../services/filesystem/ChangeDetectionService').ChangeDetectionService).inSingletonScope();
        bind(TYPES.HashBasedDeduplicator).to(require('../services/deduplication/HashBasedDeduplicator').HashBasedDeduplicator).inSingletonScope();
        bind(TYPES.VectorStorageService).to(require('../services/storage/vector/VectorStorageService').VectorStorageService).inSingletonScope();
        bind(TYPES.GraphPersistenceService).to(require('../services/storage/graph/GraphPersistenceService').GraphPersistenceService).inSingletonScope();
        bind(TYPES.GraphPersistenceUtils).to(require('../services/storage/graph/GraphPersistenceUtils').GraphPersistenceUtils).inSingletonScope();
        bind(TYPES.GraphCacheService).to(require('../services/storage/graph/GraphCacheService').GraphCacheService).inSingletonScope();
        bind(TYPES.GraphPerformanceMonitor).to(require('../services/storage/graph/GraphPerformanceMonitor').GraphPerformanceMonitor).inSingletonScope();
        bind(TYPES.GraphBatchOptimizer).to(require('../services/storage/graph/GraphBatchOptimizer').GraphBatchOptimizer).inSingletonScope();
        bind(TYPES.GraphQueryBuilder).to(require('../services/storage/graph/GraphQueryBuilder').GraphQueryBuilder).inSingletonScope();
        bind(TYPES.GraphSearchService).to(require('../services/storage/graph/GraphSearchService').GraphSearchService).inSingletonScope();
        bind(TYPES.BatchProcessingService).to(require('../services/storage/BatchProcessingService').BatchProcessingService).inSingletonScope();
        bind(TYPES.EmbeddingService).to(require('../services/storage/EmbeddingService').EmbeddingService).inSingletonScope();
        
        // Infrastructure services
        bind(TYPES.AsyncPipeline).to(require('../services/infrastructure/AsyncPipeline').AsyncPipeline).inSingletonScope();
        bind(TYPES.MemoryManager).to(require('../services/processing/MemoryManager').MemoryManager).inSingletonScope();
        bind(TYPES.ObjectPool).to(require('../services/infrastructure/ObjectPool').ObjectPool).inSingletonScope();
        bind(TYPES.BatchProcessor).to(require('../services/processing/BatchProcessor').BatchProcessor).inSingletonScope();
        bind(TYPES.IndexCoordinator).to(require('../services/indexing/IndexCoordinator').IndexCoordinator).inSingletonScope();
        bind(TYPES.StorageCoordinator).to(require('../services/storage/StorageCoordinator').StorageCoordinator).inSingletonScope();
        bind(TYPES.SemanticSearchService).to(require('../services/search/SemanticSearchService').SemanticSearchService).inSingletonScope();
        bind(TYPES.SearchCoordinator).to(require('../services/search/SearchCoordinator').SearchCoordinator).inSingletonScope();
        bind(TYPES.HybridSearchService).to(require('../services/search/HybridSearchService').HybridSearchService).inSingletonScope();
        bind(TYPES.RerankingService).to(require('../services/reranking/RerankingService').RerankingService).inSingletonScope();
        bind(TYPES.QueryCache).to(require('../services/query/QueryCache').QueryCache).inSingletonScope();
        bind(TYPES.QueryCoordinationService).to(require('../services/query/QueryCoordinationService').QueryCoordinationService).inSingletonScope();
        bind(TYPES.ResultFusionEngine).to(require('../services/query/ResultFusionEngine').ResultFusionEngine).inSingletonScope();
        bind(TYPES.QueryOptimizer).to(require('../services/query/QueryOptimizer').QueryOptimizer).inSingletonScope();
        bind(TYPES.ResultFormatter).to(require('../services/query/ResultFormatter').ResultFormatter).inSingletonScope();
        bind(TYPES.ResultFormatterCache).to(require('../services/query/ResultFormatterCache').ResultFormatterCache).inSingletonScope();
        bind(TYPES.ResultFormatterConfigLoader).to(require('../services/query/ResultFormatterConfigLoader').ResultFormatterConfigLoader).inSingletonScope();
        bind(TYPES.LSPService).to(require('../services/lsp/LSPService').LSPService).inSingletonScope();
        bind(TYPES.LSPEnhancementPhase).to(require('../services/indexing/LSPEnhancementPhase').LSPEnhancementPhase).inSingletonScope();
        bind(TYPES.EnhancedParserService).to(require('../services/parser/EnhancedParserService').EnhancedParserService).inSingletonScope();
        bind(TYPES.LSPManager).to(require('../services/lsp/LSPManager').LSPManager).inSingletonScope();
        bind(TYPES.LSPClientPool).to(require('../services/lsp/LSPClientPool').LSPClientPool).inSingletonScope();
        bind(TYPES.LSPErrorHandler).to(require('../services/lsp/LSPErrorHandler').LSPErrorHandler).inSingletonScope();
        bind(TYPES.LanguageServerRegistry).toConstantValue(require('../services/lsp/LanguageServerRegistry').LanguageServerRegistry.getInstance());
        bind(TYPES.LSPSearchService).to(require('../services/lsp/LSPSearchService').LSPSearchService).inSingletonScope();
        bind(TYPES.LSPEnhancedSearchService).to(require('../services/search/LSPEnhancedSearchService').LSPEnhancedSearchService).inSingletonScope();
        
        // Additional services
        bind(TYPES.SemanticAnalysisOrchestrator).to(require('../services/SemanticAnalysisOrchestrator').SemanticAnalysisOrchestrator).inSingletonScope();
        bind(TYPES.ProjectIdManager).to(require('../database/ProjectIdManager').ProjectIdManager).inSingletonScope();
        bind(TYPES.ProjectLookupService).to(require('../database/ProjectLookupService').ProjectLookupService).inSingletonScope();
        
        // Phase 2: Tree-sitter Deep Analysis Services
        bind(TYPES.AdvancedTreeSitterService).to(require('../services/parser/AdvancedTreeSitterService').AdvancedTreeSitterService).inSingletonScope();
        bind(TYPES.SymbolTableBuilder).to(require('../services/parser/SymbolTableBuilder').SymbolTableBuilder).inSingletonScope();
        bind(TYPES.CFGBuilder).to(require('../services/parser/CFGBuilder').CFGBuilder).inSingletonScope();
        bind(TYPES.DataFlowAnalyzer).to(require('../services/parser/DataFlowGraph').DataFlowAnalyzer).inSingletonScope();
        bind(TYPES.IncrementalAnalyzer).to(require('../services/parser/IncrementalAnalyzer').IncrementalAnalyzer).inSingletonScope();
        bind(TYPES.SecurityAnalyzer).to(require('../services/parser/SecurityAnalyzer').SecurityAnalyzer).inSingletonScope();
        
        // Sync services
        bind(TYPES.EntityIdManager).to(require('../services/sync/EntityIdManager').EntityIdManager).inSingletonScope();
        bind(TYPES.EntityMappingService).to(require('../services/sync/EntityMappingService').EntityMappingService).inSingletonScope();
        bind(TYPES.TransactionCoordinator).to(require('../services/sync/TransactionCoordinator').TransactionCoordinator).inSingletonScope();
        bind(TYPES.ConsistencyChecker).to(require('../services/sync/ConsistencyChecker').ConsistencyChecker).inSingletonScope();
        
        // Queue services
        bind(TYPES.EventQueueService).to(require('../services/EventQueueService').EventQueueService).inSingletonScope();
      });
      this.container.load(serviceModule);
    }
  }

  /**
   * 加载控制器模块
   */
  private loadControllerModule() {
    if (!this.container.isBound(TYPES.MonitoringController)) {
      // 先加载监控模块，因为控制器依赖于监控服务
      this.loadMonitoringModule();
      
      const controllerModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
        // Enable MonitoringController - all dependencies are now available
        bind(TYPES.MonitoringController).to(require('../controllers/MonitoringController').MonitoringController).inSingletonScope();
        bind(TYPES.SnippetController).to(require('../controllers/SnippetController').SnippetController).inSingletonScope();
        bind(TYPES.CacheController).to(require('../controllers/CacheController').CacheController).inSingletonScope();
        bind(TYPES.ParserController).to(require('../controllers/ParserController').ParserController).inSingletonScope();
      });
      this.container.load(controllerModule);
    }
  }

  /**
   * 加载监控模块
   */
  private loadMonitoringModule() {
    if (!this.container.isBound(TYPES.BatchProcessingMetrics)) {
      // 先加载服务模块，因为监控服务依赖于一些服务
      this.loadServiceModule();
      
      const monitoringModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
        // Enable Prometheus metrics service
        bind(TYPES.PrometheusMetricsService).to(require('../services/monitoring/PrometheusMetricsService').PrometheusMetricsService).inSingletonScope();

        // Enable services that depend on PrometheusMetricsService
        bind(TYPES.HealthCheckService).to(require('../services/monitoring/HealthCheckService').HealthCheckService).inSingletonScope();
        bind(TYPES.PerformanceAnalysisService).to(require('../services/monitoring/PerformanceAnalysisService').PerformanceAnalysisService).inSingletonScope();
        bind(TYPES.BatchProcessingMetrics).to(require('../services/monitoring/BatchProcessingMetrics').BatchProcessingMetrics).inSingletonScope();
        bind(TYPES.BatchPerformanceMonitor).to(require('../services/monitoring/BatchPerformanceMonitor').BatchPerformanceMonitor).inSingletonScope();
        bind(TYPES.SemgrepMetricsService).to(require('../services/monitoring/SemgrepMetricsService').SemgrepMetricsService).inSingletonScope();
        bind(TYPES.PerformanceMonitor).to(require('../services/query/PerformanceMonitor').PerformanceMonitor).inSingletonScope();
      });
      this.container.load(monitoringModule);
    }
  }

  /**
   * 加载向量存储服务
   */
  loadVectorStorageService() {
    if (!this.container.isBound(TYPES.VectorStorageService)) {
      // 先加载服务模块和监控模块
      this.loadServiceModule();
      this.loadMonitoringModule();
      
      const { VectorStorageService } = require('../services/storage/vector/VectorStorageService');
      const qdrantClient = this.container.get(TYPES.QdrantClientWrapper);
      const loggerService = this.container.get(TYPES.LoggerService);
      const errorHandlerService = this.container.get(TYPES.ErrorHandlerService);
      const configService = this.container.get(TYPES.ConfigService);
      const batchMetrics = this.container.get(TYPES.BatchProcessingMetrics);
      const embedderFactory = this.container.get(TYPES.EmbedderFactory);
      const batchProcessingService = this.container.get(TYPES.BatchProcessingService);
      const embeddingService = this.container.get(TYPES.EmbeddingService);
      
      this.container.bind(TYPES.VectorStorageService).toDynamicValue(() => {
        return new VectorStorageService(
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
    this.recordServiceLoad(TYPES.VectorStorageService);
    return this.container.get(TYPES.VectorStorageService);
  }

  /**
   * 加载图持久化服务
   */
  loadGraphPersistenceService() {
    if (!this.container.isBound(TYPES.GraphPersistenceService)) {
      // 先加载服务模块和监控模块
      this.loadServiceModule();
      this.loadMonitoringModule();
      
      const { GraphPersistenceService } = require('../services/storage/graph/GraphPersistenceService');
      const nebulaService = this.container.get(TYPES.NebulaService);
      const nebulaSpaceManager = this.container.get(TYPES.NebulaSpaceManager);
      const loggerService = this.container.get(TYPES.LoggerService);
      const errorHandlerService = this.container.get(TYPES.ErrorHandlerService);
      const configService = this.container.get(TYPES.ConfigService);
      const batchMetrics = this.container.get(TYPES.BatchProcessingMetrics);
      const queryBuilder = this.container.get(TYPES.NebulaQueryBuilder);
      const graphErrorHandler = this.container.get(TYPES.GraphDatabaseErrorHandler);
      const persistenceUtils = this.container.get(TYPES.GraphPersistenceUtils);
      const cacheService = this.container.get(TYPES.GraphCacheService);
      const performanceMonitor = this.container.get(TYPES.GraphPerformanceMonitor);
      const batchOptimizer = this.container.get(TYPES.GraphBatchOptimizer);
      const enhancedQueryBuilder = this.container.get(TYPES.GraphQueryBuilder);
      const searchService = this.container.get(TYPES.GraphSearchService);
      
      this.container.bind(TYPES.GraphPersistenceService).toDynamicValue(() => {
        return new GraphPersistenceService(
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
    this.recordServiceLoad(TYPES.GraphPersistenceService);
    return this.container.get(TYPES.GraphPersistenceService);
  }

  /**
   * 加载Qdrant服务
   */
  loadQdrantService() {
    if (!this.container.isBound(TYPES.QdrantService)) {
      const { QdrantService } = require('../database/QdrantService');
      const configService = this.container.get(TYPES.ConfigService);
      const loggerService = this.container.get(TYPES.LoggerService);
      const errorHandlerService = this.container.get(TYPES.ErrorHandlerService);
      const qdrantClient = this.container.get(TYPES.QdrantClientWrapper);
      
      this.container.bind(TYPES.QdrantService).toDynamicValue(() => {
        return new QdrantService(
          configService,
          loggerService,
          errorHandlerService,
          qdrantClient
        );
      }).inSingletonScope();
    }
    this.recordServiceLoad(TYPES.QdrantService);
    return this.container.get(TYPES.QdrantService);
  }

  /**
   * 加载Nebula服务
   */
  loadNebulaService() {
    if (!this.container.isBound(TYPES.NebulaService)) {
      const { NebulaService } = require('../database/NebulaService');
      const loggerService = this.container.get(TYPES.LoggerService);
      const errorHandlerService = this.container.get(TYPES.ErrorHandlerService);
      const nebulaConnection = this.container.get(TYPES.NebulaConnectionManager);
      
      this.container.bind(TYPES.NebulaService).toDynamicValue(() => {
        return new NebulaService(
          loggerService,
          errorHandlerService,
          nebulaConnection
        );
      }).inSingletonScope();
    }
    this.recordServiceLoad(TYPES.NebulaService);
    return this.container.get(TYPES.NebulaService);
  }

  /**
   * 加载HTTP服务器
   */
  loadHttpServer() {
    if (!this.container.isBound(TYPES.HttpServer)) {
      // 先加载控制器模块
      this.loadControllerModule();
      
      const { HttpServer } = require('../api/HttpServer');
      
      this.container.bind(TYPES.HttpServer).toDynamicValue(() => {
        return new HttpServer();
      }).inSingletonScope();
    }
    this.recordServiceLoad(TYPES.HttpServer);
    return this.container.get(TYPES.HttpServer);
  }

  /**
   * 加载MCP服务器
   */
  loadMCPServer() {
    if (!this.container.isBound(TYPES.MCPServer)) {
      // 先加载服务模块，确保IndexService和GraphService可用
      this.loadServiceModule();
      
      const { MCPServer } = require('../mcp/MCPServer');
      
      this.container.bind(TYPES.MCPServer).toDynamicValue(context => {
        const loggerService = context.get(TYPES.LoggerService);
        const indexService = context.get(TYPES.IndexService);
        const graphService = context.get(TYPES.GraphService);
        
        return new MCPServer(
          loggerService,
          indexService,
          graphService
        );
      }).inSingletonScope();
    }
    this.recordServiceLoad(TYPES.MCPServer);
    return this.container.get(TYPES.MCPServer);
  }

  /**
   * 获取服务加载状态
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
   * 记录服务加载
   */
  recordServiceLoad(serviceIdentifier: string | symbol): void {
    this.loadedServices.add(serviceIdentifier);
    if (this.logger) {
      this.logger.info(`Lazy service loaded: ${String(serviceIdentifier)}`);
    }
  }
}