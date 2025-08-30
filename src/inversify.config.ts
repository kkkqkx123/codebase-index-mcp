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
import { VectorStorageService } from './services/storage/VectorStorageService';
import { GraphPersistenceService } from './services/storage/GraphPersistenceService';
import { ParserService } from './services/parser/ParserService';
import { TransactionCoordinator } from './services/sync/TransactionCoordinator';
import { IndexService } from './services/indexing/IndexService';
import { NebulaConnectionManager } from './database/nebula/NebulaConnectionManager';
import { QdrantClientWrapper } from './database/qdrant/QdrantClientWrapper';

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

// Bind services
container.bind<ChangeDetectionService>(ChangeDetectionService).toSelf().inSingletonScope();
container.bind<VectorStorageService>(VectorStorageService).toSelf().inSingletonScope();
container.bind<GraphPersistenceService>(GraphPersistenceService).toSelf().inSingletonScope();
container.bind<ParserService>(ParserService).toSelf().inSingletonScope();
container.bind<TransactionCoordinator>(TransactionCoordinator).toSelf().inSingletonScope();
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
  resetter: (obj: any) => {},
  validator: (obj: any) => true,
  destroy: (obj: any) => {},
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
container.bind<ConcurrentProcessingService>(ConcurrentProcessingService).toSelf().inSingletonScope();
container.bind<MemoryOptimizationService>(MemoryOptimizationService).toSelf().inSingletonScope();
container.bind<BatchPerformanceMonitor>(BatchPerformanceMonitor).toSelf().inSingletonScope();
container.bind<BatchSizeConfigManager>(BatchSizeConfigManager).toSelf().inSingletonScope();
container.bind<BatchErrorRecoveryService>(BatchErrorRecoveryService).toSelf().inSingletonScope();

// Bind additional services
container.bind<FileSystemTraversal>(FileSystemTraversal).toSelf().inSingletonScope();
container.bind<SmartCodeParser>(SmartCodeParser).toSelf().inSingletonScope();

// Bind configuration objects
container.bind<ChangeDetectionOptions>('ChangeDetectionOptions').toConstantValue({});
container.bind<EventQueueOptions>('EventQueueOptions').toConstantValue({});
container.bind<MemoryManagerOptions>('MemoryManagerOptions').toConstantValue({});
container.bind<TraversalOptions>('TraversalOptions').toConstantValue({});
container.bind<ChunkingOptions>('ChunkingOptions').toConstantValue({});

// Export the container
export { container };