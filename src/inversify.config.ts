import 'reflect-metadata';
import { Container } from 'inversify';
import { ConfigService } from './config/ConfigService';
import { ConfigFactory } from './config/ConfigFactory';
import { LoggerService } from './core/LoggerService';
import { ErrorHandlerService } from './core/ErrorHandlerService';
import { HashUtils } from './utils/HashUtils';
import { PathUtils } from './utils/PathUtils';
import { ChangeDetectionService, ChangeDetectionOptions } from './services/filesystem/ChangeDetectionService';
import { EventQueueService, EventQueueOptions } from './services/EventQueueService';
import { MemoryManagerOptions } from './services/processing/MemoryManager';
import { PoolOptions } from './services/infrastructure/ObjectPool';
import { TraversalOptions } from './services/filesystem/FileSystemTraversal';
import { ChunkingOptions } from './services/parser/SmartCodeParser';
import { FileWatcherService } from './services/filesystem/FileWatcherService';
import { VectorStorageService } from './services/storage/vector/VectorStorageService';
import { GraphPersistenceService } from './services/storage/graph/GraphPersistenceService';
import { ParserService } from './services/parser/ParserService';
import { TransactionCoordinator } from './services/sync/TransactionCoordinator';
import { EntityMappingService } from './services/sync/EntityMappingService';
import { EntityIdManager } from './services/sync/EntityIdManager';
import { IndexService } from './services/indexing/IndexService';
import { NebulaConnectionManager } from './database/nebula/NebulaConnectionManager';
import { QdrantClientWrapper } from './database/qdrant/QdrantClientWrapper';
import { NebulaService } from './database/NebulaService';
import { NebulaQueryBuilder } from './database/nebula/NebulaQueryBuilder';
import { NebulaSpaceManager } from './database/nebula/NebulaSpaceManager';
import { GraphDatabaseErrorHandler } from './core/GraphDatabaseErrorHandler';
import { GraphPersistenceUtils } from './services/storage/graph/GraphPersistenceUtils';
import { GraphCacheService } from './services/storage/graph/GraphCacheService';
import { GraphPerformanceMonitor } from './services/storage/graph/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from './services/storage/graph/GraphBatchOptimizer';
import { GraphQueryBuilder } from './services/storage/graph/GraphQueryBuilder';
import { GraphSearchService } from './services/storage/graph/GraphSearchService';
import { ErrorClassifier } from './core/ErrorClassifier';
import { EmbedderFactory } from './embedders/EmbedderFactory';
import { OpenAIEmbedder } from './embedders/OpenAIEmbedder';
import { OllamaEmbedder } from './embedders/OllamaEmbedder';
import { GeminiEmbedder } from './embedders/GeminiEmbedder';
import { MistralEmbedder } from './embedders/MistralEmbedder';
import { SiliconFlowEmbedder } from './embedders/SiliconFlowEmbedder';
import { Custom1Embedder } from './embedders/Custom1Embedder';
import { Custom2Embedder } from './embedders/Custom2Embedder';
import { Custom3Embedder } from './embedders/Custom3Embedder';
import { EmbeddingCacheService } from './embedders/EmbeddingCacheService';
import { BatchProcessingService } from './services/storage/BatchProcessingService';
import { EmbeddingService } from './services/storage/EmbeddingService';

// New refactored services
import { IndexCoordinator } from './services/indexing/IndexCoordinator';
import { StorageCoordinator } from './services/storage/StorageCoordinator';
import { BatchProcessor } from './services/processing/BatchProcessor';
import { MemoryManager } from './services/processing/MemoryManager';
import { SearchCoordinator } from './services/search/SearchCoordinator';
import { PerformanceMonitor } from './services/monitoring/PerformanceMonitor';
import { HealthChecker } from './services/monitoring/HealthChecker';
import { ConfigManager } from './services/infrastructure/ConfigManager';
import { AsyncPipeline } from './services/infrastructure/AsyncPipeline';
import { ObjectPool } from './services/infrastructure/ObjectPool';

