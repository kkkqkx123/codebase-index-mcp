import { Container } from 'inversify';
import { LoggerService } from '../src/services/core/LoggerService';
import { ErrorHandlerService } from '../src/services/core/ErrorHandlerService';
import { EntityIdManager } from '../src/services/sync/EntityIdManager';

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
  container.bind<LoggerService>(LoggerService).toConstantValue({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any);
  
  // Mock ErrorHandlerService
  container.bind<ErrorHandlerService>(ErrorHandlerService).toConstantValue({
    handleError: jest.fn(),
  } as any);
  
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
  detectedAt: new Date(),
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
  ...overrides,
});

// Clean up after all tests
afterAll(() => {
  // Clean up any global state if needed
});