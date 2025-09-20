import 'reflect-metadata';
import { Container, ContainerModule } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigFactory } from '../config/ConfigFactory';
import { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';
import { NebulaConnectionManager } from '../database/nebula/NebulaConnectionManager';
import { NebulaSpaceManager } from '../database/nebula/NebulaSpaceManager';
import { OpenAIEmbedder } from '../embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../embedders/GeminiEmbedder';
import { MistralEmbedder } from '../embedders/MistralEmbedder';
import { SiliconFlowEmbedder } from '../embedders/SiliconFlowEmbedder';
import { Custom1Embedder } from '../embedders/Custom1Embedder';
import { Custom2Embedder } from '../embedders/Custom2Embedder';
import { Custom3Embedder } from '../embedders/Custom3Embedder';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../embedders/EmbeddingCacheService';
import { GraphDatabaseErrorHandler } from '../core/GraphDatabaseErrorHandler';
import { ErrorClassifier } from '../core/ErrorClassifier';
import { NebulaQueryBuilder } from '../database/nebula/NebulaQueryBuilder';
import { LazyServiceLoader } from './LazyServiceLoader';
import { CacheController } from '../controllers/CacheController';
import { MonitoringController } from '../controllers/MonitoringController';
import { ParserController } from '../controllers/ParserController';
import { SnippetController } from '../controllers/SnippetController';
import { NebulaService } from '../database/NebulaService';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { ProjectLookupService } from '../database/ProjectLookupService';
import { QdrantService } from '../database/QdrantService';
import { CacheManager } from '../services/cache/CacheManager';
import { HashBasedDeduplicator } from '../services/deduplication/HashBasedDeduplicator';
import { EventQueueService } from '../services/EventQueueService';
import { ChangeDetectionService } from '../services/filesystem/ChangeDetectionService';
import { FileSystemTraversal } from '../services/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../services/filesystem/FileWatcherService';
import { GraphService } from '../services/graph/GraphService';
import { IndexCoordinator } from '../services/indexing/IndexCoordinator';
import { IndexService } from '../services/indexing/IndexService';
import { LSPEnhancementPhase } from '../services/indexing/LSPEnhancementPhase';
import { AsyncPipeline } from '../services/infrastructure/AsyncPipeline';
import { ObjectPool } from '../services/infrastructure/ObjectPool';
import { LSPManager, LSPClientPool, LSPErrorHandler, LanguageServerRegistry } from '../services/lsp';
import { LSPSearchService } from '../services/lsp/LSPSearchService';
import { LSPService } from '../services/lsp/LSPService';
import { BatchPerformanceMonitor } from '../services/monitoring/BatchPerformanceMonitor';
import { BatchProcessingMetrics } from '../services/monitoring/BatchProcessingMetrics';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../services/monitoring/PerformanceAnalysisService';
import { PrometheusMetricsService } from '../services/monitoring/PrometheusMetricsService';
import { SemgrepMetricsService } from '../services/monitoring/SemgrepMetricsService';
import { AdvancedTreeSitterService } from '../services/parser/AdvancedTreeSitterService';
import { CallGraphService } from '../services/parser/CallGraphService';
import { CFGBuilder } from '../services/parser/CFGBuilder';
import { DataFlowAnalyzer } from '../services/parser/DataFlowGraph';
import { EnhancedParserService } from '../services/parser/EnhancedParserService';
import { IncrementalAnalyzer } from '../services/parser/IncrementalAnalyzer';
import { ParserService } from '../services/parser/ParserService';
import { SecurityAnalyzer } from '../services/parser/SecurityAnalyzer';
import { SemanticAnalysisService } from '../services/parser/SemanticAnalysisService';
import { SmartCodeParser } from '../services/parser/SmartCodeParser';
import { SnippetExtractionService } from '../services/parser/SnippetExtractionService';
import { SymbolTableBuilder } from '../services/parser/SymbolTableBuilder';
import EnhancedRuleFactory from '../services/parser/treesitter-rule/EnhancedRuleFactory';
import { TreeSitterCoreService } from '../services/parser/TreeSitterCoreService';
import { TreeSitterService } from '../services/parser/TreeSitterService';
import { BatchProcessor } from '../services/processing/BatchProcessor';
import { MemoryManager } from '../services/processing/MemoryManager';
import { PerformanceMonitor } from '../services/query/PerformanceMonitor';
import { QueryCache } from '../services/query/QueryCache';
import { QueryCoordinationService } from '../services/query/QueryCoordinationService';
import { QueryOptimizer } from '../services/query/QueryOptimizer';
import { ResultFormatter } from '../services/query/ResultFormatter';
import { ResultFormatterCache } from '../services/query/ResultFormatterCache';
import { ResultFormatterConfigLoader } from '../services/query/ResultFormatterConfigLoader';
import { ResultFusionEngine } from '../services/query/ResultFusionEngine';
import { RerankingService } from '../services/reranking/RerankingService';
import { HybridSearchService } from '../services/search/HybridSearchService';
import { LSPEnhancedSearchService } from '../services/search/LSPEnhancedSearchService';
import { SearchCoordinator } from '../services/search/SearchCoordinator';
import { SemanticSearchService } from '../services/search/SemanticSearchService';
import { SemanticAnalysisOrchestrator } from '../services/SemanticAnalysisOrchestrator';
import { StaticAnalysisService } from '../services/static-analysis/core/StaticAnalysisService';
import { SemgrepIntegrationService } from '../services/static-analysis/core/SemgrepIntegrationService';
import { AnalysisCoordinatorService } from '../services/static-analysis/core/AnalysisCoordinatorService';
import { ResultProcessorService } from '../services/static-analysis/processing/ResultProcessorService';
import { RuleManagerService } from '../services/static-analysis/processing/RuleManagerService';
import { EnhancementService } from '../services/static-analysis/processing/EnhancementService';
import { VectorStorageService, BatchProcessingService, EmbeddingService } from '../services/storage';
import { GraphBatchOptimizer } from '../services/storage/graph/GraphBatchOptimizer';
import { GraphCacheService } from '../services/storage/graph/GraphCacheService';
import { GraphPerformanceMonitor } from '../services/storage/graph/GraphPerformanceMonitor';
import { GraphPersistenceService } from '../services/storage/graph/GraphPersistenceService';
import { GraphPersistenceUtils } from '../services/storage/graph/GraphPersistenceUtils';
import { GraphQueryBuilder } from '../services/storage/graph/GraphQueryBuilder';
import { GraphSearchService } from '../services/storage/graph/GraphSearchService';
import { StorageCoordinator } from '../services/storage/StorageCoordinator';
import { ConsistencyChecker } from '../services/sync/ConsistencyChecker';
import { EntityIdManager } from '../services/sync/EntityIdManager';
import { EntityMappingService } from '../services/sync/EntityMappingService';
import { TransactionCoordinator } from '../services/sync/TransactionCoordinator';

const coreModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  bind(TYPES.GraphDatabaseErrorHandler).to(GraphDatabaseErrorHandler).inSingletonScope();
  bind(TYPES.ErrorClassifier).to(ErrorClassifier).inSingletonScope();
  bind(TYPES.ConfigFactory).to(ConfigFactory).inSingletonScope();
});

const databaseModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  bind(TYPES.NebulaSpaceManager).to(NebulaSpaceManager).inSingletonScope();
  bind(TYPES.QdrantClientWrapper).to(QdrantClientWrapper).inSingletonScope();
  bind(TYPES.NebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
});

const embedderModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();
  bind(TYPES.CacheManager).to(CacheManager).inSingletonScope();
  bind(TYPES.OpenAIEmbedder).to(OpenAIEmbedder).inSingletonScope();
  bind(TYPES.OllamaEmbedder).to(OllamaEmbedder).inSingletonScope();
  bind(TYPES.GeminiEmbedder).to(GeminiEmbedder).inSingletonScope();
  bind(TYPES.MistralEmbedder).to(MistralEmbedder).inSingletonScope();
  bind(TYPES.SiliconFlowEmbedder).to(SiliconFlowEmbedder).inSingletonScope();
  bind(TYPES.Custom1Embedder).to(Custom1Embedder).inSingletonScope();
  bind(TYPES.Custom2Embedder).to(Custom2Embedder).inSingletonScope();
  bind(TYPES.Custom3Embedder).to(Custom3Embedder).inSingletonScope();
  bind(TYPES.EmbedderFactory).to(EmbedderFactory).inSingletonScope();
});

const serviceModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.IndexService).to(IndexService).inSingletonScope();
  bind(TYPES.GraphService).to(GraphService).inSingletonScope();
  bind(TYPES.ParserService).to(ParserService).inSingletonScope();
  bind(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
  bind(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
  bind(TYPES.SnippetExtractionService).to(SnippetExtractionService).inSingletonScope();
  bind(TYPES.SnippetExtractionRules).toConstantValue(EnhancedRuleFactory.createAllRules());
  // Unified static analysis services
  bind(TYPES.StaticAnalysisService).to(StaticAnalysisService).inSingletonScope();
  bind(TYPES.SemgrepIntegrationService).to(SemgrepIntegrationService).inSingletonScope();
  bind(TYPES.AnalysisCoordinatorService).to(AnalysisCoordinatorService).inSingletonScope();
  bind(TYPES.ResultProcessorService).to(ResultProcessorService).inSingletonScope();
  bind(TYPES.RuleManagerService).to(RuleManagerService).inSingletonScope();
  bind(TYPES.EnhancementService).to(EnhancementService).inSingletonScope();
  
  // Deprecated static analysis services (removed)
  // bind(TYPES.SemgrepScanService).to(SemgrepScanService).inSingletonScope();
  // bind(TYPES.EnhancedSemgrepScanService).to(EnhancedSemgrepScanService).inSingletonScope();
  // bind(TYPES.SemgrepRuleAdapter).to(SemgrepRuleAdapter).inSingletonScope();
  // bind(TYPES.SemanticAnalysisService).to(SemanticAnalysisService).inSingletonScope();
  bind(TYPES.SmartCodeParser).to(SmartCodeParser).inSingletonScope();
  bind(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
  bind(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
  bind(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();
  bind(TYPES.HashBasedDeduplicator).to(HashBasedDeduplicator).inSingletonScope();
  bind(TYPES.GraphPersistenceUtils).to(GraphPersistenceUtils).inSingletonScope();
  bind(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
  bind(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
  bind(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
  bind(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
  bind(TYPES.GraphSearchService).to(GraphSearchService).inSingletonScope();

  // Infrastructure services
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

  // Additional services
  bind(TYPES.SemanticAnalysisOrchestrator).to(SemanticAnalysisOrchestrator).inSingletonScope();
  bind(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
  bind(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();

  // Tree-sitter Deep Analysis Services
  bind(TYPES.AdvancedTreeSitterService).to(AdvancedTreeSitterService).inSingletonScope();
  bind(TYPES.SymbolTableBuilder).to(SymbolTableBuilder).inSingletonScope();
  bind(TYPES.CFGBuilder).to(CFGBuilder).inSingletonScope();
  bind(TYPES.DataFlowAnalyzer).to(DataFlowAnalyzer).inSingletonScope();
  bind(TYPES.IncrementalAnalyzer).to(IncrementalAnalyzer).inSingletonScope();
  bind(TYPES.SecurityAnalyzer).to(SecurityAnalyzer).inSingletonScope();
  bind(TYPES.BatchProcessingService).to(BatchProcessingService).inSingletonScope();
  bind(TYPES.EmbeddingService).to(EmbeddingService).inSingletonScope();
  bind(TYPES.NebulaService).to(NebulaService).inSingletonScope();
  bind(TYPES.QdrantService).to(QdrantService).inSingletonScope();
});

const queueModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.EventQueueService).to(EventQueueService).inSingletonScope();
});

const syncModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.EntityIdManager).to(EntityIdManager).inSingletonScope();
  bind(TYPES.EntityMappingService).to(EntityMappingService).inSingletonScope();
  bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();
  bind(TYPES.ConsistencyChecker).to(ConsistencyChecker).inSingletonScope();
});

const monitoringModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  // Enable Prometheus metrics service
  bind(TYPES.PrometheusMetricsService).to(PrometheusMetricsService).inSingletonScope();

  // Enable services that depend on PrometheusMetricsService
  bind(TYPES.HealthCheckService).to(HealthCheckService).inSingletonScope();
  bind(TYPES.PerformanceAnalysisService).to(PerformanceAnalysisService).inSingletonScope();
  bind(TYPES.BatchProcessingMetrics).to(BatchProcessingMetrics).inSingletonScope();
  bind(TYPES.BatchPerformanceMonitor).to(BatchPerformanceMonitor).inSingletonScope();
  bind(TYPES.SemgrepMetricsService).to(SemgrepMetricsService).inSingletonScope();
  bind(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
});

const controllerModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  // Enable MonitoringController - all dependencies are now available
  bind(TYPES.MonitoringController).to(MonitoringController).inSingletonScope();
  bind(TYPES.SnippetController).to(SnippetController).inSingletonScope();
  bind(TYPES.CacheController).to(CacheController).inSingletonScope();
  bind(TYPES.ParserController).to(ParserController).inSingletonScope();

  // Processing services already bound above
});

