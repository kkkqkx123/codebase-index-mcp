import 'reflect-metadata';
import { Container, ContainerModule } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { IndexService } from '../services/indexing/IndexService';
import { GraphService } from '../services/graph/GraphService';
import { ParserService } from '../services/parser/ParserService';
import { QdrantService } from '../database/QdrantService';
import { NebulaService } from '../database/NebulaService';
import { NebulaConnectionManager } from '../database/nebula/NebulaConnectionManager';
import { OpenAIEmbedder } from '../embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../embedders/GeminiEmbedder';
import { MistralEmbedder } from '../embedders/MistralEmbedder';
import { EmbedderFactory } from '../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../embedders/EmbeddingCacheService';
import { TreeSitterService } from '../services/parser/TreeSitterService';
import { TreeSitterCoreService } from '../services/parser/TreeSitterCoreService';
import { SnippetExtractionService } from '../services/parser/SnippetExtractionService';
import { CacheManager } from '../services/cache/CacheManager';
import { SemgrepScanService } from '../services/semgrep/SemgrepScanService';
import { SmartCodeParser } from '../services/parser/SmartCodeParser';
import { FileSystemTraversal } from '../services/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../services/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../services/filesystem/ChangeDetectionService';
import { HashBasedDeduplicator } from '../services/deduplication/HashBasedDeduplicator';
import { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';
import { VectorStorageService } from '../services/storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../services/storage/graph/GraphPersistenceService';
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

// Monitoring services
import { PrometheusMetricsService } from '../services/monitoring/PrometheusMetricsService';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../services/monitoring/PerformanceAnalysisService';

// Processing services
import { BatchProcessor } from '../services/processing/BatchProcessor';
import { PerformanceMonitor } from '../services/monitoring/PerformanceMonitor';
import { BatchProcessingMetrics } from '../services/monitoring/BatchProcessingMetrics';

// Controllers
import { MonitoringController } from '../controllers/MonitoringController';
import { SnippetController } from '../controllers/SnippetController';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  IndexService: Symbol.for('IndexService'),
  GraphService: Symbol.for('GraphService'),
  ParserService: Symbol.for('ParserService'),
  QdrantService: Symbol.for('QdrantService'),
  NebulaService: Symbol.for('NebulaService'),
  NebulaConnectionManager: Symbol.for('NebulaConnectionManager'),
  EmbedderFactory: Symbol.for('EmbedderFactory'),
  EmbeddingCacheService: Symbol.for('EmbeddingCacheService'),
  CacheManager: Symbol.for('CacheManager'),
  OpenAIEmbedder: Symbol.for('OpenAIEmbedder'),
  OllamaEmbedder: Symbol.for('OllamaEmbedder'),
  GeminiEmbedder: Symbol.for('GeminiEmbedder'),
  MistralEmbedder: Symbol.for('MistralEmbedder'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  TreeSitterCoreService: Symbol.for('TreeSitterCoreService'),
  SnippetExtractionService: Symbol.for('SnippetExtractionService'),
  SemgrepScanService: Symbol.for('SemgrepScanService'),
  SnippetExtractionRules: Symbol.for('SnippetExtractionRules'),
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
  QueryCache: Symbol.for('QueryCache'),
  QueryCoordinationService: Symbol.for('QueryCoordinationService'),
  ResultFusionEngine: Symbol.for('ResultFusionEngine'),
  QueryOptimizer: Symbol.for('QueryOptimizer'),

  // Monitoring services
  PrometheusMetricsService: Symbol.for('PrometheusMetricsService'),
  HealthCheckService: Symbol.for('HealthCheckService'),
  PerformanceAnalysisService: Symbol.for('PerformanceAnalysisService'),
  PerformanceMonitor: Symbol.for('PerformanceMonitor'),
  BatchProcessingMetrics: Symbol.for('BatchProcessingMetrics'),

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
  EmbeddingService: Symbol.for('EmbeddingService')
};

const coreModule = new ContainerModule((bind: any) => {
  bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  bind(TYPES.GraphDatabaseErrorHandler).to(GraphDatabaseErrorHandler).inSingletonScope();
  bind(TYPES.ErrorClassifier).to(ErrorClassifier).inSingletonScope();
});

const databaseModule = new ContainerModule((bind: any) => {
  bind(TYPES.QdrantService).to(QdrantService).inSingletonScope();
  bind(TYPES.NebulaService).to(NebulaService).inSingletonScope();
  bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  bind(TYPES.QdrantClientWrapper).to(QdrantClientWrapper).inSingletonScope();
  bind(TYPES.NebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
});

const embedderModule = new ContainerModule((bind: any) => {
  bind(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();
  bind(TYPES.CacheManager).to(CacheManager).inSingletonScope();
  bind(TYPES.OpenAIEmbedder).to(OpenAIEmbedder).inSingletonScope();
  bind(TYPES.OllamaEmbedder).to(OllamaEmbedder).inSingletonScope();
  bind(TYPES.GeminiEmbedder).to(GeminiEmbedder).inSingletonScope();
  bind(TYPES.MistralEmbedder).to(MistralEmbedder).inSingletonScope();
  bind(TYPES.EmbedderFactory).to(EmbedderFactory).inSingletonScope();
});

const serviceModule = new ContainerModule((bind: any) => {
  bind(TYPES.IndexService).to(IndexService).inSingletonScope();
  bind(TYPES.GraphService).to(GraphService).inSingletonScope();
  bind(TYPES.ParserService).to(ParserService).inSingletonScope();
  bind(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
  bind(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
  bind(TYPES.SnippetExtractionService).to(SnippetExtractionService).inSingletonScope();
  bind(TYPES.SemgrepScanService).to(SemgrepScanService).inSingletonScope();
  bind(TYPES.SmartCodeParser).to(SmartCodeParser).inSingletonScope();
  bind(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
  bind(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
  bind(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();
  bind(TYPES.HashBasedDeduplicator).to(HashBasedDeduplicator).inSingletonScope();
  bind(TYPES.VectorStorageService).to(VectorStorageService).inSingletonScope();
  bind(TYPES.GraphPersistenceService).to(GraphPersistenceService).inSingletonScope();
  bind(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
  bind(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
  bind(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
  bind(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
  bind(TYPES.GraphSearchService).to(GraphSearchService).inSingletonScope();
  bind(TYPES.BatchProcessingService).to(BatchProcessingService).inSingletonScope();
  bind(TYPES.EmbeddingService).to(EmbeddingService).inSingletonScope();
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
});

const queueModule = new ContainerModule((bind: any) => {
  bind(TYPES.EventQueueService).to(EventQueueService).inSingletonScope();
});

const syncModule = new ContainerModule((bind: any) => {
  bind(TYPES.EntityIdManager).to(EntityIdManager).inSingletonScope();
  bind(TYPES.EntityMappingService).to(EntityMappingService).inSingletonScope();
  bind(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();
  bind(TYPES.ConsistencyChecker).to(ConsistencyChecker).inSingletonScope();
});

const monitoringModule = new ContainerModule((bind: any) => {
  bind(TYPES.PrometheusMetricsService).to(PrometheusMetricsService).inSingletonScope();
  bind(TYPES.HealthCheckService).to(HealthCheckService).inSingletonScope();
  bind(TYPES.PerformanceAnalysisService).to(PerformanceAnalysisService).inSingletonScope();
  bind(TYPES.BatchProcessingMetrics).to(BatchProcessingMetrics).inSingletonScope();
});

const controllerModule = new ContainerModule((bind: any) => {
  bind(TYPES.MonitoringController).to(MonitoringController).inSingletonScope();
  bind(TYPES.SnippetController).to(SnippetController).inSingletonScope();
  
  // Processing services
  bind(TYPES.BatchProcessor).to(BatchProcessor).inSingletonScope();
});

export class DIContainer {
  private static instance: Container | null = null;

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container();
      DIContainer.instance.load(coreModule, databaseModule, embedderModule, serviceModule, queueModule, syncModule, monitoringModule, controllerModule);
    }
    return DIContainer.instance;
  }

  static reset(): void {
    DIContainer.instance = null;
  }
}