// Existing services that remain
import { SemanticSearchService } from './services/search/SemanticSearchService';
import { HybridSearchService } from './services/search/HybridSearchService';
import { RerankingService } from './services/reranking/RerankingService';

// Existing batch processing services
import { ConcurrentProcessingService } from './services/processing/ConcurrentProcessingService';
import { MemoryOptimizationService } from './services/optimization/MemoryOptimizationService';
import { BatchPerformanceMonitor } from './services/monitoring/BatchPerformanceMonitor';
import { BatchSizeConfigManager } from './services/configuration/BatchSizeConfigManager';
import { BatchErrorRecoveryService } from './services/recovery/BatchErrorRecoveryService';
import { BatchProcessingMetrics } from './services/monitoring/BatchProcessingMetrics';
import { FileSystemTraversal } from './services/filesystem/FileSystemTraversal';
import { SmartCodeParser } from './services/parser/SmartCodeParser';
import { TreeSitterService } from './services/parser/TreeSitterService';
import { TreeSitterCoreService } from './services/parser/TreeSitterCoreService';
import { ControlStructureRule } from './services/parser/treesitter-rule/ControlStructureRule';
import { ErrorHandlingRule } from './services/parser/treesitter-rule/ErrorHandlingRule';
import { FunctionCallChainRule } from './services/parser/treesitter-rule/FunctionCallChainRule';
import { CommentMarkedRule } from './services/parser/treesitter-rule/CommentMarkedRule';
import { LogicBlockRule } from './services/parser/treesitter-rule/LogicBlockRule';
import { ExpressionSequenceRule } from './services/parser/treesitter-rule/ExpressionSequenceRule';
import { ObjectArrayLiteralRule } from './services/parser/treesitter-rule/ObjectArrayLiteralRule';
import { ArithmeticLogicalRule } from './services/parser/treesitter-rule/ArithmeticLogicalRule';
import { TemplateLiteralRule } from './services/parser/treesitter-rule/TemplateLiteralRule';
import { DestructuringAssignmentRule } from './services/parser/treesitter-rule/DestructuringAssignmentRule';

// Additional services
import { HashBasedDeduplicator } from './services/deduplication/HashBasedDeduplicator';
import { GraphService } from './services/graph/GraphService';
import { IGraphService } from './services/graph/IGraphService';
import { HealthCheckService } from './services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from './services/monitoring/PerformanceAnalysisService';
import { PrometheusMetricsService } from './services/monitoring/PrometheusMetricsService';
import { QueryCache } from './services/query/QueryCache';
import { QueryCoordinationService } from './services/query/QueryCoordinationService';
import { QueryOptimizer } from './services/query/QueryOptimizer';
import { ResultFusionEngine } from './services/query/ResultFusionEngine';
import { IRerankingService } from './services/reranking/IRerankingService';
import { MLRerankingService } from './services/reranking/MLRerankingService';
import { RealTimeLearningService } from './services/reranking/RealTimeLearningService';
import { SimilarityAlgorithms } from './services/reranking/SimilarityAlgorithms';
import { ConsistencyChecker } from './services/sync/ConsistencyChecker';
import { DimensionAdapterService } from './embedders/DimensionAdapterService';
import { HttpServer } from './api/HttpServer';
import { MonitoringRoutes } from './api/routes/MonitoringRoutes';
import { SnippetRoutes } from './api/routes/SnippetRoutes';
import { MonitoringController } from './controllers/MonitoringController';
import { SnippetController } from './controllers/SnippetController';
import { MCPServer } from './mcp/MCPServer';
import { DIContainer } from './core/DIContainer';
import { QdrantService } from './database/QdrantService';

// Create a new container
const container = new Container();

