import { Container } from 'inversify';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { LoggerService } from '../src/core/LoggerService';
import { ErrorHandlerService } from '../src/core/ErrorHandlerService';
import { EntityIdManager } from '../src/services/sync/EntityIdManager';
import { ConfigService } from '../src/config/ConfigService';
import { OpenAIEmbedder } from '../src/embedders/OpenAIEmbedder';
import { OllamaEmbedder } from '../src/embedders/OllamaEmbedder';
import { GeminiEmbedder } from '../src/embedders/GeminiEmbedder';
import { MistralEmbedder } from '../src/embedders/MistralEmbedder';
import { SiliconFlowEmbedder } from '../src/embedders/SiliconFlowEmbedder';
import { Custom1Embedder } from '../src/embedders/Custom1Embedder';
import { Custom2Embedder } from '../src/embedders/Custom2Embedder';
import { Custom3Embedder } from '../src/embedders/Custom3Embedder';
import { EmbedderFactory } from '../src/embedders/EmbedderFactory';
import { DimensionAdapterService } from '../src/embedders/DimensionAdapterService';
import { BaseEmbedder, EmbeddingInput, EmbeddingResult } from '../src/embedders/BaseEmbedder';
import { MemoryManager, MemoryManagerOptions } from '../src/services/processing/MemoryManager';
import { BatchProcessor } from '../src/services/processing/BatchProcessor';
import { AsyncPipeline } from '../src/services/infrastructure/AsyncPipeline';
import { ObjectPool, PoolOptions } from '../src/services/infrastructure/ObjectPool';
import { FileSystemTraversal, TraversalOptions } from '../src/services/filesystem/FileSystemTraversal';
import { SmartCodeParser, ChunkingOptions } from '../src/services/parser/SmartCodeParser';
import { ChangeDetectionService, ChangeDetectionOptions } from '../src/services/filesystem/ChangeDetectionService';
import { EventQueueService, EventQueueOptions } from '../src/services/EventQueueService';
import { TransactionCoordinator } from '../src/services/sync/TransactionCoordinator';
import { EntityMappingService } from '../src/services/sync/EntityMappingService';
import { IndexService } from '../src/services/indexing/IndexService';
import { IndexCoordinator } from '../src/services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../src/services/storage/StorageCoordinator';
import { ParserService } from '../src/services/parser/ParserService';
import { VectorStorageService } from '../src/services/storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../src/services/storage/graph/GraphPersistenceService';
import { QdrantClientWrapper } from '../src/database/qdrant/QdrantClientWrapper';
import { NebulaService } from '../src/database/NebulaService';
import { SnippetController } from '../src/controllers/SnippetController';
import { SearchCoordinator } from '../src/services/search/SearchCoordinator';
import { SemanticSearchService } from '../src/services/search/SemanticSearchService';
import { HybridSearchService } from '../src/services/search/HybridSearchService';
import { RerankingService } from '../src/services/reranking/RerankingService';
import { HashUtils } from '../src/utils/HashUtils';
import { PathUtils } from '../src/utils/PathUtils';
import { ConfigFactory } from '../src/config/ConfigFactory';
import { BatchProcessingMetrics } from '../src/services/monitoring/BatchProcessingMetrics';
import { ConcurrentProcessingService } from '../src/services/processing/ConcurrentProcessingService';
import { MemoryOptimizationService } from '../src/services/optimization/MemoryOptimizationService';
import { BatchPerformanceMonitor } from '../src/services/monitoring/BatchPerformanceMonitor';
import { BatchSizeConfigManager } from '../src/services/configuration/BatchSizeConfigManager';
import { BatchErrorRecoveryService } from '../src/services/recovery/BatchErrorRecoveryService';
import { TreeSitterService } from '../src/services/parser/TreeSitterService';
import { NebulaQueryBuilder } from '../src/database/nebula/NebulaQueryBuilder';
import { GraphDatabaseErrorHandler } from '../src/core/GraphDatabaseErrorHandler';
import { ErrorClassifier } from '../src/core/ErrorClassifier';
import { HashBasedDeduplicator } from '../src/services/deduplication/HashBasedDeduplicator';
import { GraphService } from '../src/services/graph/GraphService';
import { IGraphService } from '../src/services/graph/IGraphService';
import { HealthCheckService } from '../src/services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../src/services/monitoring/PerformanceAnalysisService';
import { PrometheusMetricsService } from '../src/services/monitoring/PrometheusMetricsService';
import { QueryCache } from '../src/services/query/QueryCache';
import { QueryCoordinationService } from '../src/services/query/QueryCoordinationService';
import { QueryOptimizer } from '../src/services/query/QueryOptimizer';
import { ResultFusionEngine } from '../src/services/query/ResultFusionEngine';
import { IRerankingService } from '../src/services/reranking/IRerankingService';
import { MLRerankingService } from '../src/services/reranking/MLRerankingService';
import { RealTimeLearningService } from '../src/services/reranking/RealTimeLearningService';
import { SimilarityAlgorithms } from '../src/services/reranking/SimilarityAlgorithms';
import { ConsistencyChecker } from '../src/services/sync/ConsistencyChecker';
import { HttpServer } from '../src/api/HttpServer';
import { MonitoringRoutes } from '../src/api/routes/MonitoringRoutes';
import { SnippetRoutes } from '../src/api/routes/SnippetRoutes';
import { MonitoringController } from '../src/controllers/MonitoringController';
import { MCPServer } from '../src/mcp/MCPServer';
import { DIContainer } from '../src/core/DIContainer';
import { QdrantService } from '../src/database/QdrantService';

