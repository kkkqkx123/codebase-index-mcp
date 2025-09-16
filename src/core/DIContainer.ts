import 'reflect-metadata';
import { Container, ContainerModule } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigFactory } from '../config/ConfigFactory';
import { IndexService } from '../services/indexing/IndexService';
import { GraphService } from '../services/graph/GraphService';
import { ParserService } from '../services/parser/ParserService';
import { QdrantService } from '../database/QdrantService';
import { NebulaService } from '../database/NebulaService';
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
import { TreeSitterService } from '../services/parser/TreeSitterService';
import { TreeSitterCoreService } from '../services/parser/TreeSitterCoreService';
import { SnippetExtractionService } from '../services/parser/SnippetExtractionService';
import { EnhancedRuleFactory } from '../services/parser/treesitter-rule/EnhancedRuleFactory';
import { SemgrepScanService } from '../services/semgrep/SemgrepScanService';
import { EnhancedSemgrepScanService } from '../services/semgrep/EnhancedSemgrepScanService';
import { SemgrepRuleAdapter } from '../services/semgrep/SemgrepRuleAdapter';
import { SemanticAnalysisService } from '../services/parser/SemanticAnalysisService';
import { SmartCodeParser } from '../services/parser/SmartCodeParser';
import { FileSystemTraversal } from '../services/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../services/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../services/filesystem/ChangeDetectionService';
import { HashBasedDeduplicator } from '../services/deduplication/HashBasedDeduplicator';
import { CacheManager } from '../services/cache/CacheManager';
import { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';
import { VectorStorageService } from '../services/storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../services/storage/graph/GraphPersistenceService';
import { GraphPersistenceUtils } from '../services/storage/graph/GraphPersistenceUtils';
import { GraphCacheService } from '../services/storage/graph/GraphCacheService';
import { GraphPerformanceMonitor } from '../services/storage/graph/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../services/storage/graph/GraphBatchOptimizer';
import { GraphQueryBuilder } from '../services/storage/graph/GraphQueryBuilder';
import { GraphSearchService } from '../services/storage/graph/GraphSearchService';
import { BatchProcessingService } from '../services/storage/BatchProcessingService';
import { EmbeddingService } from '../services/storage/EmbeddingService';
import { EntityIdManager } from '../services/sync/EntityIdManager';
import { EntityMappingService } from '../services/sync/EntityMappingService';
import { TransactionCoordinator } from '../services/sync/TransactionCoordinator';
import { ConsistencyChecker } from '../services/sync/ConsistencyChecker';
import { EventQueueService } from '../services/EventQueueService';
import { GraphDatabaseErrorHandler } from '../core/GraphDatabaseErrorHandler';
import { ErrorClassifier } from '../core/ErrorClassifier';
import { NebulaQueryBuilder } from '../database/nebula/NebulaQueryBuilder';
import { IndexCoordinator } from '../services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../services/storage/StorageCoordinator';
import { SemanticSearchService } from '../services/search/SemanticSearchService';
import { SearchCoordinator } from '../services/search/SearchCoordinator';
import { HybridSearchService } from '../services/search/HybridSearchService';
import { RerankingService } from '../services/reranking/RerankingService';
import { QueryCache } from '../services/query/QueryCache';
import { QueryCoordinationService } from '../services/query/QueryCoordinationService';
import { ResultFusionEngine } from '../services/query/ResultFusionEngine';
import { QueryOptimizer } from '../services/query/QueryOptimizer';
import { ResultFormatter } from '../services/query/ResultFormatter';
import { ResultFormatterCache } from '../services/query/ResultFormatterCache';
import { ResultFormatterConfigLoader } from '../services/query/ResultFormatterConfigLoader';
import { SemgrepResultProcessor } from '../services/semgrep/SemgrepResultProcessor';

// Monitoring services
import { PrometheusMetricsService } from '../services/monitoring/PrometheusMetricsService';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../services/monitoring/PerformanceAnalysisService';

// Processing services
import { BatchProcessor } from '../services/processing/BatchProcessor';
import { PerformanceMonitor } from '../services/monitoring/PerformanceMonitor';
import { BatchProcessingMetrics } from '../services/monitoring/BatchProcessingMetrics';
import { BatchPerformanceMonitor } from '../services/monitoring/BatchPerformanceMonitor';
import { SemgrepMetricsService } from '../services/monitoring/SemgrepMetricsService';

// Infrastructure services
import { AsyncPipeline } from '../services/infrastructure/AsyncPipeline';
import { MemoryManager } from '../services/processing/MemoryManager';
import { ObjectPool } from '../services/infrastructure/ObjectPool';

// LSP services
import { LSPService } from '../services/lsp/LSPService';
import { LSPEnhancementPhase } from '../services/indexing/LSPEnhancementPhase';
import { EnhancedParserService } from '../services/parser/EnhancedParserService';
import { LSPManager } from '../services/lsp/LSPManager';
import { LSPClient } from '../services/lsp/LSPClient';
import { LSPClientPool } from '../services/lsp/LSPClientPool';
import { LSPErrorHandler } from '../services/lsp/LSPErrorHandler';
import { LanguageServerRegistry } from '../services/lsp/LanguageServerRegistry';
import { LSPSearchService } from '../services/lsp/LSPSearchService';
import { LSPEnhancedSearchService } from '../services/search/LSPEnhancedSearchService';

// Controllers
import { MonitoringController } from '../controllers/MonitoringController';
import { SnippetController } from '../controllers/SnippetController';
import { CacheController } from '../controllers/CacheController';
import { ParserController } from '../controllers/ParserController';

// Additional services from inversify.config.ts
import { SemanticAnalysisOrchestrator } from '../services/SemanticAnalysisOrchestrator';
import { CallGraphService } from '../services/parser/CallGraphService';
import { SemanticSemgrepService } from '../services/semgrep/SemanticSemgrepService';
import { StaticAnalysisCoordinator } from '../services/static-analysis/StaticAnalysisCoordinator';
import { EnhancedSemgrepAnalyzer } from '../services/static-analysis/EnhancedSemgrepAnalyzer';
import { AdvancedTreeSitterService } from '../services/parser/AdvancedTreeSitterService';
import { SymbolTableBuilder } from '../services/parser/SymbolTableBuilder';
import { CFGBuilder } from '../services/parser/CFGBuilder';
import { DataFlowAnalyzer } from '../services/parser/DataFlowGraph';
import { IncrementalAnalyzer } from '../services/parser/IncrementalAnalyzer';
import { SecurityAnalyzer } from '../services/parser/SecurityAnalyzer';

// Project management services
import { ProjectIdManager } from '../database/ProjectIdManager';
import { ProjectLookupService } from '../database/ProjectLookupService';

const coreModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  bind(TYPES.GraphDatabaseErrorHandler).to(GraphDatabaseErrorHandler).inSingletonScope();
  bind(TYPES.ErrorClassifier).to(ErrorClassifier).inSingletonScope();
  bind(TYPES.ConfigFactory).to(ConfigFactory).inSingletonScope();
});

const databaseModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.QdrantService).to(QdrantService).inSingletonScope();
  bind(TYPES.NebulaService).to(NebulaService).inSingletonScope();
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
  bind(TYPES.SemgrepScanService).to(SemgrepScanService).inSingletonScope();
  bind(TYPES.EnhancedSemgrepScanService).to(EnhancedSemgrepScanService).inSingletonScope();
  bind(TYPES.SemgrepRuleAdapter).to(SemgrepRuleAdapter).inSingletonScope();
  bind(TYPES.SemanticAnalysisService).to(SemanticAnalysisService).inSingletonScope();
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

  // Additional services from inversify.config.ts
  bind(TYPES.SemanticAnalysisOrchestrator).to(SemanticAnalysisOrchestrator).inSingletonScope();
  bind(TYPES.CallGraphService).to(CallGraphService).inSingletonScope();
  bind(TYPES.SemanticSemgrepService).to(SemanticSemgrepService).inSingletonScope();
  bind(TYPES.StaticAnalysisCoordinator).to(StaticAnalysisCoordinator).inSingletonScope();
  bind(TYPES.EnhancedSemgrepAnalyzer).to(EnhancedSemgrepAnalyzer).inSingletonScope();
  bind(TYPES.SemgrepResultProcessor).to(SemgrepResultProcessor).inSingletonScope();

  // Project management services
  bind(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
  bind(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();

  // Phase 2: Tree-sitter Deep Analysis Services
  bind(TYPES.AdvancedTreeSitterService).to(AdvancedTreeSitterService).inSingletonScope();
  bind(TYPES.SymbolTableBuilder).to(SymbolTableBuilder).inSingletonScope();
  bind(TYPES.CFGBuilder).to(CFGBuilder).inSingletonScope();
  bind(TYPES.DataFlowAnalyzer).to(DataFlowAnalyzer).inSingletonScope();
  bind(TYPES.IncrementalAnalyzer).to(IncrementalAnalyzer).inSingletonScope();
  bind(TYPES.SecurityAnalyzer).to(SecurityAnalyzer).inSingletonScope();
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

export { TYPES };
export class DIContainer {
  private static instance: Container | null = null;

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container();
      DIContainer.instance.load(
        coreModule,
        databaseModule,
        embedderModule,
        serviceModule,
        queueModule,
        syncModule,
        monitoringModule,
        controllerModule
      );
    }
    return DIContainer.instance;
  }

  static reset(): void {
    DIContainer.instance = null;
  }
}