// Bind core services
container.bind<ConfigService>(ConfigService).toSelf().inSingletonScope();
container.bind<ConfigFactory>(ConfigFactory).toSelf().inSingletonScope();
container.bind<LoggerService>(LoggerService).toSelf().inSingletonScope();
container.bind<ErrorHandlerService>(ErrorHandlerService).toSelf().inSingletonScope();

// Bind utilities
container.bind<HashUtils>(HashUtils).toSelf().inSingletonScope();
container.bind<PathUtils>(PathUtils).toSelf().inSingletonScope();

// Bind database clients
container.bind<NebulaConnectionManager>(NebulaConnectionManager).toSelf().inSingletonScope();
container.bind<QdrantClientWrapper>(QdrantClientWrapper).toSelf().inSingletonScope();
container.bind<NebulaService>(NebulaService).toSelf().inSingletonScope();
container.bind<NebulaQueryBuilder>(NebulaQueryBuilder).toSelf().inSingletonScope();
container.bind<NebulaSpaceManager>(NebulaSpaceManager).toSelf().inSingletonScope();
container.bind<GraphPersistenceUtils>(GraphPersistenceUtils).toSelf().inSingletonScope();
container.bind<GraphCacheService>(GraphCacheService).toSelf().inSingletonScope();
container.bind<GraphPerformanceMonitor>(GraphPerformanceMonitor).toSelf().inSingletonScope();
container.bind<GraphBatchOptimizer>(GraphBatchOptimizer).toSelf().inSingletonScope();
container.bind<GraphQueryBuilder>(GraphQueryBuilder).toSelf().inSingletonScope();
container.bind<GraphSearchService>(GraphSearchService).toSelf().inSingletonScope();
container.bind<GraphDatabaseErrorHandler>(GraphDatabaseErrorHandler).toSelf().inSingletonScope();
container.bind<ErrorClassifier>(ErrorClassifier).toSelf().inSingletonScope();
container.bind<EmbedderFactory>(EmbedderFactory).toSelf().inSingletonScope();
container.bind<OpenAIEmbedder>(OpenAIEmbedder).toSelf().inSingletonScope();
container.bind<OllamaEmbedder>(OllamaEmbedder).toSelf().inSingletonScope();
container.bind<GeminiEmbedder>(GeminiEmbedder).toSelf().inSingletonScope();
container.bind<MistralEmbedder>(MistralEmbedder).toSelf().inSingletonScope();
container.bind<SiliconFlowEmbedder>(SiliconFlowEmbedder).toSelf().inSingletonScope();
container.bind<Custom1Embedder>(Custom1Embedder).toSelf().inSingletonScope();
container.bind<Custom2Embedder>(Custom2Embedder).toSelf().inSingletonScope();
container.bind<Custom3Embedder>(Custom3Embedder).toSelf().inSingletonScope();
container.bind<EmbeddingCacheService>(EmbeddingCacheService).toSelf().inSingletonScope();

// Bind services
container.bind<ChangeDetectionService>(ChangeDetectionService).toSelf().inSingletonScope();
container.bind<VectorStorageService>(VectorStorageService).toSelf().inSingletonScope();
container.bind<GraphPersistenceService>(GraphPersistenceService).toSelf().inSingletonScope();
container.bind<ParserService>(ParserService).toSelf().inSingletonScope();
container.bind<TransactionCoordinator>(TransactionCoordinator).toSelf().inSingletonScope();
container.bind<EntityMappingService>(EntityMappingService).toSelf().inSingletonScope();
container.bind<EntityIdManager>(EntityIdManager).toSelf().inSingletonScope();
container.bind<IndexService>(IndexService).toSelf().inSingletonScope();
container.bind<EventQueueService>(EventQueueService).toSelf().inSingletonScope();
container.bind<FileWatcherService>(FileWatcherService).toSelf().inSingletonScope();

