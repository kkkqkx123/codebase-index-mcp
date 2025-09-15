// Define all TYPES symbols
export const TYPES = {
  // Core services
  ConfigService: Symbol.for('ConfigService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  IndexService: Symbol.for('IndexService'),
  GraphService: Symbol.for('GraphService'),
  ParserService: Symbol.for('ParserService'),
  QdrantService: Symbol.for('QdrantService'),
  NebulaService: Symbol.for('NebulaService'),
  NebulaConnectionManager: Symbol.for('NebulaConnectionManager'),
  NebulaSpaceManager: Symbol.for('NebulaSpaceManager'),
  ProjectIdManager: Symbol.for('ProjectIdManager'),
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),
  OpenAIEmbedder: Symbol.for('OpenAIEmbedder'),
  OllamaEmbedder: Symbol.for('OllamaEmbedder'),
  GeminiEmbedder: Symbol.for('GeminiEmbedder'),
  MistralEmbedder: Symbol.for('MistralEmbedder'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  SmartCodeParser: Symbol.for('SmartCodeParser'),
  FileSystemTraversal: Symbol.for('FileSystemTraversal'),
  FileWatcherService: Symbol.for('FileWatcherService'),
  ChangeDetectionService: Symbol.for('ChangeDetectionService'),
  HashBasedDeduplicator: Symbol.for('HashBasedDeduplicator'),
  QdrantClientWrapper: Symbol.for('QdrantClientWrapper'),
  VectorStorageService: Symbol.for('VectorStorageService'),
  GraphPersistenceService: Symbol.for('GraphPersistenceService'),
  EntityIdManager: Symbol.for('EntityIdManager'),
  EntityMappingService: Symbol.for('EntityMappingService'),
  TransactionCoordinator: Symbol.for('TransactionCoordinator'),
  ConsistencyChecker: Symbol.for('ConsistencyChecker'),
  EventQueueService: Symbol.for('EventQueueService'),
  IndexCoordinator: Symbol.for('IndexCoordinator'),
  StorageCoordinator: Symbol.for('StorageCoordinator'),
  SemanticSearchService: Symbol.for('SemanticSearchService'),
  SearchCoordinator: Symbol.for('SearchCoordinator'),
  HybridSearchService: Symbol.for('HybridSearchService'),
  RerankingService: Symbol.for('RerankingService'),
  SemanticAnalysisOrchestrator: Symbol.for('SemanticAnalysisOrchestrator'),
  QueryCache: Symbol.for('QueryCache'),
  QueryCoordinationService: Symbol.for('QueryCoordinationService'),
  ResultFusionEngine: Symbol.for('ResultFusionEngine'),
  QueryOptimizer: Symbol.for('QueryOptimizer'),
  ResultFormatter: Symbol.for('ResultFormatter'),
  ResultFormatterCache: Symbol.for('ResultFormatterCache'),
  ResultFormatterConfigLoader: Symbol.for('ResultFormatterConfigLoader'),

  // Monitoring services
  PrometheusMetricsService: Symbol.for('PrometheusMetricsService'),
  HealthCheckService: Symbol.for('HealthCheckService'),
  PerformanceAnalysisService: Symbol.for('PerformanceAnalysisService'),
  PerformanceMonitor: Symbol.for('PerformanceMonitor'),
  BatchProcessingMetrics: Symbol.for('BatchProcessingMetrics'),
  BatchPerformanceMonitor: Symbol.for('BatchPerformanceMonitor'),
  SemgrepMetricsService: Symbol.for('SemgrepMetricsService'),

  // Processing services
  BatchProcessor: Symbol.for('BatchProcessor'),

  // Controllers
  MonitoringController: Symbol.for('MonitoringController'),
  SnippetController: Symbol.for('SnippetController'),
  GraphDatabaseErrorHandler: Symbol.for('GraphDatabaseErrorHandler'),
  ErrorClassifier: Symbol.for('ErrorClassifier'),
  NebulaQueryBuilder: Symbol.for('NebulaQueryBuilder'),
  GraphCacheService: Symbol.for('GraphCacheService'),
  GraphPerformanceMonitor: Symbol.for('GraphPerformanceMonitor'),
  GraphBatchOptimizer: Symbol.for('GraphBatchOptimizer'),
  GraphQueryBuilder: Symbol.for('GraphQueryBuilder'),
  GraphSearchService: Symbol.for('GraphSearchService'),
  BatchProcessingService: Symbol.for('BatchProcessingService'),
  EmbeddingService: Symbol.for('EmbeddingService'),

  // New services for TreeSitter refactoring
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  SnippetExtractionService: Symbol.for('SnippetExtractionService'),
  SnippetExtractionRules: Symbol.for('SnippetExtractionRules'),

  // Static analysis services
  StaticAnalysisCoordinator: Symbol.for('StaticAnalysisCoordinator'),
  SemgrepScanService: Symbol.for('SemgrepScanService'),
  EnhancedSemgrepScanService: Symbol.for('EnhancedSemgrepScanService'),
  EnhancedSemgrepAnalyzer: Symbol.for('EnhancedSemgrepAnalyzer'),
  SemgrepResultProcessor: Symbol.for('SemgrepResultProcessor'),
  SemgrepRuleAdapter: Symbol.for('SemgrepRuleAdapter'),
  SemanticAnalysisService: Symbol.for('SemanticAnalysisService'),
  SemanticSemgrepService: Symbol.for('SemanticSemgrepService'),
  CallGraphService: Symbol.for('CallGraphService'),

  // Embedders
  SiliconFlowEmbedder: Symbol.for('SiliconFlowEmbedder'),
  Custom1Embedder: Symbol.for('Custom1Embedder'),
  Custom2Embedder: Symbol.for('Custom2Embedder'),
  Custom3Embedder: Symbol.for('Custom3Embedder'),

  // Config and Factory
  ConfigFactory: Symbol.for('ConfigFactory'),

  // Search and cache
  SearchCache: Symbol.for('SearchCache'),
  QdrantCollectionManager: Symbol.for('QdrantCollectionManager'),
  CacheManager: Symbol.for('CacheManager'),

  // Processing and pipeline
  AsyncPipeline: Symbol.for('AsyncPipeline'),
  MemoryManager: Symbol.for('MemoryManager'),
  ObjectPool: Symbol.for('ObjectPool'),

  // LSP services
  LSPEnhancementPhase: Symbol.for('LSPEnhancementPhase'),
  LSPManager: Symbol.for('LSPManager'),
  LSPClient: Symbol.for('LSPClient'),
  LSPClientPool: Symbol.for('LSPClientPool'),
  LSPErrorHandler: Symbol.for('LSPErrorHandler'),
  LanguageServerRegistry: Symbol.for('LanguageServerRegistry'),
  LSPService: Symbol.for('LSPService'),
  LSPSearchService: Symbol.for('LSPSearchService'),
  LSPEnhancedSearchService: Symbol.for('LSPEnhancedSearchService'),

  // Parser services
  EnhancedParserService: Symbol.for('EnhancedParserService'),

  // Advanced TreeSitter services for Phase 2
  AdvancedTreeSitterService: Symbol.for('AdvancedTreeSitterService'),
  SymbolTableBuilder: Symbol.for('SymbolTableBuilder'),
  CFGBuilder: Symbol.for('CFGBuilder'),
  DataFlowAnalyzer: Symbol.for('DataFlowAnalyzer'),
  SecurityAnalyzer: Symbol.for('SecurityAnalyzer'),
  IncrementalAnalyzer: Symbol.for('IncrementalAnalyzer'),

  // Additional services that need TYPES symbols
  BatchErrorRecoveryService: Symbol.for('BatchErrorRecoveryService'),
  BatchSizeConfigManager: Symbol.for('BatchSizeConfigManager'),
  ConfigManager: Symbol.for('ConfigManager'),
  MemoryOptimizationService: Symbol.for('MemoryOptimizationService'),
  HealthChecker: Symbol.for('HealthChecker'),
  ConcurrentProcessingService: Symbol.for('ConcurrentProcessingService'),
  GraphPersistenceUtils: Symbol.for('GraphPersistenceUtils'),
  EnhancedQueryBuilder: Symbol.for('EnhancedQueryBuilder'),
  DataFlowGraph: Symbol.for('DataFlowGraph'),
} as const;
