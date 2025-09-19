import { Container, ContainerModule } from 'inversify';
import { Newable } from '@inversifyjs/common';
import { TYPES } from '../types';
import { LazyServiceLoader } from './LazyServiceLoader';

export class ServiceModuleLoaders {
  constructor(private loader: LazyServiceLoader) {}

  private serviceModuleLoaded = false;

  /**
   * 加载服务模块（按需加载）
   */
  async ensureServiceModuleLoaded(container: Container): Promise<void> {
    if (this.serviceModuleLoaded) {
      return;
    }

    try {
      // 使用具体的服务加载方法，而不是通用的loadService
      await this.loader.loadVectorStorageService();
      await this.loader.loadGraphPersistenceService();
      await this.loader.loadQdrantService();
      await this.loader.loadNebulaService();
      
      // 加载其他核心服务
      const coreServicesModule = new ContainerModule(async ({ bind }) => {
        try {
          const IndexService = await this.loader.loadService('../services/indexing/IndexService', 'IndexService');
          const GraphService = await this.loader.loadService('../services/graph/GraphService', 'GraphService');
          const ParserService = await this.loader.loadService('../services/parser/ParserService', 'ParserService');
          const TreeSitterService = await this.loader.loadService('../services/parser/TreeSitterService', 'TreeSitterService');
          const TreeSitterCoreService = await this.loader.loadService('../services/parser/TreeSitterCoreService', 'TreeSitterCoreService');
          const SnippetExtractionService = await this.loader.loadService('../services/parser/SnippetExtractionService', 'SnippetExtractionService');
          
          bind(TYPES.IndexService).to(IndexService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphService).to(GraphService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ParserService).to(ParserService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.TreeSitterService).to(TreeSitterService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.TreeSitterCoreService).to(TreeSitterCoreService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.SnippetExtractionService).to(SnippetExtractionService as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.IndexService);
          this.loader.recordServiceLoad(TYPES.GraphService);
          this.loader.recordServiceLoad(TYPES.ParserService);
          this.loader.recordServiceLoad(TYPES.TreeSitterService);
          this.loader.recordServiceLoad(TYPES.TreeSitterCoreService);
          this.loader.recordServiceLoad(TYPES.SnippetExtractionService);
        } catch (error) {
          throw error;
        }
      });
      
      await container.load(coreServicesModule);
      
      // 使用多个小的ContainerModule来支持部分加载失败
      const modules: ContainerModule[] = [];
      
      // 核心服务模块
      const coreModule = new ContainerModule(async ({ bind }) => {
        try {
          const IndexService = await this.loader.loadService('../services/indexing/IndexService', 'IndexService');
          bind(TYPES.IndexService).to(IndexService as unknown as Newable<unknown>).inSingletonScope();
          this.loader.recordServiceLoad(TYPES.IndexService);
        } catch (error) {
          // 记录错误但继续加载其他服务
          throw error;
        }
      });
      modules.push(coreModule);
      
      // 图服务模块 - 已使用loadGraphPersistenceService加载，跳过重复加载
      const graphModule = new ContainerModule(async ({ bind }) => {
        try {
          // GraphService 已在 loadGraphPersistenceService 中加载
          this.loader.recordServiceLoad(TYPES.GraphService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(graphModule);
      
      // 解析器服务模块
      const parserModule = new ContainerModule(async ({ bind }) => {
        try {
          const ParserService = await this.loader.loadService('../services/parser/ParserService', 'ParserService');
          const TreeSitterService = await this.loader.loadService('../services/parser/TreeSitterService', 'TreeSitterService');
          const TreeSitterCoreService = await this.loader.loadService('../services/parser/TreeSitterCoreService', 'TreeSitterCoreService');
          const SnippetExtractionService = await this.loader.loadService('../services/parser/SnippetExtractionService', 'SnippetExtractionService');
          
          bind(TYPES.ParserService).to(ParserService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.TreeSitterService).to(TreeSitterService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.TreeSitterCoreService).to(TreeSitterCoreService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.SnippetExtractionService).to(SnippetExtractionService as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.ParserService);
          this.loader.recordServiceLoad(TYPES.TreeSitterService);
          this.loader.recordServiceLoad(TYPES.TreeSitterCoreService);
          this.loader.recordServiceLoad(TYPES.SnippetExtractionService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(parserModule);
      
      // 静态分析服务模块
      const staticAnalysisModule = new ContainerModule(async ({ bind }) => {
        try {
          const StaticAnalysisService = await this.loader.loadService('../services/static-analysis/core/StaticAnalysisService', 'StaticAnalysisService');
          const SemgrepIntegrationService = await this.loader.loadService('../services/static-analysis/core/SemgrepIntegrationService', 'SemgrepIntegrationService');
          const AnalysisCoordinatorService = await this.loader.loadService('../services/static-analysis/core/AnalysisCoordinatorService', 'AnalysisCoordinatorService');
          const ResultProcessorService = await this.loader.loadService('../services/static-analysis/processing/ResultProcessorService', 'ResultProcessorService');
          const RuleManagerService = await this.loader.loadService('../services/static-analysis/processing/RuleManagerService', 'RuleManagerService');
          const EnhancementService = await this.loader.loadService('../services/static-analysis/processing/EnhancementService', 'EnhancementService');
          
          bind(TYPES.StaticAnalysisService).to(StaticAnalysisService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.SemgrepIntegrationService).to(SemgrepIntegrationService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.AnalysisCoordinatorService).to(AnalysisCoordinatorService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ResultProcessorService).to(ResultProcessorService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.RuleManagerService).to(RuleManagerService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.EnhancementService).to(EnhancementService as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.StaticAnalysisService);
          this.loader.recordServiceLoad(TYPES.SemgrepIntegrationService);
          this.loader.recordServiceLoad(TYPES.AnalysisCoordinatorService);
          this.loader.recordServiceLoad(TYPES.ResultProcessorService);
          this.loader.recordServiceLoad(TYPES.RuleManagerService);
          this.loader.recordServiceLoad(TYPES.EnhancementService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(staticAnalysisModule);
      
      // 其他服务模块
      const otherServicesModule = new ContainerModule(async ({ bind }) => {
        try {
          const SmartCodeParser = await this.loader.loadService('../services/parser/SmartCodeParser', 'SmartCodeParser');
          const FileSystemTraversal = await this.loader.loadService('../services/filesystem/FileSystemTraversal', 'FileSystemTraversal');
          const FileWatcherService = await this.loader.loadService('../services/filesystem/FileWatcherService', 'FileWatcherService');
          const ChangeDetectionService = await this.loader.loadService('../services/filesystem/ChangeDetectionService', 'ChangeDetectionService');
          const HashBasedDeduplicator = await this.loader.loadService('../services/deduplication/HashBasedDeduplicator', 'HashBasedDeduplicator');
          
          bind(TYPES.SmartCodeParser).to(SmartCodeParser as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.FileSystemTraversal).to(FileSystemTraversal as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.FileWatcherService).to(FileWatcherService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ChangeDetectionService).to(ChangeDetectionService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.HashBasedDeduplicator).to(HashBasedDeduplicator as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.SmartCodeParser);
          this.loader.recordServiceLoad(TYPES.FileSystemTraversal);
          this.loader.recordServiceLoad(TYPES.FileWatcherService);
          this.loader.recordServiceLoad(TYPES.ChangeDetectionService);
          this.loader.recordServiceLoad(TYPES.HashBasedDeduplicator);
        } catch (error) {
          throw error;
        }
      });
      modules.push(otherServicesModule);
      
      // 存储服务模块
      const storageModule = new ContainerModule(async ({ bind }) => {
        try {
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
          
          bind(TYPES.VectorStorageService).to(VectorStorageService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphPersistenceService).to(GraphPersistenceService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphPersistenceUtils).to(GraphPersistenceUtils as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphCacheService).to(GraphCacheService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphQueryBuilder).to(GraphQueryBuilder as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.GraphSearchService).to(GraphSearchService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.BatchProcessingService).to(BatchProcessingService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.EmbeddingService).to(EmbeddingService as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.VectorStorageService);
          this.loader.recordServiceLoad(TYPES.GraphPersistenceService);
          this.loader.recordServiceLoad(TYPES.GraphPersistenceUtils);
          this.loader.recordServiceLoad(TYPES.GraphCacheService);
          this.loader.recordServiceLoad(TYPES.GraphPerformanceMonitor);
          this.loader.recordServiceLoad(TYPES.GraphBatchOptimizer);
          this.loader.recordServiceLoad(TYPES.GraphQueryBuilder);
          this.loader.recordServiceLoad(TYPES.GraphSearchService);
          this.loader.recordServiceLoad(TYPES.BatchProcessingService);
          this.loader.recordServiceLoad(TYPES.EmbeddingService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(storageModule);
      
      // 基础设施服务模块
      const infrastructureModule = new ContainerModule(async ({ bind }) => {
        try {
          const AsyncPipeline = await this.loader.loadService('../services/infrastructure/AsyncPipeline', 'AsyncPipeline');
          const MemoryManager = await this.loader.loadService('../services/processing/MemoryManager', 'MemoryManager');
          const ObjectPool = await this.loader.loadService('../services/infrastructure/ObjectPool', 'ObjectPool');
          const BatchProcessor = await this.loader.loadService('../services/processing/BatchProcessor', 'BatchProcessor');
          const IndexCoordinator = await this.loader.loadService('../services/indexing/IndexCoordinator', 'IndexCoordinator');
          const StorageCoordinator = await this.loader.loadService('../services/storage/StorageCoordinator', 'StorageCoordinator');
          
          bind(TYPES.AsyncPipeline).to(AsyncPipeline as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.MemoryManager).to(MemoryManager as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ObjectPool).to(ObjectPool as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.BatchProcessor).to(BatchProcessor as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.IndexCoordinator).to(IndexCoordinator as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.StorageCoordinator).to(StorageCoordinator as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.AsyncPipeline);
          this.loader.recordServiceLoad(TYPES.MemoryManager);
          this.loader.recordServiceLoad(TYPES.ObjectPool);
          this.loader.recordServiceLoad(TYPES.BatchProcessor);
          this.loader.recordServiceLoad(TYPES.IndexCoordinator);
          this.loader.recordServiceLoad(TYPES.StorageCoordinator);
        } catch (error) {
          throw error;
        }
      });
      modules.push(infrastructureModule);
      
      // 搜索和查询服务模块
      const searchModule = new ContainerModule(async ({ bind }) => {
        try {
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
          
          bind(TYPES.SemanticSearchService).to(SemanticSearchService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.SearchCoordinator).to(SearchCoordinator as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.HybridSearchService).to(HybridSearchService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.RerankingService).to(RerankingService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.QueryCache).to(QueryCache as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.QueryCoordinationService).to(QueryCoordinationService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ResultFusionEngine).to(ResultFusionEngine as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.QueryOptimizer).to(QueryOptimizer as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ResultFormatter).to(ResultFormatter as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ResultFormatterCache).to(ResultFormatterCache as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.ResultFormatterConfigLoader).to(ResultFormatterConfigLoader as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.SemanticSearchService);
          this.loader.recordServiceLoad(TYPES.SearchCoordinator);
          this.loader.recordServiceLoad(TYPES.HybridSearchService);
          this.loader.recordServiceLoad(TYPES.RerankingService);
          this.loader.recordServiceLoad(TYPES.QueryCache);
          this.loader.recordServiceLoad(TYPES.QueryCoordinationService);
          this.loader.recordServiceLoad(TYPES.ResultFusionEngine);
          this.loader.recordServiceLoad(TYPES.QueryOptimizer);
          this.loader.recordServiceLoad(TYPES.ResultFormatter);
          this.loader.recordServiceLoad(TYPES.ResultFormatterCache);
          this.loader.recordServiceLoad(TYPES.ResultFormatterConfigLoader);
        } catch (error) {
          throw error;
        }
      });
      modules.push(searchModule);
      
      // LSP服务模块
      const lspModule = new ContainerModule(async ({ bind }) => {
        try {
          const LSPService = await this.loader.loadService('../services/lsp/LSPService', 'LSPService');
          const LSPEnhancementPhase = await this.loader.loadService('../services/indexing/LSPEnhancementPhase', 'LSPEnhancementPhase');
          const EnhancedParserService = await this.loader.loadService('../services/parser/EnhancedParserService', 'EnhancedParserService');
          const LSPManager = await this.loader.loadService('../services/lsp/LSPManager', 'LSPManager');
          const LSPClientPool = await this.loader.loadService('../services/lsp/LSPClientPool', 'LSPClientPool');
          const LSPErrorHandler = await this.loader.loadService('../services/lsp/LSPErrorHandler', 'LSPErrorHandler');
          const LanguageServerRegistry = await this.loader.loadService('../services/lsp/LanguageServerRegistry', 'LanguageServerRegistry');
          const LSPSearchService = await this.loader.loadService('../services/lsp/LSPSearchService', 'LSPSearchService');
          const LSPEnhancedSearchService = await this.loader.loadService('../services/search/LSPEnhancedSearchService', 'LSPEnhancedSearchService');
          
          bind(TYPES.LSPService).to(LSPService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPEnhancementPhase).to(LSPEnhancementPhase as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.EnhancedParserService).to(EnhancedParserService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPManager).to(LSPManager as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPClientPool).to(LSPClientPool as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPErrorHandler).to(LSPErrorHandler as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LanguageServerRegistry).to(LanguageServerRegistry as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPSearchService).to(LSPSearchService as unknown as Newable<unknown>).inSingletonScope();
          bind(TYPES.LSPEnhancedSearchService).to(LSPEnhancedSearchService as unknown as Newable<unknown>).inSingletonScope();
          
          this.loader.recordServiceLoad(TYPES.LSPService);
          this.loader.recordServiceLoad(TYPES.LSPEnhancementPhase);
          this.loader.recordServiceLoad(TYPES.EnhancedParserService);
          this.loader.recordServiceLoad(TYPES.LSPManager);
          this.loader.recordServiceLoad(TYPES.LSPClientPool);
          this.loader.recordServiceLoad(TYPES.LSPErrorHandler);
          this.loader.recordServiceLoad(TYPES.LanguageServerRegistry);
          this.loader.recordServiceLoad(TYPES.LSPSearchService);
          this.loader.recordServiceLoad(TYPES.LSPEnhancedSearchService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(lspModule);
      
      // 基础设施服务模块（剩余部分）
      const infrastructureAdvancedModule = new ContainerModule(async ({ bind }) => {
        try {
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
          
          this.loader.recordServiceLoad(TYPES.SemanticAnalysisOrchestrator);
          this.loader.recordServiceLoad(TYPES.ProjectIdManager);
          this.loader.recordServiceLoad(TYPES.ProjectLookupService);
          this.loader.recordServiceLoad(TYPES.AdvancedTreeSitterService);
          this.loader.recordServiceLoad(TYPES.SymbolTableBuilder);
          this.loader.recordServiceLoad(TYPES.CFGBuilder);
          this.loader.recordServiceLoad(TYPES.DataFlowAnalyzer);
          this.loader.recordServiceLoad(TYPES.IncrementalAnalyzer);
          this.loader.recordServiceLoad(TYPES.SecurityAnalyzer);
          this.loader.recordServiceLoad(TYPES.EntityIdManager);
          this.loader.recordServiceLoad(TYPES.EntityMappingService);
          this.loader.recordServiceLoad(TYPES.TransactionCoordinator);
          this.loader.recordServiceLoad(TYPES.ConsistencyChecker);
          this.loader.recordServiceLoad(TYPES.EventQueueService);
        } catch (error) {
          throw error;
        }
      });
      modules.push(infrastructureAdvancedModule);
      
      // Load all modules
      for (const module of modules) {
        await container.load(module);
      }
      
      this.serviceModuleLoaded = true;
    } catch (error) {
      throw error;
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
      await container.load(controllerModule);
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
      await container.load(monitoringModule);
    }
  }
}