// Load main .env file before any other setup
const mainEnvPath = path.join(process.cwd(), '.env');
dotenv.config({ path: mainEnvPath });

// Set up test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Use main .env file configuration instead of hardcoded values
  // All environment variables will be loaded from the main .env file
  
  // Override only specific test configurations if needed
  // These are kept for test environment stability
  process.env.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'test-key';
  process.env.MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-embed';
  
  // Custom embedding services configuration - use .env values or defaults
  process.env.CUSTOM_CUSTOM1_BASE_URL = process.env.CUSTOM_CUSTOM1_BASE_URL || 'http://localhost:8000';
  process.env.CUSTOM_CUSTOM2_BASE_URL = process.env.CUSTOM_CUSTOM2_BASE_URL || 'http://localhost:8001';
  process.env.CUSTOM_CUSTOM3_BASE_URL = process.env.CUSTOM_CUSTOM3_BASE_URL || 'http://localhost:8002';
  
  // siliconflow configuration - use .env values or defaults
  process.env.SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'test-key';
  process.env.SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL || 'http://localhost:8000';
  process.env.SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'siliconflow-embed';
  process.env.SILICONFLOW_DIMENSIONS = process.env.SILICONFLOW_DIMENSIONS || '1024';

  // Qdrant configuration - use .env values or defaults
  process.env.QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
  process.env.QDRANT_PORT = process.env.QDRANT_PORT || '6333';
  process.env.QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'code-snippets';
  
  // Nebula configuration - use .env values or defaults
  process.env.NEBULA_HOST = process.env.NEBULA_HOST || 'localhost';
  process.env.NEBULA_PORT = process.env.NEBULA_PORT || '9669';
  process.env.NEBULA_USERNAME = process.env.NEBULA_USERNAME || 'root';
  process.env.NEBULA_PASSWORD = process.env.NEBULA_PASSWORD || 'nebula';
  process.env.NEBULA_SPACE = process.env.NEBULA_SPACE || 'codegraph';
});

