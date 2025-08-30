import { EntityMappingService } from '../EntityMappingService';
import { EntityIdManager, EntityMapping } from '../EntityIdManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../../core/ErrorHandlerService'; // Keep this import for toBeInstanceOf
import { createMockEntityMapping, createMockSyncOperation } from '@test/setup';

// Mock dependencies
jest.mock('../../src/core/LoggerService');
jest.mock('../../src/services/sync/EntityIdManager');
// Removed: jest.mock('../../src/core/ErrorHandlerService'); to allow actual CodebaseIndexError to be used

describe('EntityMappingService', () => {
  let entityMappingService: EntityMappingService;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEntityIdManager: jest.Mocked<EntityIdManager>;
  let mockMapping: EntityMapping;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockEntityIdManager = {
      generateEntityId: jest.fn(),
      createMapping: jest.fn(),
      updateMapping: jest.fn(),
      getMapping: jest.fn(),
      deleteMapping: jest.fn(),
      getUnsyncedMappings: jest.fn(),
      getSyncStats: jest.fn(),
    } as any;

    // Create test mapping
    mockMapping = createMockEntityMapping({
      entityId: 'entity_1',
      entityType: 'file',
      projectId: 'test_project',
      vectorId: 'vector_1',
      graphId: 'graph_1',
      syncStatus: 'synced',
    });

    // Setup mock return values
    mockEntityIdManager.generateEntityId.mockReturnValue('generated_entity_id');
    mockEntityIdManager.getMapping.mockReturnValue(mockMapping);
    mockEntityIdManager.createMapping.mockImplementation((entityId, entityType, projectId, vectorId, graphId) => ({
      entityId,
      entityType,
      projectId,
      vectorId,
      graphId,
      lastSynced: new Date(),
      syncStatus: vectorId && graphId ? 'synced' : vectorId ? 'vector_only' : graphId ? 'graph_only' : 'conflict'
    }));
    mockEntityIdManager.updateMapping.mockImplementation((entityId, updates) => {
      const existingMapping = mockEntityIdManager.getMapping(entityId);
      if (!existingMapping) return null;
      
      return {
        ...existingMapping,
        ...updates,
        lastSynced: new Date(),
        syncStatus: updates.vectorId !== undefined || updates.graphId !== undefined
          ? (updates.vectorId && updates.graphId ? 'synced' : updates.vectorId ? 'vector_only' : updates.graphId ? 'graph_only' : 'conflict')
          : existingMapping.syncStatus
      };
    });

    // Create EntityMappingService instance
    entityMappingService = new EntityMappingService(
      mockLoggerService,
      mockErrorHandlerService,
      mockEntityIdManager
    );
  });

  describe('createEntity', () => {
    it('should create entity with vector and graph data', async () => {
      const entityType = 'file';
      const projectId = 'test_project';
      const vectorData = { content: 'test content' };
      const graphData = { nodes: [] };

      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        vectorData,
        graphData
      );

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_generated_entity_id',
        graphId: 'graph_generated_entity_id',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.generateEntityId).toHaveBeenCalledWith(entityType, projectId);
      expect(mockEntityIdManager.createMapping).toHaveBeenCalledWith(
        'generated_entity_id',
        entityType,
        projectId,
        'vector_generated_entity_id',
        'graph_generated_entity_id'
      );

      expect(mockLoggerService.info).toHaveBeenCalledWith('Queued entity creation', {
        operationId: expect.any(String),
        entityId: 'generated_entity_id',
        entityType,
      });
    });

    it('should create entity with only vector data', async () => {
      const entityType = 'file';
      const projectId = 'test_project';
      const vectorData = { content: 'test content' };

      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        vectorData
      );

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_generated_entity_id',
        graphId: undefined,
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.createMapping).toHaveBeenCalledWith(
        'generated_entity_id',
        entityType,
        projectId,
        'vector_generated_entity_id',
        undefined
      );
    });

    it('should create entity with only graph data', async () => {
      const entityType = 'file';
      const projectId = 'test_project';
      const graphData = { nodes: [] };

      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        undefined,
        graphData
      );

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: undefined,
        graphId: 'graph_generated_entity_id',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.createMapping).toHaveBeenCalledWith(
        'generated_entity_id',
        entityType,
        projectId,
        undefined,
        'graph_generated_entity_id'
      );
    });

    it('should handle creation failure', async () => {
      const entityType = 'file';
      const projectId = 'test_project';
      const error = new Error('Creation failed');

      // Make createMapping throw an error
      mockEntityIdManager.createMapping.mockImplementation(() => {
        throw error;
      });

      await expect(entityMappingService.createEntity(entityType, projectId))
        .rejects.toThrow(error);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Queued entity creation', {
        operationId: expect.any(String),
        entityId: 'generated_entity_id',
        entityType,
      });
    });
  });

  describe('updateEntity', () => {
    it('should update entity with vector data', async () => {
      const entityId = 'entity_1';
      const updates = { vectorData: { content: 'updated content' } };

      const result = await entityMappingService.updateEntity(entityId, updates);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_entity_1',
        graphId: 'graph_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.getMapping).toHaveBeenCalledWith(entityId);
      expect(mockEntityIdManager.updateMapping).toHaveBeenCalledWith(entityId, {
        vectorId: 'vector_entity_1',
        graphId: 'graph_1',
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Queued entity update', {
        operationId: expect.any(String),
        entityId,
      });
    });

    it('should update entity with graph data', async () => {
      const entityId = 'entity_1';
      const updates = { graphData: { nodes: [] } };

      const result = await entityMappingService.updateEntity(entityId, updates);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_1',
        graphId: 'graph_entity_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.updateMapping).toHaveBeenCalledWith(entityId, {
        vectorId: 'vector_1',
        graphId: 'graph_entity_1',
      });
    });

    it('should update entity with both vector and graph data', async () => {
      const entityId = 'entity_1';
      const updates = {
        vectorData: { content: 'updated content' },
        graphData: { nodes: [] },
      };

      const result = await entityMappingService.updateEntity(entityId, updates);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_entity_1',
        graphId: 'graph_entity_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.updateMapping).toHaveBeenCalledWith(entityId, {
        vectorId: 'vector_entity_1',
        graphId: 'graph_entity_1',
      });
    });

    it('should throw error when entity not found', async () => {
      const entityId = 'nonexistent_entity';
      const updates = { vectorData: { content: 'updated content' } };

      mockEntityIdManager.getMapping.mockReturnValue(null);

      // Direct try/catch to bypass Jest's rejects.toThrow issues
      try {
        await entityMappingService.updateEntity(entityId, updates);
        // If we reach here, no error was thrown, which is unexpected
        fail('Expected updateEntity to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CodebaseIndexError);
        const codebaseError = error as CodebaseIndexError; // Type assertion
        expect(codebaseError.message).toMatch(/Entity not found: nonexistent_entity/);
      }
    });

    it('should handle update failure', async () => {
      const entityId = 'entity_1';
      const updates = { vectorData: { content: 'updated content' } };
      const error = new Error('Update failed');

      mockEntityIdManager.updateMapping.mockImplementation(() => {
        throw error;
      });

      await expect(entityMappingService.updateEntity(entityId, updates))
        .rejects.toThrow(error);
    });
  });

  describe('deleteEntity', () => {
    it('should delete entity successfully', async () => {
      const entityId = 'entity_1';

      const result = await entityMappingService.deleteEntity(entityId);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.getMapping).toHaveBeenCalledWith(entityId);
      expect(mockEntityIdManager.deleteMapping).toHaveBeenCalledWith(entityId);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Queued entity deletion', {
        operationId: expect.any(String),
        entityId,
      });
    });

    it('should throw error when entity not found', async () => {
      const entityId = 'nonexistent_entity';

      mockEntityIdManager.getMapping.mockReturnValue(null);

      try {
        await entityMappingService.deleteEntity(entityId);
        fail('Expected deleteEntity to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CodebaseIndexError);
        expect((error as CodebaseIndexError).message).toMatch(/Entity not found: nonexistent_entity/);
      }
    });

    it('should handle deletion failure', async () => {
      const entityId = 'entity_1';
      const error = new Error('Deletion failed');

      mockEntityIdManager.deleteMapping.mockImplementation(() => {
        throw error;
      });

      await expect(entityMappingService.deleteEntity(entityId))
        .rejects.toThrow(error);
    });
  });

  describe('syncEntity', () => {
    it('should sync entity with vector_only status', async () => {
      const entityId = 'entity_1';
      const mappingWithVectorOnly = {
        ...mockMapping,
        syncStatus: 'vector_only' as const,
      };

      mockEntityIdManager.getMapping.mockReturnValue(mappingWithVectorOnly);

      const result = await entityMappingService.syncEntity(entityId);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_1',
        graphId: 'graph_1',
        timestamp: expect.any(Date),
      });
    });

    it('should sync entity with graph_only status', async () => {
      const entityId = 'entity_1';
      const mappingWithGraphOnly = {
        ...mockMapping,
        syncStatus: 'graph_only' as const,
      };

      mockEntityIdManager.getMapping.mockReturnValue(mappingWithGraphOnly);

      const result = await entityMappingService.syncEntity(entityId);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_1',
        graphId: 'graph_1',
        timestamp: expect.any(Date),
      });
    });

    it('should sync entity with conflict status', async () => {
      const entityId = 'entity_1';
      const mappingWithConflict = {
        ...mockMapping,
        syncStatus: 'conflict' as const,
      };

      mockEntityIdManager.getMapping.mockReturnValue(mappingWithConflict);

      const result = await entityMappingService.syncEntity(entityId);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        vectorId: 'vector_1',
        graphId: 'graph_1',
        timestamp: expect.any(Date),
      });
    });

    it('should return success when entity is already synced', async () => {
      const entityId = 'entity_1';
      const syncedMapping = {
        ...mockMapping,
        syncStatus: 'synced' as const,
      };

      mockEntityIdManager.getMapping.mockReturnValue(syncedMapping);

      const result = await entityMappingService.syncEntity(entityId);

      expect(result).toEqual({
        operationId: expect.any(String),
        success: true,
        timestamp: expect.any(Date),
      });
    });

    it('should throw error when entity not found', async () => {
      const entityId = 'nonexistent_entity';

      mockEntityIdManager.getMapping.mockReturnValue(null);

      try {
        await entityMappingService.syncEntity(entityId);
        fail('Expected syncEntity to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CodebaseIndexError);
        expect((error as CodebaseIndexError).message).toMatch(/Entity not found: nonexistent_entity/);
      }
    });

    it('should handle sync failure', async () => {
      const entityId = 'entity_1';
      const mappingWithVectorOnly = {
        ...mockMapping,
        syncStatus: 'vector_only' as const,
      };

      mockEntityIdManager.getMapping.mockReturnValue(mappingWithVectorOnly);
      
      // Make the operation fail
      jest.spyOn(entityMappingService as any, 'executeOperation').mockImplementationOnce(() => {
        throw new Error('Sync failed');
      });

      await expect(entityMappingService.syncEntity(entityId))
        .rejects.toThrow('Sync failed');
    });
  });

  describe('syncProject', () => {
    it('should sync all unsynced entities in project', async () => {
      const projectId = 'test_project';
      const unsyncedMappings = [
        {
          ...mockMapping,
          entityId: 'entity_1',
          syncStatus: 'vector_only' as const,
        },
        {
          ...mockMapping,
          entityId: 'entity_2',
          syncStatus: 'graph_only' as const,
        },
      ];

      mockEntityIdManager.getUnsyncedMappings.mockReturnValue(unsyncedMappings);

      const results = await entityMappingService.syncProject(projectId);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting project sync', {
        projectId,
        entityCount: 2,
      });
    });

    it('should handle sync failures gracefully', async () => {
      const projectId = 'test_project';
      const unsyncedMappings = [
        {
          ...mockMapping,
          entityId: 'entity_1',
          syncStatus: 'vector_only' as const,
        },
        {
          ...mockMapping,
          entityId: 'entity_2',
          syncStatus: 'graph_only' as const,
        },
      ];

      mockEntityIdManager.getUnsyncedMappings.mockReturnValue(unsyncedMappings);

      // Make one sync fail
      jest.spyOn(entityMappingService, 'syncEntity').mockImplementationOnce(async () => {
        throw new Error('Sync failed');
      });

      const results = await entityMappingService.syncProject(projectId);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to sync entity',
        expect.objectContaining({
          entityId: 'entity_1',
          error: expect.any(Error),
        })
      );
    });

    it('should handle empty project', async () => {
      const projectId = 'empty_project';
      mockEntityIdManager.getUnsyncedMappings.mockReturnValue([]);

      const results = await entityMappingService.syncProject(projectId);

      expect(results).toHaveLength(0);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting project sync', {
        projectId,
        entityCount: 0,
      });
    });
  });

  describe('createBatch', () => {
    it('should create batch with multiple operations', async () => {
      const projectId = 'test_project';
      const operations = [
        {
          type: 'create' as const,
          entityType: 'file',
          entityId: 'entity_1',
          vectorData: { content: 'test' },
        },
        {
          type: 'update' as const,
          entityType: 'function',
          entityId: 'entity_2',
          graphData: { nodes: [] },
        },
      ];

      const operationsWithProjectId = operations.map(op => ({ ...op, projectId }));
      const batch = await entityMappingService.createBatch(projectId, operationsWithProjectId);

      expect(batch).toEqual({
        id: expect.any(String),
        projectId,
        operations: expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            entityType: 'file',
            entityId: 'entity_1',
            projectId,
            vectorData: { content: 'test' },
            status: 'pending',
          }),
          expect.objectContaining({
            type: 'update',
            entityType: 'function',
            entityId: 'entity_2',
            projectId,
            graphData: { nodes: [] },
            status: 'pending',
          }),
        ]),
        createdAt: expect.any(Date),
        status: 'pending',
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Created sync batch', {
        batchId: batch.id,
        operationCount: 2,
      });
    });

    it('should create batch with single operation', async () => {
      const projectId = 'test_project';
      const operations = [
        {
          type: 'delete' as const,
          entityType: 'class',
          entityId: 'entity_1',
        },
      ];

      const operationsWithProjectId = operations.map(op => ({ ...op, projectId }));
      const batch = await entityMappingService.createBatch(projectId, operationsWithProjectId);

      expect(batch.operations).toHaveLength(1);
      expect(batch.operations[0]).toEqual(
        expect.objectContaining({
          type: 'delete',
          entityType: 'class',
          entityId: 'entity_1',
          projectId,
          status: 'pending',
        })
      );
    });

    it('should create batch with empty operations', async () => {
      const projectId = 'test_project';
      const operations: any[] = [];

      const batch = await entityMappingService.createBatch(projectId, operations);

      expect(batch.operations).toHaveLength(0);
    });
  });

  describe('executeBatch', () => {
    it('should execute batch successfully', async () => {
      const batchId = 'batch_1';
      const operations = [
        createMockSyncOperation({
          id: 'op_1',
          type: 'create',
          entityId: 'entity_1',
        }),
        createMockSyncOperation({
          id: 'op_2',
          type: 'update',
          entityId: 'entity_2',
        }),
      ];

      // Mock the batch retrieval
      jest.spyOn(entityMappingService as any, 'getBatch').mockResolvedValue({
        id: batchId,
        projectId: 'test_project',
        operations,
        createdAt: new Date(),
        status: 'pending',
      });

      const results = await entityMappingService.executeBatch(batchId);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Batch execution completed', {
        batchId,
        successCount: 2,
      });
    });

    it('should handle batch execution failures', async () => {
      const batchId = 'batch_1';
      const operations = [
        createMockSyncOperation({
          id: 'op_1',
          type: 'create',
          entityId: 'entity_1',
        }),
        createMockSyncOperation({
          id: 'op_2',
          type: 'update',
          entityId: 'entity_2',
        }),
      ];

      // Mock the batch retrieval
      jest.spyOn(entityMappingService as any, 'getBatch').mockResolvedValue({
        id: batchId,
        projectId: 'test_project',
        operations,
        createdAt: new Date(),
        status: 'pending',
      });

      // Make one operation fail
      jest.spyOn(entityMappingService as any, 'executeOperation').mockImplementationOnce(async () => {
        throw new Error('Operation failed');
      });

      const results = await entityMappingService.executeBatch(batchId);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Batch operation failed',
        expect.objectContaining({
          operationId: 'op_1',
          error: expect.any(Error),
        })
      );
    });

    it('should throw error when batch not found', async () => {
      const batchId = 'nonexistent_batch';

      // Mock the batch retrieval to return null
      jest.spyOn(entityMappingService as any, 'getBatch').mockResolvedValue(null);

      try {
        await entityMappingService.executeBatch(batchId);
        fail('Expected executeBatch to throw an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CodebaseIndexError);
        expect((error as CodebaseIndexError).message).toMatch(/Batch not found: nonexistent_batch/);
      }
    });
  });

  describe('getPendingOperations', () => {
    it('should return all pending operations', () => {
      const pendingOperations = [
        createMockSyncOperation({ id: 'op_1' }),
        createMockSyncOperation({ id: 'op_2' }),
      ];

      // Set pending operations
      (entityMappingService as any).pendingOperations = new Map([
        ['op_1', pendingOperations[0]],
        ['op_2', pendingOperations[1]],
      ]);

      const result = entityMappingService.getPendingOperations();

      expect(result).toEqual(pendingOperations);
    });

    it('should return empty array when no pending operations', () => {
      // Set empty pending operations
      (entityMappingService as any).pendingOperations = new Map();

      const result = entityMappingService.getPendingOperations();

      expect(result).toEqual([]);
    });
  });

  describe('getOperationHistory', () => {
    it('should return operation history with default limit', () => {
      const operationHistory = [
        createMockSyncOperation({ id: 'op_1' }),
        createMockSyncOperation({ id: 'op_2' }),
      ];

      // Set operation history
      (entityMappingService as any).operationHistory = operationHistory;

      const result = entityMappingService.getOperationHistory();

      expect(result).toEqual(operationHistory);
    });

    it('should respect the limit parameter', () => {
      const operationHistory = [
        createMockSyncOperation({ id: 'op_1' }),
        createMockSyncOperation({ id: 'op_2' }),
        createMockSyncOperation({ id: 'op_3' }),
      ];

      // Set operation history
      (entityMappingService as any).operationHistory = operationHistory;

      const result = entityMappingService.getOperationHistory(2);

      expect(result).toEqual(operationHistory.slice(-2));
    });

    it('should handle empty operation history', () => {
      // Set empty operation history
      (entityMappingService as any).operationHistory = [];

      const result = entityMappingService.getOperationHistory();

      expect(result).toEqual([]);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync stats for all projects', () => {
      const stats = {
        total: 10,
        synced: 5,
        vectorOnly: 3,
        graphOnly: 1,
        conflicts: 1,
      };

      mockEntityIdManager.getSyncStats.mockReturnValue(stats);

      const result = entityMappingService.getSyncStats();

      expect(result).toEqual(stats);
      expect(mockEntityIdManager.getSyncStats).toHaveBeenCalledWith(undefined);
    });

    it('should return sync stats for specific project', () => {
      const projectId = 'test_project';
      const stats = {
        total: 5,
        synced: 3,
        vectorOnly: 1,
        graphOnly: 1,
        conflicts: 0,
      };

      mockEntityIdManager.getSyncStats.mockReturnValue(stats);

      const result = entityMappingService.getSyncStats(projectId);

      expect(result).toEqual(stats);
      expect(mockEntityIdManager.getSyncStats).toHaveBeenCalledWith(projectId);
    });
  });
});