// Bind new refactored services
container.bind<IndexCoordinator>(IndexCoordinator).toSelf().inSingletonScope();
container.bind<StorageCoordinator>(StorageCoordinator).toSelf().inSingletonScope();
container.bind<BatchProcessor>(BatchProcessor).toSelf().inSingletonScope();
container.bind<MemoryManager>(MemoryManager).toSelf().inSingletonScope();
container.bind<SearchCoordinator>(SearchCoordinator).toSelf().inSingletonScope();
container.bind<PerformanceMonitor>(PerformanceMonitor).toSelf().inSingletonScope();
container.bind<HealthChecker>(HealthChecker).toSelf().inSingletonScope();
container.bind<ConfigManager>(ConfigManager).toSelf().inSingletonScope();
container.bind<AsyncPipeline>(AsyncPipeline).toSelf().inSingletonScope();
// Create a default pool options for ObjectPool
const defaultPoolOptions: PoolOptions<any> = {
  initialSize: 10,
  maxSize: 100,
  creator: () => ({}),
  resetter: (obj: any) => { },
  validator: (obj: any) => true,
  destroy: (obj: any) => { },
  evictionPolicy: 'lru'
};

container.bind<ObjectPool<any>>(ObjectPool).toSelf().inSingletonScope();
container.bind<PoolOptions<any>>('PoolOptions').toConstantValue(defaultPoolOptions);

// Bind remaining search services
container.bind<SemanticSearchService>(SemanticSearchService).toSelf().inSingletonScope();
container.bind<HybridSearchService>(HybridSearchService).toSelf().inSingletonScope();
container.bind<RerankingService>(RerankingService).toSelf().inSingletonScope();

// Bind batch processing services
container.bind<BatchProcessingMetrics>(BatchProcessingMetrics).toSelf().inSingletonScope();
container.bind<BatchProcessingService>(BatchProcessingService).toSelf().inSingletonScope();
container.bind<EmbeddingService>(EmbeddingService).toSelf().inSingletonScope();
container.bind<ConcurrentProcessingService>(ConcurrentProcessingService).toSelf().inSingletonScope();
container.bind<MemoryOptimizationService>(MemoryOptimizationService).toSelf().inSingletonScope();
container.bind<BatchPerformanceMonitor>(BatchPerformanceMonitor).toSelf().inSingletonScope();
container.bind<BatchSizeConfigManager>(BatchSizeConfigManager).toSelf().inSingletonScope();
container.bind<BatchErrorRecoveryService>(BatchErrorRecoveryService).toSelf().inSingletonScope();

// Bind additional services
container.bind<FileSystemTraversal>(FileSystemTraversal).toSelf().inSingletonScope();
container.bind<SmartCodeParser>(SmartCodeParser).toSelf().inSingletonScope();
container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
container.bind<SnippetExtractionService>(TYPES.SnippetExtractionService).to(SnippetExtractionService).inSingletonScope();

// Bind snippet extraction rules with enhanced rules
import { EnhancedRuleFactory } from './services/parser/treesitter-rule/EnhancedRuleFactory';

// Import all rule classes
import { AsyncPatternRule } from './services/parser/treesitter-rule/modern-features/AsyncPatternRule';
import { DecoratorPatternRule } from './services/parser/treesitter-rule/modern-features/DecoratorPatternRule';
import { GenericPatternRule } from './services/parser/treesitter-rule/modern-features/GenericPatternRule';
import { FunctionalProgrammingRule } from './services/parser/treesitter-rule/modern-features/FunctionalProgrammingRule';
import { PythonComprehensionRule } from './services/parser/treesitter-rule/languages/python/PythonComprehensionRule';
import { JavaStreamRule } from './services/parser/treesitter-rule/languages/java/JavaStreamRule';
import { JavaLambdaRule } from './services/parser/treesitter-rule/languages/java/JavaLambdaRule';
import { GoGoroutineRule } from './services/parser/treesitter-rule/languages/go/GoGoroutineRule';
import { GoInterfaceRule } from './services/parser/treesitter-rule/languages/go/GoInterfaceRule';

