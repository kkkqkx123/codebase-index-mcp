import { Container } from 'inversify';
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

// Set up test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
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
  
  // Mock ConfigService for tests that need it
  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'embedding') {
        return {
          provider: 'openai',
          openai: {
            apiKey: 'test-key',
            model: 'text-embedding-ada-002'
          },
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text'
          },
          gemini: {
            apiKey: 'test-key',
            model: 'embedding-001'
          },
          mistral: {
            apiKey: 'test-key',
            model: 'mistral-embed'
          },
          siliconflow: {
            apiKey: 'test-key',
            model: 'BAAI/bge-large-en-v1.5'
          },
          custom: {
            custom1: {
              apiKey: 'test-key',
              baseUrl: 'http://localhost:8000',
              model: 'custom-model-1'
            },
            custom2: {
              apiKey: 'test-key',
              baseUrl: 'http://localhost:8001',
              model: 'custom-model-2'
            },
            custom3: {
              apiKey: 'test-key',
              baseUrl: 'http://localhost:8002',
              model: 'custom-model-3'
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
  const createMockEmbedder = (name: string, available: boolean = true) => ({
    embed: jest.fn().mockImplementation((input: any) => {
      // If the embedder is not available, throw an error
      if (!available) {
        throw new Error(`${name} embedder is not available`);
      }
      
      if (Array.isArray(input)) {
        return input.map((_, index) => ({
          vector: [0.1, 0.2, 0.3],
          dimensions: 1536,
          model: `${name}-test-model`,
          processingTime: 10 + index
        }));
      } else {
        return {
          vector: [0.1, 0.2, 0.3],
          dimensions: 1536,
          model: `${name}-test-model`,
          processingTime: 10
        };
      }
    }),
    isAvailable: jest.fn().mockResolvedValue(available),
    getModelName: jest.fn().mockReturnValue(`${name}-test-model`),
    getDimensions: jest.fn().mockReturnValue(1536)
  });
  
  // Bind mock embedders
  container.bind<OpenAIEmbedder>(OpenAIEmbedder).toConstantValue(createMockEmbedder('openai') as any);
  container.bind<OllamaEmbedder>(OllamaEmbedder).toConstantValue(createMockEmbedder('ollama') as any);
  container.bind<GeminiEmbedder>(GeminiEmbedder).toConstantValue(createMockEmbedder('gemini') as any);
  container.bind<MistralEmbedder>(MistralEmbedder).toConstantValue(createMockEmbedder('mistral') as any);
  container.bind<SiliconFlowEmbedder>(SiliconFlowEmbedder).toConstantValue(createMockEmbedder('siliconflow') as any);
  container.bind<Custom1Embedder>(Custom1Embedder).toConstantValue(createMockEmbedder('custom1') as any);
  container.bind<Custom2Embedder>(Custom2Embedder).toConstantValue(createMockEmbedder('custom2') as any);
  container.bind<Custom3Embedder>(Custom3Embedder).toConstantValue(createMockEmbedder('custom3') as any);
  
  // Bind factory and dimension adapter
  container.bind<EmbedderFactory>(EmbedderFactory).toSelf();
  container.bind<DimensionAdapterService>(DimensionAdapterService).toSelf();
  
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