// Set up dependency injection container for tests
export const createTestContainer = () => {
  const container = new Container();
  
  // Mock LoggerService
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  
  container.bind<LoggerService>(LoggerService).toConstantValue(mockLogger as any);
  
  // Mock ErrorHandlerService with proper dependencies
  const mockErrorHandler = {
    handleError: jest.fn(),
    handleAsyncError: jest.fn(),
    wrapAsync: jest.fn().mockImplementation((fn) => fn),
    onError: jest.fn(),
    getErrorReports: jest.fn().mockReturnValue([]),
    markErrorHandled: jest.fn(),
    clearErrorReports: jest.fn(),
  };
  
  container.bind<ErrorHandlerService>(ErrorHandlerService).toConstantValue(mockErrorHandler as any);
  
  // Mock EntityIdManager for tests that need it
  container.bind<EntityIdManager>(EntityIdManager).toConstantValue({
    generateEntityId: jest.fn(),
    createMapping: jest.fn(),
    updateMapping: jest.fn(),
    getMapping: jest.fn(),
    getMappingsByProject: jest.fn(),
    deleteMapping: jest.fn(),
    getUnsyncedMappings: jest.fn(),
    getSyncStats: jest.fn(),
  } as any);
  
  // Mock ConfigService for tests that need it - use actual .env values
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'embedding') {
        return {
          provider: process.env.EMBEDDING_PROVIDER || 'siliconflow',
          openai: {
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
            model: process.env.OPENAI_MODEL || 'text-embedding-ada-002'
          },
          ollama: {
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'nomic-embed-text'
          },
          gemini: {
            apiKey: process.env.GEMINI_API_KEY || 'test-key',
            model: process.env.GEMINI_MODEL || 'embedding-001'
          },
          mistral: {
            apiKey: process.env.MISTRAL_API_KEY || 'test-key',
            model: process.env.MISTRAL_MODEL || 'mistral-embed'
          },
          siliconflow: {
            apiKey: process.env.SILICONFLOW_API_KEY || 'test-key',
            model: process.env.SILICONFLOW_MODEL || 'BAAI/bge-m3'
          },
          custom: {
            custom1: {
              apiKey: process.env.CUSTOM_CUSTOM1_API_KEY || 'test-key',
              baseUrl: process.env.CUSTOM_CUSTOM1_BASE_URL || 'http://localhost:8000',
              model: process.env.CUSTOM_CUSTOM1_MODEL || 'custom-model-1'
            },
            custom2: {
              apiKey: process.env.CUSTOM_CUSTOM2_API_KEY || 'test-key',
              baseUrl: process.env.CUSTOM_CUSTOM2_BASE_URL || 'http://localhost:8001',
              model: process.env.CUSTOM_CUSTOM2_MODEL || 'custom-model-2'
            },
            custom3: {
              apiKey: process.env.CUSTOM_CUSTOM3_API_KEY || 'test-key',
              baseUrl: process.env.CUSTOM_CUSTOM3_BASE_URL || 'http://localhost:8002',
              model: process.env.CUSTOM_CUSTOM3_MODEL || 'custom-model-3'
            }
          }
        };
      }
      return {};
    }),
    getAll: jest.fn().mockReturnValue({})
  };
  
  container.bind<ConfigService>(ConfigService).toConstantValue(mockConfig as any);
  
  // Create mock embedders
  
  // Create proper mock embedder classes that implement the Embedder interface
  class MockEmbedder {
    private name: string;
    
    constructor(name: string) {
      this.name = name;
    }
    
    async embed(input: any) {
      if (Array.isArray(input)) {
        return input.map((_, index) => ({
          vector: [0.1, 0.2, 0.3],
          dimensions: 1536,
          model: `${this.name}-test-model`,
          processingTime: 10 + index
        }));
      } else {
        return {
          vector: [0.1, 0.2, 0.3],
          dimensions: 1536,
          model: `${this.name}-test-model`,
          processingTime: 10
        };
      }
    }
    
    async isAvailable() {
      return true;
    }
    
    getModelName() {
      return `${this.name}-test-model`;
    }
    
    getDimensions() {
      return 1536;
    }
  }

  const createMockEmbedder = (name: string) => {
    return new MockEmbedder(name) as any;
  };
  
  // Bind mock embedders with proper interface binding
  const openaiMock = createMockEmbedder('openai');
  const ollamaMock = createMockEmbedder('ollama');
  const geminiMock = createMockEmbedder('gemini');
  const mistralMock = createMockEmbedder('mistral');
  const siliconflowMock = createMockEmbedder('siliconflow');
  const custom1Mock = createMockEmbedder('custom1');
  const custom2Mock = createMockEmbedder('custom2');
  const custom3Mock = createMockEmbedder('custom3');

  container.bind<OpenAIEmbedder>(OpenAIEmbedder).toConstantValue(openaiMock as any);
  container.bind<OllamaEmbedder>(OllamaEmbedder).toConstantValue(ollamaMock as any);
  container.bind<GeminiEmbedder>(GeminiEmbedder).toConstantValue(geminiMock as any);
  container.bind<MistralEmbedder>(MistralEmbedder).toConstantValue(mistralMock as any);
  container.bind<SiliconFlowEmbedder>(SiliconFlowEmbedder).toConstantValue(siliconflowMock as any);
  container.bind<Custom1Embedder>(Custom1Embedder).toConstantValue(custom1Mock as any);
  container.bind<Custom2Embedder>(Custom2Embedder).toConstantValue(custom2Mock as any);
  container.bind<Custom3Embedder>(Custom3Embedder).toConstantValue(custom3Mock as any);
  
  // Bind factory and dimension adapter
  container.bind<EmbedderFactory>(EmbedderFactory).toSelf().inSingletonScope();
  container.bind<DimensionAdapterService>(DimensionAdapterService).toSelf().inSingletonScope();
  
  // Bind memory management services
  container.bind<MemoryManager>(MemoryManager).toSelf().inSingletonScope();
  container.bind<MemoryManagerOptions>('MemoryManagerOptions').toConstantValue({
    checkInterval: 1000,
    thresholds: {
      warning: 90,
      critical: 95,
      emergency: 98
    },
    gcThreshold: 90,
    maxMemoryMB: 1024
  });
  
  // Bind processing services
  container.bind<BatchProcessor>(BatchProcessor).toSelf().inSingletonScope();
  container.bind<AsyncPipeline>(AsyncPipeline).toSelf().inSingletonScope();
  
  // Bind infrastructure services
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
  
  // Bind filesystem services
  container.bind<FileSystemTraversal>(FileSystemTraversal).toSelf().inSingletonScope();
  container.bind<TraversalOptions>('TraversalOptions').toConstantValue({});
  container.bind<SmartCodeParser>(SmartCodeParser).toSelf().inSingletonScope();
  container.bind<ChunkingOptions>('ChunkingOptions').toConstantValue({});
  container.bind<ChangeDetectionService>(ChangeDetectionService).toSelf().inSingletonScope();
  container.bind<ChangeDetectionOptions>('ChangeDetectionOptions').toConstantValue({});
  container.bind<EventQueueService>(EventQueueService).toSelf().inSingletonScope();
  container.bind<EventQueueOptions>('EventQueueOptions').toConstantValue({});
  
  // Bind core services
  container.bind<HashUtils>(HashUtils).toSelf().inSingletonScope();
  container.bind<PathUtils>(PathUtils).toSelf().inSingletonScope();
  container.bind<ConfigFactory>(ConfigFactory).toSelf().inSingletonScope();
  
  // Bind monitoring services
  container.bind<BatchProcessingMetrics>(BatchProcessingMetrics).toSelf().inSingletonScope();
  container.bind<ConcurrentProcessingService>(ConcurrentProcessingService).toSelf().inSingletonScope();
  container.bind<MemoryOptimizationService>(MemoryOptimizationService).toSelf().inSingletonScope();
  container.bind<BatchPerformanceMonitor>(BatchPerformanceMonitor).toSelf().inSingletonScope();
  container.bind<BatchSizeConfigManager>(BatchSizeConfigManager).toSelf().inSingletonScope();
  container.bind<BatchErrorRecoveryService>(BatchErrorRecoveryService).toSelf().inSingletonScope();
  
  // Bind parser services
  container.bind<TreeSitterService>(TreeSitterService).toSelf().inSingletonScope();
  
  // Bind database services
  container.bind<NebulaQueryBuilder>(NebulaQueryBuilder).toSelf().inSingletonScope();
  container.bind<GraphDatabaseErrorHandler>(GraphDatabaseErrorHandler).toSelf().inSingletonScope();
  container.bind<ErrorClassifier>(ErrorClassifier).toSelf().inSingletonScope();
  
  // Bind deduplication services
  container.bind<HashBasedDeduplicator>(HashBasedDeduplicator).toSelf().inSingletonScope();
  
  // Bind graph services
  container.bind<GraphService>(GraphService).toSelf().inSingletonScope();
  container.bind<IGraphService>('IGraphService').toService(GraphService);
  
  // Bind monitoring services
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
  
  // Bind sync services
  container.bind<ConsistencyChecker>(ConsistencyChecker).toSelf().inSingletonScope();
  
  // Bind API services
  container.bind<HttpServer>(HttpServer).toSelf().inSingletonScope();
  container.bind<MonitoringRoutes>(MonitoringRoutes).toSelf().inSingletonScope();
  container.bind<SnippetRoutes>(SnippetRoutes).toSelf().inSingletonScope();
  
  // Bind controller services
  container.bind<MonitoringController>(MonitoringController).toSelf().inSingletonScope();
  container.bind<SnippetController>(SnippetController).toSelf().inSingletonScope();
  
  // Bind MCP services
  container.bind<MCPServer>(MCPServer).toSelf().inSingletonScope();
  
  // Bind core services
  container.bind<DIContainer>(DIContainer).toSelf().inSingletonScope();
  
  // Bind database services
  container.bind<QdrantService>(QdrantService).toSelf().inSingletonScope();
  
  // Bind indexing services
  container.bind<IndexService>(IndexService).toSelf().inSingletonScope();
  container.bind<IndexCoordinator>(IndexCoordinator).toSelf().inSingletonScope();
  container.bind<StorageCoordinator>(StorageCoordinator).toSelf().inSingletonScope();
  container.bind<ParserService>(ParserService).toSelf().inSingletonScope();
  container.bind<VectorStorageService>(VectorStorageService).toSelf().inSingletonScope();
  container.bind<GraphPersistenceService>(GraphPersistenceService).toSelf().inSingletonScope();
  container.bind<QdrantClientWrapper>(QdrantClientWrapper).toSelf().inSingletonScope();
  container.bind<NebulaService>(NebulaService).toSelf().inSingletonScope();
  
  // Bind search services
  container.bind<SearchCoordinator>(SearchCoordinator).toSelf().inSingletonScope();
  container.bind<SemanticSearchService>(SemanticSearchService).toSelf().inSingletonScope();
  container.bind<HybridSearchService>(HybridSearchService).toSelf().inSingletonScope();
  container.bind<RerankingService>(RerankingService).toSelf().inSingletonScope();
  
  // Bind sync services
  container.bind<TransactionCoordinator>(TransactionCoordinator).toSelf().inSingletonScope();
  container.bind<EntityMappingService>(EntityMappingService).toSelf().inSingletonScope();
  
  return container;
};

