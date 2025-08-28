import { Container } from 'inversify';
import { ConfigService } from './config/ConfigService';
import { LoggerService } from './core/LoggerService';
import { ErrorHandlerService } from './core/ErrorHandlerService';
import { HashUtils } from './utils/HashUtils';
import { PathUtils } from './utils/PathUtils';
import { ChangeDetectionService } from './services/filesystem/ChangeDetectionService';
import { VectorStorageService } from './services/storage/VectorStorageService';
import { GraphPersistenceService } from './services/storage/GraphPersistenceService';
import { ParserService } from './services/parser/ParserService';
import { TransactionCoordinator } from './services/sync/TransactionCoordinator';
import { IndexService } from './services/index/IndexService';
import { EventQueueService } from './services/EventQueueService';
import { QdrantClient } from './database/qdrant/QdrantClient';
import { Neo4jConnectionManager } from './database/neo4j/Neo4jConnectionManager';
import { QdrantClientWrapper } from './services/qdrant/QdrantClientWrapper';

// Batch processing services
import { BatchProcessingMetrics } from './services/monitoring/BatchProcessingMetrics';
import { ConcurrentProcessingService } from './services/processing/ConcurrentProcessingService';
import { MemoryOptimizationService } from './services/optimization/MemoryOptimizationService';
import { BatchPerformanceMonitor } from './services/monitoring/BatchPerformanceMonitor';
import { BatchSizeConfigManager } from './services/configuration/BatchSizeConfigManager';
import { BatchErrorRecoveryService } from './services/recovery/BatchErrorRecoveryService';

// Create a new container
const container = new Container();

// Bind core services
container.bind<ConfigService>(ConfigService).toSelf().inSingletonScope();
container.bind<LoggerService>(LoggerService).toSelf().inSingletonScope();
container.bind<ErrorHandlerService>(ErrorHandlerService).toSelf().inSingletonScope();

// Bind utilities
container.bind<HashUtils>(HashUtils).toSelf().inSingletonScope();
container.bind<PathUtils>(PathUtils).toSelf().inSingletonScope();

// Bind database clients
container.bind<QdrantClient>(QdrantClient).toSelf().inSingletonScope();
container.bind<Neo4jConnectionManager>(Neo4jConnectionManager).toSelf().inSingletonScope();
container.bind<QdrantClientWrapper>(QdrantClientWrapper).toSelf().inSingletonScope();

// Bind services
container.bind<ChangeDetectionService>(ChangeDetectionService).toSelf().inSingletonScope();
container.bind<VectorStorageService>(VectorStorageService).toSelf().inSingletonScope();
container.bind<GraphPersistenceService>(GraphPersistenceService).toSelf().inSingletonScope();
container.bind<ParserService>(ParserService).toSelf().inSingletonScope();
container.bind<TransactionCoordinator>(TransactionCoordinator).toSelf().inSingletonScope();
container.bind<IndexService>(IndexService).toSelf().inSingletonScope();
container.bind<EventQueueService>(EventQueueService).toSelf().inSingletonScope();

// Bind batch processing services
container.bind<BatchProcessingMetrics>(BatchProcessingMetrics).toSelf().inSingletonScope();
container.bind<ConcurrentProcessingService>(ConcurrentProcessingService).toSelf().inSingletonScope();
container.bind<MemoryOptimizationService>(MemoryOptimizationService).toSelf().inSingletonScope();
container.bind<BatchPerformanceMonitor>(BatchPerformanceMonitor).toSelf().inSingletonScope();
container.bind<BatchSizeConfigManager>(BatchSizeConfigManager).toSelf().inSingletonScope();
container.bind<BatchErrorRecoveryService>(BatchErrorRecoveryService).toSelf().inSingletonScope();

// Export the container
export { container };