// Import framework rules
import { ReactRule } from './services/parser/treesitter-rule/languages/ts/frameworks/ReactRule';
import { DjangoRule } from './services/parser/treesitter-rule/languages/python/frameworks/DjangoRule';
import { SpringBootRule } from './services/parser/treesitter-rule/languages/java/frameworks/SpringBootRule';
import { PyTorchRule } from './services/parser/treesitter-rule/languages/python/frameworks/PyTorchRule';

// Import Phase 2 framework rules
import { VueRule } from './services/parser/treesitter-rule/languages/ts/frameworks/VueRule';
import { ExpressRule } from './services/parser/treesitter-rule/languages/js/frameworks/ExpressRule';
import { PytestRule } from './services/parser/treesitter-rule/languages/python/testing/PytestRule';
import { JUnitRule } from './services/parser/treesitter-rule/languages/java/testing/JUnitRule';

// Bind core snippet extraction rules (existing ones remain for compatibility)
import { SnippetExtractionRule } from './services/parser/treesitter-rule/SnippetExtractionRule';
import { TYPES } from './types';

container.bind<SnippetExtractionRule[]>(TYPES.SnippetExtractionRules).toConstantValue([
  new ControlStructureRule(),
  new ErrorHandlingRule(),
  new FunctionCallChainRule(),
  new CommentMarkedRule(),
  new LogicBlockRule(),
  new ExpressionSequenceRule(),
  new ObjectArrayLiteralRule(),
  new ArithmeticLogicalRule(),
  new TemplateLiteralRule(),
  new DestructuringAssignmentRule(),

  // Modern features rules
  new AsyncPatternRule(),
  new DecoratorPatternRule(),
  new GenericPatternRule(),
  new FunctionalProgrammingRule(),

  // Language-specific rules
  new PythonComprehensionRule(),
  new JavaStreamRule(),
  new JavaLambdaRule(),
  new GoGoroutineRule(),
  new GoInterfaceRule(),

  // Framework rules
  new ReactRule(),
  new DjangoRule(),
  new SpringBootRule(),
  new PyTorchRule(),

  // Phase 2 framework rules
  new VueRule(),
  new ExpressRule(),
  new PytestRule(),
  new JUnitRule()
]);

// Bind enhanced rule factory for dynamic rule creation
container.bind(EnhancedRuleFactory).toSelf().inSingletonScope();

// Bind rule collections for different use cases
container.bind<SnippetExtractionRule[]>('ComprehensiveRules').toConstantValue(
  EnhancedRuleFactory.createComprehensiveRules()
);

container.bind<SnippetExtractionRule[]>('LanguageSpecificRules').toConstantValue(
  EnhancedRuleFactory.createLanguageSpecificRules('javascript') // Default to JavaScript
);

container.bind<SnippetExtractionRule[]>('PerformanceFocusedRules').toConstantValue(
  EnhancedRuleFactory.createFocusedRules('performance')
);

container.bind<SnippetExtractionRule[]>('ArchitectureFocusedRules').toConstantValue(
  EnhancedRuleFactory.createFocusedRules('architecture')
);

container.bind<SnippetExtractionRule[]>('TestingFocusedRules').toConstantValue(
  EnhancedRuleFactory.createFocusedRules('testing')
);

// Bind deduplication services
container.bind<HashBasedDeduplicator>(HashBasedDeduplicator).toSelf().inSingletonScope();

// Bind graph services
container.bind<GraphService>(GraphService).toSelf().inSingletonScope();
container.bind<IGraphService>('IGraphService').toService(GraphService);

// Bind additional monitoring services
container.bind<HealthCheckService>(HealthCheckService).toSelf().inSingletonScope();
container.bind<PerformanceAnalysisService>(PerformanceAnalysisService).toSelf().inSingletonScope();
container.bind<PrometheusMetricsService>(PrometheusMetricsService).toSelf().inSingletonScope();