// Global test utilities
export const createMockEntityMapping = (overrides = {}) => ({
  entityId: 'test_entity_1',
  entityType: 'file',
  projectId: 'test_project',
  vectorId: 'vector_test_entity_1',
  graphId: 'graph_test_entity_1',
  lastSynced: new Date(),
  syncStatus: 'synced' as const,
  ...overrides,
});

export const createMockConsistencyIssue = (overrides = {}) => ({
  id: 'issue_1',
  type: 'missing_vector' as const,
  entityId: 'test_entity_1',
  entityType: 'file',
  projectId: 'test_project',
  severity: 'medium' as const,
  description: 'Test issue',
  detectedAt: new Date(Date.now() - Math.random() * 1000000), // Random timestamp in the past
  ...overrides,
});

export const createMockSyncOperation = (overrides = {}) => ({
  id: 'op_1',
  type: 'create' as const,
  entityType: 'file',
  entityId: 'test_entity_1',
  projectId: 'test_project',
  timestamp: new Date(),
  status: 'pending' as const,
  ...overrides,
});

export const createMockTransaction = (overrides = {}) => ({
  id: 'tx_1',
  projectId: 'test_project',
  steps: [],
  status: 'pending' as const,
  createdAt: new Date(),
  completedAt: undefined,
  error: undefined,
  ...overrides,
});

// Clean up after all tests
afterAll(() => {
  // Clean up any global state if needed
  // 清理所有挂起的定时器
  jest.useRealTimers();
  jest.clearAllTimers();
});