export { TYPES, databaseModule, embedderModule, serviceModule, monitoringModule, controllerModule, queueModule, syncModule };
export class DIContainer {
  private static instance: Container | null = null;
  private static lazyLoader: LazyServiceLoader | null = null;

  // 允许测试时注入自定义的LazyServiceLoader
  static setLazyLoader(loader: LazyServiceLoader | null): void {
    DIContainer.lazyLoader = loader;
  }

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container();
      
      // 加载所有模块
      DIContainer.instance.load(
        coreModule,
        databaseModule,
        embedderModule,
        monitoringModule,
        controllerModule,
        queueModule,
        syncModule
      );
      
      // 初始化懒加载器
      DIContainer.lazyLoader = new LazyServiceLoader(DIContainer.instance);
      
      // 验证monitoringModule是否正确加载
      console.log('DIContainer: BatchProcessingMetrics bound after loading all modules:', DIContainer.instance.isBound(TYPES.BatchProcessingMetrics));
    }
    
    return DIContainer.instance;
  }

  static async get<T>(serviceIdentifier: string | symbol): Promise<T> {
    if (!DIContainer.instance) {
      // 如果实例不存在，先调用getInstance()确保正确初始化
      DIContainer.getInstance();
    }

    // 检查是否为核心服务
    const coreServices = [
      TYPES.ConfigService,
      TYPES.LoggerService,
      TYPES.ErrorHandlerService,
      TYPES.QdrantClientWrapper,
      TYPES.NebulaConnectionManager,
      TYPES.NebulaSpaceManager,
      TYPES.EmbeddingCacheService,
      TYPES.OpenAIEmbedder,
      TYPES.OllamaEmbedder,
      TYPES.GeminiEmbedder,
      TYPES.MistralEmbedder,
      TYPES.SiliconFlowEmbedder,
      TYPES.Custom1Embedder,
      TYPES.Custom2Embedder,
      TYPES.Custom3Embedder,
      TYPES.EmbedderFactory,
      TYPES.GraphDatabaseErrorHandler,
      TYPES.ErrorClassifier,
      TYPES.NebulaQueryBuilder,
      TYPES.ConfigFactory
    ];

    if (coreServices.includes(serviceIdentifier as symbol)) {
      return DIContainer.instance!.get<T>(serviceIdentifier);
    }

    // 非核心服务通过懒加载器加载
    if (!DIContainer.lazyLoader) {
      throw new Error('LazyServiceLoader not initialized');
    }

    // 设置日志服务（在核心服务加载后）
    if (serviceIdentifier === TYPES.LoggerService) {
      DIContainer.lazyLoader.setLogger(DIContainer.instance!.get(TYPES.LoggerService));
    }

    // 根据服务类型加载对应的服务，使用并发安全的加载机制
    switch (serviceIdentifier) {
      case TYPES.VectorStorageService:
        return DIContainer.lazyLoader.loadVectorStorageService() as T;
      case TYPES.GraphPersistenceService:
        return DIContainer.lazyLoader.loadGraphPersistenceService() as T;
      case TYPES.QdrantService:
        return DIContainer.lazyLoader.loadQdrantService() as T;
      case TYPES.NebulaService:
        return DIContainer.lazyLoader.loadNebulaService() as T;
      case TYPES.HttpServer:
        return DIContainer.lazyLoader.loadHttpServer(DIContainer.instance!) as T;
      case TYPES.MCPServer:
        return DIContainer.lazyLoader.loadMCPServer(DIContainer.instance!) as T;
      case TYPES.MonitoringController:
        return DIContainer.lazyLoader.loadMonitoringController() as T;
      default:
        // 对于其他服务，尝试直接从容器获取
        // 如果不存在则抛出错误
        if (DIContainer.instance!.isBound(serviceIdentifier)) {
          return DIContainer.instance!.get<T>(serviceIdentifier);
        }
        throw new Error(`Service ${String(serviceIdentifier)} not found`);
    }
  }

  static reset(): void {
    DIContainer.instance = null;
    DIContainer.lazyLoader = null;
  }

  static isServiceLoaded(serviceIdentifier: string | symbol): boolean {
    if (!DIContainer.lazyLoader) {
      return false;
    }
    return DIContainer.lazyLoader.isServiceLoaded(serviceIdentifier);
  }

  static getLoadedServices(): string[] {
    if (!DIContainer.lazyLoader) {
      return [];
    }
    return DIContainer.lazyLoader.getLoadedServices();
  }

  static getLazyLoader(): LazyServiceLoader | null {
    return DIContainer.lazyLoader;
  }
}
