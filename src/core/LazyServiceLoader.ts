import { Container, ContainerModule } from 'inversify';
import { TYPES } from '../types';

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
  private async loadServiceModule() {
    if (!this.container.isBound(TYPES.IndexService)) {
      const serviceModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // 从原始serviceModule中提取所有绑定
        const { IndexService } = await import('../services/indexing/IndexService');
        const { GraphService } = await import('../services/graph/GraphService');
        const { ParserService } = await import('../services/parser/ParserService');
        const { TreeSitterService } = await import('../services/parser/TreeSitterService');
        const { TreeSitterCoreService } = await import('../services/parser/TreeSitterCoreService');
        const { SnippetExtractionService } = await import('../services/parser/SnippetExtractionService');
        const { default: EnhancedRuleFactory } = await import('../services/parser/treesitter-rule/EnhancedRuleFactory');
        
        // Unified static analysis services
        const { StaticAnalysisService } = await import('../services/static-analysis/core/StaticAnalysisService');
        const { SemgrepIntegrationService } = await import('../services/static-analysis/core/SemgrepIntegrationService');
        const { AnalysisCoordinatorService } = await import('../services/static-analysis/core/AnalysisCoordinatorService');
        const { ResultProcessorService } = await import('../services/static-analysis/processing/ResultProcessorService');
        const { RuleManagerService } = await import('../services/static-analysis/processing/RuleManagerService');
        const { EnhancementService } = await import('../services/static-analysis/processing/EnhancementService');
        
        // Other services
        const { SmartCodeParser } = await import('../services/parser/SmartCodeParser');
        const { FileSystemTraversal } = await import('../services/filesystem/FileSystemTraversal');
        const { FileWatcherService } = await import('../services/filesystem/FileWatcherService');
        const { ChangeDetectionService } = await import('../services/filesystem/ChangeDetectionService');
        const { HashBasedDeduplicator } = await import('../services/deduplication/HashBasedDeduplicator');
        const { VectorStorageService } = await import('../services/storage/vector/VectorStorageService');
        const { GraphPersistenceService } = await import('../services/storage/graph/GraphPersistenceService');
        const { GraphPersistenceUtils } = await import('../services/storage/graph/GraphPersistenceUtils');
        const { GraphCacheService } = await import('../services/storage/graph/GraphCacheService');
        const { GraphPerformanceMonitor } = await import('../services/storage/graph/GraphPerformanceMonitor');
        const { GraphBatchOptimizer } = await import('../services/storage/graph/GraphBatchOptimizer');
        const { GraphQueryBuilder } = await import('../services/storage/graph/GraphQueryBuilder');
        const { GraphSearchService } = await import('../services/storage/graph/GraphSearchService');
        const { BatchProcessingService } = await import('../services/storage/BatchProcessingService');
        const { EmbeddingService } = await import('../services/storage/EmbeddingService');
        
        // Infrastructure services
        const { AsyncPipeline } = await import('../services/infrastructure/AsyncPipeline');
        const { MemoryManager } = await import('../services/processing/MemoryManager');
        const { ObjectPool } = await import('../services/infrastructure/ObjectPool');
        const { BatchProcessor } = await import('../services/processing/BatchProcessor');
        const { IndexCoordinator } = await import('../services/indexing/IndexCoordinator');
        const { StorageCoordinator } = await import('../services/storage/StorageCoordinator');
        const { SemanticSearchService } = await import('../services/search/SemanticSearchService');
        const { SearchCoordinator } = await import('../services/search/SearchCoordinator');
        const { HybridSearchService } = await import('../services/search/HybridSearchService');
        const { RerankingService } = await import('../services/reranking/RerankingService');
        const { QueryCache } = await import('../services/query/QueryCache');
        const { QueryCoordinationService } = await import('../services/query/QueryCoordinationService');
        const { ResultFusionEngine } = await import('../services/query/ResultFusionEngine');
        const { QueryOptimizer } = await import('../services/query/QueryOptimizer');
        const { ResultFormatter } = await import('../services/query/ResultFormatter');
        const { ResultFormatterCache } = await import('../services/query/ResultFormatterCache');
        const { ResultFormatterConfigLoader } = await import('../services/query/ResultFormatterConfigLoader');
        const { LSPService } = await import('../services/lsp/LSPService');
        const { LSPEnhancementPhase } = await import('../services/indexing/LSPEnhancementPhase');
        const { EnhancedParserService } = await import('../services/parser/EnhancedParserService');
        const { LSPManager } = await import('../services/lsp/LSPManager');
        const { LSPClientPool } = await import('../services/lsp/LSPClientPool');
        const { LSPErrorHandler } = await import('../services/lsp/LSPErrorHandler');
        const { LanguageServerRegistry } = await import('../services/lsp/LanguageServerRegistry');
        const { LSPSearchService } = await import('../services/lsp/LSPSearchService');
        const { LSPEnhancedSearchService } = await import('../services/search/LSPEnhancedSearchService');
        
        // Additional services
        const { SemanticAnalysisOrchestrator } = await import('../services/SemanticAnalysisOrchestrator');
        const { ProjectIdManager } = await import('../database/ProjectIdManager');
        const { ProjectLookupService } = await import('../database/ProjectLookupService');
        
        // Phase 2: Tree-sitter Deep Analysis Services
        const { AdvancedTreeSitterService } = await import('../services/parser/AdvancedTreeSitterService');
        const { SymbolTableBuilder } = await import('../services/parser/SymbolTableBuilder');
        const { CFGBuilder } = await import('../services/parser/CFGBuilder');
        const { DataFlowAnalyzer } = await import('../services/parser/DataFlowGraph');
        const { IncrementalAnalyzer } = await import('../services/parser/IncrementalAnalyzer');
        const { SecurityAnalyzer } = await import('../services/parser/SecurityAnalyzer');
        
        // Sync services
        const { EntityIdManager } = await import('../services/sync/EntityIdManager');
        const { EntityMappingService } = await import('../services/sync/EntityMappingService');
        const { TransactionCoordinator } = await import('../services/sync/TransactionCoordinator');
        const { ConsistencyChecker } = await import('../services/sync/ConsistencyChecker');
        
        // Queue services
        const { EventQueueService } = await import('../services/EventQueueService');

        // 绑定所有服务
        bind(TYPES.IndexService).to(IndexService).inSingletonScope();
        bind(TYPES.GraphService).to(GraphService).inSingletonScope();
        bind(TYPES.ParserService).to(ParserService).inSingletonScope();
        bind(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
        bind(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
        bind(TYPES.SnippetExtractionService).to(SnippetExtractionService).inSingletonScope();
        bind(TYPES.SnippetExtractionRules).toConstantValue(EnhancedRuleFactory.createAllRules());
        
        bind(TYPES.StaticAnalysisService).to(StaticAnalysisService).inSingletonScope();
        bind(TYPES.SemgrepIntegrationService).to(SemgrepIntegrationService).inSingletonScope();
        bind(TYPES.AnalysisCoordinatorService).to(AnalysisCoordinatorService).inSingletonScope();
        bind(TYPES.ResultProcessorService).to(ResultProcessorService).inSingletonScope();
        bind(TYPES.RuleManagerService).to(RuleManagerService).inSingletonScope();
        bind(TYPES.EnhancementService).to(EnhancementService).inSingletonScope();
        
        bind(TYPES.SmartCodeParser).to(SmartCodeParser).inSingletonScope();
        bind(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
        bind(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
        bind(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();
        bind(TYPES.HashBasedDeduplicator).to(HashBasedDeduplicator).inSingletonScope();
        bind(TYPES.VectorStorageService).to(VectorStorageService).inSingletonScope();
        bind(TYPES.GraphPersistenceService).to(GraphPersistenceService).inSingletonScope();
        bind(TYPES.GraphPersistenceUtils).to(GraphPersistenceUtils).inSingletonScope();
        bind(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
        bind(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
        bind(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
        bind(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
        bind(TYPES.GraphSearchService).to(GraphSearchService).inSingletonScope();
        bind(TYPES.BatchProcessingService).to(BatchProcessingService).inSingletonScope();
        bind(TYPES.EmbeddingService).to(EmbeddingService).inSingletonScope();
        
        bind(TYPES.AsyncPipeline).to(AsyncPipeline).inSingletonScope();
        bind(TYPES.MemoryManager).to(MemoryManager).inSingletonScope();
        bind(TYPES.ObjectPool).to(ObjectPool).inSingletonScope();
        bind(TYPES.BatchProcessor).to(BatchProcessor).inSingletonScope();
        bind(TYPES.IndexCoordinator).to(IndexCoordinator).inSingletonScope();
        bind(TYPES.StorageCoordinator).to(StorageCoordinator).inSingletonScope();
        bind(TYPES.SemanticSearchService).to(SemanticSearchService).inSingletonScope();
        bind(TYPES.SearchCoordinator).to(SearchCoordinator).inSingletonScope();
        bind(TYPES.HybridSearchService).to(HybridSearchService).inSingletonScope();
        bind(TYPES.RerankingService).to(RerankingService).inSingletonScope();
        bind(TYPES.QueryCache).to(QueryCache).inSingletonScope();
        bind(TYPES.QueryCoordinationService).to(QueryCoordinationService).inSingletonScope();
        bind(TYPES.ResultFusionEngine).to(ResultFusionEngine).inSingletonScope();
        bind(TYPES.QueryOptimizer).to(QueryOptimizer).inSingletonScope();
        bind(TYPES.ResultFormatter).to(ResultFormatter).inSingletonScope();
        bind(TYPES.ResultFormatterCache).to(ResultFormatterCache).inSingletonScope();
        bind(TYPES.ResultFormatterConfigLoader).to(ResultFormatterConfigLoader).inSingletonScope();
        bind(TYPES.LSPService).to(LSPService).inSingletonScope();
        bind(TYPES.LSPEnhancementPhase).to(LSPEnhancementPhase).inSingletonScope();
        bind(TYPES.EnhancedParserService).to(EnhancedParserService).inSingletonScope();
        bind(TYPES.LSPManager).to(LSPManager).inSingletonScope();
        bind(TYPES.LSPClientPool).to(LSPClientPool).inSingletonScope();
        bind(TYPES.LSPErrorHandler).to(LSPErrorHandler).inSingletonScope();
        bind(TYPES.LanguageServerRegistry).toConstantValue(LanguageServerRegistry.getInstance());
        bind(TYPES.LSPSearchService).to(LSPSearchService).inSingletonScope();
        bind(TYPES.LSPEnhancedSearchService).to(LSPEnhancedSearchService).inSingletonScope();
        
        bind(TYPES.SemanticAnalysisOrchestrator).to(SemanticAnalysisOrchestrator).inSingletonScope();
        bind(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
        bind(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();
        
        bind(TYPES.AdvancedTreeSitterService).to(AdvancedTreeSitterService).inSingletonScope();
        bind(TYPES.SymbolTableBuilder).to(SymbolTableBuilder).inSingletonScope();
        bind(TYPES.CFGBuilder).to(CFGBuilder).inSingletonScope();
        bind(TYPES.DataFlowAnalyzer).to(DataFlowAnalyzer).inSingletonScope();
        bind(TYPES.IncrementalAnalyzer).to(IncrementalAnalyzer).inSingletonScope();
        bind(TYPES.SecurityAnalyzer).to(SecurityAnalyzer).inSingletonScope();
        
        bind(TYPES.EntityIdManager).to(EntityIdManager).inSingletonScope();
        bind(TYPES.EntityMappingService).to(EntityMappingService).inSingletonScope();
        bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();
        bind(TYPES.ConsistencyChecker).to(ConsistencyChecker).inSingletonScope();
        
        bind(TYPES.EventQueueService).to(EventQueueService).inSingletonScope();
      });
      await this.container.load(serviceModule);
    }
  }

  /**
   * 加载控制器模块
   */
  private async loadControllerModule() {
    if (!this.container.isBound(TYPES.MonitoringController)) {
      // 先加载监控模块，因为控制器依赖于监控服务
      await this.loadMonitoringModule();
      
      const controllerModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // Enable MonitoringController - all dependencies are now available
        const { MonitoringController } = await import('../controllers/MonitoringController');
        const { SnippetController } = await import('../controllers/SnippetController');
        const { CacheController } = await import('../controllers/CacheController');
        const { ParserController } = await import('../controllers/ParserController');
        
        bind(TYPES.MonitoringController).to(MonitoringController).inSingletonScope();
        bind(TYPES.SnippetController).to(SnippetController).inSingletonScope();
        bind(TYPES.CacheController).to(CacheController).inSingletonScope();
        bind(TYPES.ParserController).to(ParserController).inSingletonScope();
      });
      await this.container.loadSync(controllerModule);
    }
  }

  /**
   * 加载监控模块
   */
  private async loadMonitoringModule() {
    if (!this.container.isBound(TYPES.BatchProcessingMetrics)) {
      // 先加载服务模块，因为监控服务依赖于一些服务
      await this.loadServiceModule();
      
      const monitoringModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // Enable Prometheus metrics service
        const { PrometheusMetricsService } = await import('../services/monitoring/PrometheusMetricsService');

        // Enable services that depend on PrometheusMetricsService
        const { HealthCheckService } = await import('../services/monitoring/HealthCheckService');
        const { PerformanceAnalysisService } = await import('../services/monitoring/PerformanceAnalysisService');
        const { BatchProcessingMetrics } = await import('../services/monitoring/BatchProcessingMetrics');
        const { BatchPerformanceMonitor } = await import('../services/monitoring/BatchPerformanceMonitor');
        const { SemgrepMetricsService } = await import('../services/monitoring/SemgrepMetricsService');
        const { PerformanceMonitor } = await import('../services/query/PerformanceMonitor');
        
        bind(TYPES.PrometheusMetricsService).to(PrometheusMetricsService).inSingletonScope();
        bind(TYPES.HealthCheckService).to(HealthCheckService).inSingletonScope();
        bind(TYPES.PerformanceAnalysisService).to(PerformanceAnalysisService).inSingletonScope();
        bind(TYPES.BatchProcessingMetrics).to(BatchProcessingMetrics).inSingletonScope();
        bind(TYPES.BatchPerformanceMonitor).to(BatchPerformanceMonitor).inSingletonScope();
        bind(TYPES.SemgrepMetricsService).to(SemgrepMetricsService).inSingletonScope();
        bind(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
      });
      await this.container.loadSync(monitoringModule);
    }
  }

  /**
   * 加载向量存储服务
   */
  async loadVectorStorageService() {
    if (!this.container.isBound(TYPES.VectorStorageService)) {
      // 先加载服务模块和监控模块
      await this.loadServiceModule();
      await this.loadMonitoringModule();
      
      const { VectorStorageService } = await import('../services/storage/vector/VectorStorageService');
      const qdrantClient = this.container.get<QdrantClientWrapper>(TYPES.QdrantClientWrapper);
      const loggerService = this.container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = this.container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const configService = this.container.get<ConfigService>(TYPES.ConfigService);
      const batchMetrics = this.container.get<BatchProcessingMetrics>(TYPES.BatchProcessingMetrics);
      const embedderFactory = this.container.get<EmbedderFactory>(TYPES.EmbedderFactory);
      const batchProcessingService = this.container.get<BatchProcessingService>(TYPES.BatchProcessingService);
      const embeddingService = this.container.get<EmbeddingService>(TYPES.EmbeddingService);
      
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
  async loadGraphPersistenceService() {
    if (!this.container.isBound(TYPES.GraphPersistenceService)) {
      // 先加载服务模块和监控模块
      await this.loadServiceModule();
      await this.loadMonitoringModule();
      
      const { GraphPersistenceService } = await import('../services/storage/graph/GraphPersistenceService');
      const nebulaService = this.container.get<NebulaService>(TYPES.NebulaService);
      const nebulaSpaceManager = this.container.get<NebulaSpaceManager>(TYPES.NebulaSpaceManager);
      const loggerService = this.container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = this.container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const configService = this.container.get<ConfigService>(TYPES.ConfigService);
      const batchMetrics = this.container.get<BatchProcessingMetrics>(TYPES.BatchProcessingMetrics);
      const queryBuilder = this.container.get<NebulaQueryBuilder>(TYPES.NebulaQueryBuilder);
      const graphErrorHandler = this.container.get<GraphDatabaseErrorHandler>(TYPES.GraphDatabaseErrorHandler);
      const persistenceUtils = this.container.get<GraphPersistenceUtils>(TYPES.GraphPersistenceUtils);
      const cacheService = this.container.get<GraphCacheService>(TYPES.GraphCacheService);
      const performanceMonitor = this.container.get<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor);
      const batchOptimizer = this.container.get<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer);
      const enhancedQueryBuilder = this.container.get<GraphQueryBuilder>(TYPES.GraphQueryBuilder);
      const searchService = this.container.get<GraphSearchService>(TYPES.GraphSearchService);
      
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
  async loadQdrantService() {
    if (!this.container.isBound(TYPES.QdrantService)) {
      const { QdrantService } = await import('../database/QdrantService');
      const configService = this.container.get<ConfigService>(TYPES.ConfigService);
      const loggerService = this.container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = this.container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const qdrantClient = this.container.get<QdrantClientWrapper>(TYPES.QdrantClientWrapper);
      
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
  async loadNebulaService() {
    if (!this.container.isBound(TYPES.NebulaService)) {
      const { NebulaService } = await import('../database/NebulaService');
      const loggerService = this.container.get<LoggerService>(TYPES.LoggerService);
      const errorHandlerService = this.container.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const nebulaConnection = this.container.get<NebulaConnectionManager>(TYPES.NebulaConnectionManager);
      
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
  async loadHttpServer() {
    if (!this.container.isBound(TYPES.HttpServer)) {
      // 先加载控制器模块
      await this.loadControllerModule();
      
      const { HttpServer } = await import('../api/HttpServer');
      
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
  async loadMCPServer() {
    if (!this.container.isBound(TYPES.MCPServer)) {
      // 先加载服务模块，确保IndexService和GraphService可用
      await this.loadServiceModule();
      
      const { MCPServer } = await import('../mcp/MCPServer');
      const loggerService = this.container.get<LoggerService>(TYPES.LoggerService);
      const indexService = this.container.get<IndexService>(TYPES.IndexService);
      const graphService = this.container.get<GraphService>(TYPES.GraphService);
      
      this.container.bind(TYPES.MCPServer).toDynamicValue(context => {
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