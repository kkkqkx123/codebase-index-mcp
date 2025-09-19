import { Container, ContainerModule } from 'inversify';
import { Newable } from '@inversifyjs/common';
import { TYPES } from '../types';
import { LazyServiceLoader } from './LazyServiceLoader';

export class ServiceModuleLoaders {
  constructor(private loader: LazyServiceLoader) {}

  /**
   * 加载服务模块（按需加载）
   */
  async ensureServiceModuleLoaded(container: Container): Promise<void> {
    if (!container.isBound(TYPES.IndexService)) {
      const serviceModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // 按需加载服务类
        const IndexService = await this.loader.loadService('../services/indexing/IndexService', 'IndexService');
        const GraphService = await this.loader.loadService('../services/graph/GraphService', 'GraphService');
        const ParserService = await this.loader.loadService('../services/parser/ParserService', 'ParserService');
        const TreeSitterService = await this.loader.loadService('../services/parser/TreeSitterService', 'TreeSitterService');
        const TreeSitterCoreService = await this.loader.loadService('../services/parser/TreeSitterCoreService', 'TreeSitterCoreService');
        const SnippetExtractionService = await this.loader.loadService('../services/parser/SnippetExtractionService', 'SnippetExtractionService');
        const EnhancedRuleFactory = await this.loader.loadService('../services/parser/treesitter-rule/EnhancedRuleFactory', 'default');
        
        // Unified static analysis services
        const StaticAnalysisService = await this.loader.loadService('../services/static-analysis/core/StaticAnalysisService', 'StaticAnalysisService');
        const SemgrepIntegrationService = await this.loader.loadService('../services/static-analysis/core/SemgrepIntegrationService', 'SemgrepIntegrationService');
        const AnalysisCoordinatorService = await this.loader.loadService('../services/static-analysis/core/AnalysisCoordinatorService', 'AnalysisCoordinatorService');
        const ResultProcessorService = await this.loader.loadService('../services/static-analysis/processing/ResultProcessorService', 'ResultProcessorService');
        const RuleManagerService = await this.loader.loadService('../services/static-analysis/processing/RuleManagerService', 'RuleManagerService');
        const EnhancementService = await this.loader.loadService('../services/static-analysis/processing/EnhancementService', 'EnhancementService');
        
        // Other services
        const SmartCodeParser = await this.loader.loadService('../services/parser/SmartCodeParser', 'SmartCodeParser');
        const FileSystemTraversal = await this.loader.loadService('../services/filesystem/FileSystemTraversal', 'FileSystemTraversal');
        const FileWatcherService = await this.loader.loadService('../services/filesystem/FileWatcherService', 'FileWatcherService');
        const ChangeDetectionService = await this.loader.loadService('../services/filesystem/ChangeDetectionService', 'ChangeDetectionService');
        const HashBasedDeduplicator = await this.loader.loadService('../services/deduplication/HashBasedDeduplicator', 'HashBasedDeduplicator');
        const VectorStorageService = await this.loader.loadService('../services/storage/vector/VectorStorageService', 'VectorStorageService');
        const GraphPersistenceService = await this.loader.loadService('../services/storage/graph/GraphPersistenceService', 'GraphPersistenceService');
        const GraphPersistenceUtils = await this.loader.loadService('../services/storage/graph/GraphPersistenceUtils', 'GraphPersistenceUtils');
        const GraphCacheService = await this.loader.loadService('../services/storage/graph/GraphCacheService', 'GraphCacheService');
        const GraphPerformanceMonitor = await this.loader.loadService('../services/storage/graph/GraphPerformanceMonitor', 'GraphPerformanceMonitor');
        const GraphBatchOptimizer = await this.loader.loadService('../services/storage/graph/GraphBatchOptimizer', 'GraphBatchOptimizer');
        const GraphQueryBuilder = await this.loader.loadService('../services/storage/graph/GraphQueryBuilder', 'GraphQueryBuilder');
        const GraphSearchService = await this.loader.loadService('../services/storage/graph/GraphSearchService', 'GraphSearchService');
        const BatchProcessingService = await this.loader.loadService('../services/storage/BatchProcessingService', 'BatchProcessingService');
        const EmbeddingService = await this.loader.loadService('../services/storage/EmbeddingService', 'EmbeddingService');
        
        // Infrastructure services
        const AsyncPipeline = await this.loader.loadService('../services/infrastructure/AsyncPipeline', 'AsyncPipeline');
        const MemoryManager = await this.loader.loadService('../services/processing/MemoryManager', 'MemoryManager');
        const ObjectPool = await this.loader.loadService('../services/infrastructure/ObjectPool', 'ObjectPool');
        const BatchProcessor = await this.loader.loadService('../services/processing/BatchProcessor', 'BatchProcessor');
        const IndexCoordinator = await this.loader.loadService('../services/indexing/IndexCoordinator', 'IndexCoordinator');
        const StorageCoordinator = await this.loader.loadService('../services/storage/StorageCoordinator', 'StorageCoordinator');
        const SemanticSearchService = await this.loader.loadService('../services/search/SemanticSearchService', 'SemanticSearchService');
        const SearchCoordinator = await this.loader.loadService('../services/search/SearchCoordinator', 'SearchCoordinator');
        const HybridSearchService = await this.loader.loadService('../services/search/HybridSearchService', 'HybridSearchService');
        const RerankingService = await this.loader.loadService('../services/reranking/RerankingService', 'RerankingService');
        const QueryCache = await this.loader.loadService('../services/query/QueryCache', 'QueryCache');
        const QueryCoordinationService = await this.loader.loadService('../services/query/QueryCoordinationService', 'QueryCoordinationService');
        const ResultFusionEngine = await this.loader.loadService('../services/query/ResultFusionEngine', 'ResultFusionEngine');
        const QueryOptimizer = await this.loader.loadService('../services/query/QueryOptimizer', 'QueryOptimizer');
        const ResultFormatter = await this.loader.loadService('../services/query/ResultFormatter', 'ResultFormatter');
        const ResultFormatterCache = await this.loader.loadService('../services/query/ResultFormatterCache', 'ResultFormatterCache');
        const ResultFormatterConfigLoader = await this.loader.loadService('../services/query/ResultFormatterConfigLoader', 'ResultFormatterConfigLoader');
        const LSPService = await this.loader.loadService('../services/lsp/LSPService', 'LSPService');
        const LSPEnhancementPhase = await this.loader.loadService('../services/indexing/LSPEnhancementPhase', 'LSPEnhancementPhase');
        const EnhancedParserService = await this.loader.loadService('../services/parser/EnhancedParserService', 'EnhancedParserService');
        const LSPManager = await this.loader.loadService('../services/lsp/LSPManager', 'LSPManager');
        const LSPClientPool = await this.loader.loadService('../services/lsp/LSPClientPool', 'LSPClientPool');
        const LSPErrorHandler = await this.loader.loadService('../services/lsp/LSPErrorHandler', 'LSPErrorHandler');
        const LanguageServerRegistry = await this.loader.loadService('../services/lsp/LanguageServerRegistry', 'LanguageServerRegistry');
        const LSPSearchService = await this.loader.loadService('../services/lsp/LSPSearchService', 'LSPSearchService');
        const LSPEnhancedSearchService = await this.loader.loadService('../services/search/LSPEnhancedSearchService', 'LSPEnhancedSearchService');
        
        // 加载基础设施服务
        const SemanticAnalysisOrchestrator = await this.loader.loadService('../services/infrastructure/SemanticAnalysisOrchestrator', 'SemanticAnalysisOrchestrator');
        const ProjectIdManager = await this.loader.loadService('../services/core/ProjectIdManager', 'ProjectIdManager');
        const ProjectLookupService = await this.loader.loadService('../services/core/ProjectLookupService', 'ProjectLookupService');
        const AdvancedTreeSitterService = await this.loader.loadService('../services/parser/AdvancedTreeSitterService', 'AdvancedTreeSitterService');
        const SymbolTableBuilder = await this.loader.loadService('../services/analysis/SymbolTableBuilder', 'SymbolTableBuilder');
        const CFGBuilder = await this.loader.loadService('../services/analysis/CFGBuilder', 'CFGBuilder');
        const DataFlowAnalyzer = await this.loader.loadService('../services/analysis/DataFlowAnalyzer', 'DataFlowAnalyzer');
        const IncrementalAnalyzer = await this.loader.loadService('../services/analysis/IncrementalAnalyzer', 'IncrementalAnalyzer');
        const SecurityAnalyzer = await this.loader.loadService('../services/analysis/SecurityAnalyzer', 'SecurityAnalyzer');
        const EntityIdManager = await this.loader.loadService('../services/sync/EntityIdManager', 'EntityIdManager');
        const EntityMappingService = await this.loader.loadService('../services/sync/EntityMappingService', 'EntityMappingService');
        const TransactionCoordinator = await this.loader.loadService('../services/sync/TransactionCoordinator', 'TransactionCoordinator');
        const ConsistencyChecker = await this.loader.loadService('../services/sync/ConsistencyChecker', 'ConsistencyChecker');
        const EventQueueService = await this.loader.loadService('../services/infrastructure/EventQueueService', 'EventQueueService');
        
        bind(TYPES.SemanticAnalysisOrchestrator).to(SemanticAnalysisOrchestrator as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.ProjectIdManager).to(ProjectIdManager as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.ProjectLookupService).to(ProjectLookupService as unknown as Newable<unknown>).inSingletonScope();
        
        bind(TYPES.AdvancedTreeSitterService).to(AdvancedTreeSitterService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.SymbolTableBuilder).to(SymbolTableBuilder as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.CFGBuilder).to(CFGBuilder as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.DataFlowAnalyzer).to(DataFlowAnalyzer as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.IncrementalAnalyzer).to(IncrementalAnalyzer as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.SecurityAnalyzer).to(SecurityAnalyzer as unknown as Newable<unknown>).inSingletonScope();
        
        bind(TYPES.EntityIdManager).to(EntityIdManager as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.EntityMappingService).to(EntityMappingService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.TransactionCoordinator).to(TransactionCoordinator as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.ConsistencyChecker).to(ConsistencyChecker as unknown as Newable<unknown>).inSingletonScope();
        
        bind(TYPES.EventQueueService).to(EventQueueService as unknown as Newable<unknown>).inSingletonScope();
      });
      await container.load(serviceModule);
    }
  }

  /**
   * 加载控制器模块（按需加载）
   */
  async ensureControllerModuleLoaded(container: Container): Promise<void> {
    if (!container.isBound(TYPES.MonitoringController)) {
      // 先加载监控模块，因为控制器依赖于监控服务
      await this.ensureMonitoringModuleLoaded(container);
      
      const controllerModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // 按需加载控制器
        const MonitoringController = await this.loader.loadService('../controllers/MonitoringController', 'MonitoringController');
        const SnippetController = await this.loader.loadService('../controllers/SnippetController', 'SnippetController');
        const CacheController = await this.loader.loadService('../controllers/CacheController', 'CacheController');
        const ParserController = await this.loader.loadService('../controllers/ParserController', 'ParserController');
        
        bind(TYPES.MonitoringController).to(MonitoringController as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.SnippetController).to(SnippetController as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.CacheController).to(CacheController as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.ParserController).to(ParserController as unknown as Newable<unknown>).inSingletonScope();
      });
      await container.loadSync(controllerModule);
    }
  }

  /**
   * 加载监控模块（按需加载）
   */
  async ensureMonitoringModuleLoaded(container: Container): Promise<void> {
    if (!container.isBound(TYPES.BatchProcessingMetrics)) {
      // 先加载服务模块，因为监控服务依赖于一些服务
      await this.ensureServiceModuleLoaded(container);
      
      const monitoringModule = new ContainerModule(async ({ bind, unbind, isBound, rebind }) => {
        // 按需加载监控服务
        const PrometheusMetricsService = await this.loader.loadService('../services/monitoring/PrometheusMetricsService', 'PrometheusMetricsService');
        const HealthCheckService = await this.loader.loadService('../services/monitoring/HealthCheckService', 'HealthCheckService');
        const PerformanceAnalysisService = await this.loader.loadService('../services/monitoring/PerformanceAnalysisService', 'PerformanceAnalysisService');
        const BatchProcessingMetrics = await this.loader.loadService('../services/monitoring/BatchProcessingMetrics', 'BatchProcessingMetrics');
        const BatchPerformanceMonitor = await this.loader.loadService('../services/monitoring/BatchPerformanceMonitor', 'BatchPerformanceMonitor');
        const SemgrepMetricsService = await this.loader.loadService('../services/monitoring/SemgrepMetricsService', 'SemgrepMetricsService');
        const PerformanceMonitor = await this.loader.loadService('../services/query/PerformanceMonitor', 'PerformanceMonitor');
        
        bind(TYPES.PrometheusMetricsService).to(PrometheusMetricsService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.HealthCheckService).to(HealthCheckService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.PerformanceAnalysisService).to(PerformanceAnalysisService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.BatchProcessingMetrics).to(BatchProcessingMetrics as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.BatchPerformanceMonitor).to(BatchPerformanceMonitor as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.SemgrepMetricsService).to(SemgrepMetricsService as unknown as Newable<unknown>).inSingletonScope();
        bind(TYPES.PerformanceMonitor).to(PerformanceMonitor as unknown as Newable<unknown>).inSingletonScope();
      });
      await container.loadSync(monitoringModule);
    }
  }
}