// Bind query services
container.bind<QueryCache>(QueryCache).toSelf().inSingletonScope();
container.bind<QueryCoordinationService>(QueryCoordinationService).toSelf().inSingletonScope();
container.bind<QueryOptimizer>(QueryOptimizer).toSelf().inSingletonScope();
container.bind<ResultFusionEngine>(ResultFusionEngine).toSelf().inSingletonScope();

// Bind reranking services
container.bind<IRerankingService>('IRerankingService').to(RerankingService).inSingletonScope();
container.bind<MLRerankingService>(MLRerankingService).toSelf().inSingletonScope();
container.bind<RealTimeLearningService>(RealTimeLearningService).toSelf().inSingletonScope();
container.bind<SimilarityAlgorithms>(SimilarityAlgorithms).toSelf().inSingletonScope();

// Bind additional sync services
container.bind<ConsistencyChecker>(ConsistencyChecker).toSelf().inSingletonScope();

// Bind additional embedder services
container.bind<DimensionAdapterService>(DimensionAdapterService).toSelf().inSingletonScope();

// Bind static analysis services
import { StaticAnalysisCoordinator } from './services/static-analysis/StaticAnalysisCoordinator';
import { SemgrepScanService } from './services/semgrep/SemgrepScanService';
import { SemgrepResultProcessor } from './services/semgrep/SemgrepResultProcessor';
import { SemgrepRuleAdapter } from './services/semgrep/SemgrepRuleAdapter';
import { StaticAnalysisRoutes } from './api/routes/StaticAnalysisRoutes';
import { SnippetExtractionService } from './services/parser/SnippetExtractionService';
import { EnhancedSemgrepAnalyzer } from './services/static-analysis/EnhancedSemgrepAnalyzer';
import { EnhancedSemgrepScanService } from './services/semgrep/EnhancedSemgrepScanService';

container.bind<StaticAnalysisCoordinator>(StaticAnalysisCoordinator).toSelf().inSingletonScope();
container.bind<SemgrepScanService>(SemgrepScanService).toSelf().inSingletonScope();
container.bind<SemgrepResultProcessor>(SemgrepResultProcessor).toSelf().inSingletonScope();
container.bind<SemgrepRuleAdapter>(SemgrepRuleAdapter).toSelf().inSingletonScope();
container.bind<EnhancedSemgrepAnalyzer>(EnhancedSemgrepAnalyzer).toSelf().inSingletonScope();
container.bind<EnhancedSemgrepScanService>(EnhancedSemgrepScanService).toSelf().inSingletonScope();

// Bind API services
container.bind<HttpServer>(HttpServer).toSelf().inSingletonScope();
container.bind<MonitoringRoutes>(MonitoringRoutes).toSelf().inSingletonScope();
container.bind<SnippetRoutes>(SnippetRoutes).toSelf().inSingletonScope();
container.bind<StaticAnalysisRoutes>(StaticAnalysisRoutes).toSelf().inSingletonScope();

// Bind controller services
container.bind<MonitoringController>(MonitoringController).toSelf().inSingletonScope();
container.bind<SnippetController>(SnippetController).toSelf().inSingletonScope();

// Bind MCP services
container.bind<MCPServer>(MCPServer).toSelf().inSingletonScope();

// Bind core services
container.bind<DIContainer>(DIContainer).toSelf().inSingletonScope();

// Bind database services
container.bind<QdrantService>(QdrantService).toSelf().inSingletonScope();

// Bind configuration objects
container.bind<ChangeDetectionOptions>('ChangeDetectionOptions').toConstantValue({});
container.bind<EventQueueOptions>('EventQueueOptions').toConstantValue({});
container.bind<MemoryManagerOptions>('MemoryManagerOptions').toConstantValue({});
container.bind<TraversalOptions>('TraversalOptions').toConstantValue({});
container.bind<ChunkingOptions>('ChunkingOptions').toConstantValue({});

// Export the container and types
export { container, DIContainer, TYPES };