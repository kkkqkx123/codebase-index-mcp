import { ConsistencyChecker } from '../../src/services/sync/ConsistencyChecker';
import { EntityMappingService } from '../../src/services/sync/EntityMappingService';
import { TransactionCoordinator } from '../../src/services/sync/TransactionCoordinator';
import { EntityIdManager, EntityMapping } from '../../src/services/sync/EntityIdManager';
import { LoggerService } from '../../src/services/core/LoggerService';
import { ErrorHandlerService } from '../../src/services/core/ErrorHandlerService';
import { Container } from 'inversify';
import { createTestContainer, createMockEntityMapping } from '../setup';

// Mock database services for integration testing
class MockVectorStorageService {
  private chunks: Map<string, any> = new Map();
  private shouldFail = false;

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  async storeChunks(chunks: any[], options?: any): Promise<string[]> {
    if (this.shouldFail) {
      throw new Error('Vector storage failed');
    }

    const chunkIds = chunks.map(chunk => `vector_${chunk.id}`);
    chunks.forEach((chunk, index) => {
      this.chunks.set(chunkIds[index], { ...chunk, storedAt: new Date() });
    });
    return chunkIds;
  }

  async deleteChunks(chunkIds: string[]): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error('Vector deletion failed');
    }

    chunkIds.forEach(id => this.chunks.delete(id));
    return true;
  }

  async getChunk(chunkId: string): Promise<any | null> {
    return this.chunks.get(chunkId) || null;
  }

  hasChunk(chunkId: string): boolean {
    return this.chunks.has(chunkId);
  }

  getStoredChunks(): any[] {
    return Array.from(this.chunks.values());
  }

  clear() {
    this.chunks.clear();
  }
}

class MockGraphPersistenceService {
  private nodes: Map<string, any> = new Map();
  private shouldFail = false;

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  async storeChunks(chunks: any[], options?: any): Promise<string[]> {
    if (this.shouldFail) {
      throw new Error('Graph storage failed');
    }

    const nodeIds = chunks.map(chunk => `graph_${chunk.id}`);
    chunks.forEach((chunk, index) => {
      this.nodes.set(nodeIds[index], { ...chunk, storedAt: new Date() });
    });
    return nodeIds;
  }

  async deleteNodes(nodeIds: string[]): Promise<boolean> {
    if (this.shouldFail) {
      throw new Error('Graph deletion failed');
    }

    nodeIds.forEach(id => this.nodes.delete(id));
    return true;
  }

  async getNode(nodeId: string): Promise<any | null> {
    return this.nodes.get(nodeId) || null;
  }

  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  getStoredNodes(): any[] {
    return Array.from(this.nodes.values());
  }

  clear() {
    this.nodes.clear();
  }
}

describe('Cross-Database Consistency Integration Tests', () => {
  let container: Container;
  let consistencyChecker: ConsistencyChecker;
  let entityMappingService: EntityMappingService;
  let transactionCoordinator: TransactionCoordinator;
  let entityIdManager: EntityIdManager;
  let vectorStorage: MockVectorStorageService;
  let graphStorage: MockGraphPersistenceService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;

  beforeEach(() => {
    // Reset all services
    container = createTestContainer();
    
    // Create mock services
    vectorStorage = new MockVectorStorageService();
    graphStorage = new MockGraphPersistenceService();
    
    // Create real instances with mocked dependencies
    loggerService = container.get(LoggerService);
    errorHandlerService = container.get(ErrorHandlerService);
    entityIdManager = new EntityIdManager(loggerService, errorHandlerService);
    
    // Create service instances
    consistencyChecker = new ConsistencyChecker(
      loggerService,
      errorHandlerService,
      entityIdManager
    );
    
    entityMappingService = new EntityMappingService(
      loggerService,
      errorHandlerService,
      entityIdManager
    );
    
    transactionCoordinator = new TransactionCoordinator(
      loggerService,
      errorHandlerService,
      entityMappingService
    );

    // Clear all storage
    vectorStorage.clear();
    graphStorage.clear();
  });

  describe('Entity Creation and Consistency', () => {
    it('should maintain consistency when creating entities with both vector and graph data', async () => {
      const projectId = 'test_project';
      const entityType = 'file';
      const vectorData = { id: 'file1', content: 'test content', type: 'file' };
      const graphData = { id: 'file1', nodes: [{ id: 'file1', type: 'file' }] };

      // Create entity with both vector and graph data
      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        vectorData,
        graphData
      );

      expect(result.success).toBe(true);
      expect(result.vectorId).toBeDefined();
      expect(result.graphId).toBeDefined();

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should detect and report missing vector data', async () => {
      const projectId = 'test_project';
      const entityType = 'file';
      const graphData = { id: 'file1', nodes: [{ id: 'file1', type: 'file' }] };

      // Create entity with only graph data
      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        undefined,
        graphData
      );

      expect(result.success).toBe(true);
      expect(result.vectorId).toBeUndefined();
      expect(result.graphId).toBeDefined();

      // Check consistency - should detect missing vector
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);
      expect(consistencyResult.issues[0].type).toBe('missing_vector');
    });

    it('should detect and report missing graph data', async () => {
      const projectId = 'test_project';
      const entityType = 'file';
      const vectorData = { id: 'file1', content: 'test content', type: 'file' };

      // Create entity with only vector data
      const result = await entityMappingService.createEntity(
        entityType,
        projectId,
        vectorData,
        undefined
      );

      expect(result.success).toBe(true);
      expect(result.vectorId).toBeDefined();
      expect(result.graphId).toBeUndefined();

      // Check consistency - should detect missing graph
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);
      expect(consistencyResult.issues[0].type).toBe('missing_graph');
    });

    it('should repair missing vector data', async () => {
      const projectId = 'test_project';
      const entityType = 'file';
      const graphData = { id: 'file1', nodes: [{ id: 'file1', type: 'file' }] };

      // Create entity with only graph data
      await entityMappingService.createEntity(entityType, projectId, undefined, graphData);

      // Check consistency - should detect missing vector
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);
      expect(consistencyResult.issues[0].type).toBe('missing_vector');

      // Repair the issue
      const issue = consistencyResult.issues[0];
      const repairResult = await consistencyChecker.repairIssue(issue.id);

      expect(repairResult.success).toBe(true);
      expect(repairResult.action).toBe('created_vector_data');

      // Check consistency again - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should repair missing graph data', async () => {
      const projectId = 'test_project';
      const entityType = 'file';
      const vectorData = { id: 'file1', content: 'test content', type: 'file' };

      // Create entity with only vector data
      await entityMappingService.createEntity(entityType, projectId, vectorData, undefined);

      // Check consistency - should detect missing graph
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);
      expect(consistencyResult.issues[0].type).toBe('missing_graph');

      // Repair the issue
      const issue = consistencyResult.issues[0];
      const repairResult = await consistencyChecker.repairIssue(issue.id);

      expect(repairResult.success).toBe(true);
      expect(repairResult.action).toBe('created_graph_data');

      // Check consistency again - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });
  });

  describe('Transaction Coordination Across Databases', () => {
    it('should coordinate operations across vector and graph databases', async () => {
      const projectId = 'test_project';
      const vectorOperation = {
        type: 'storeChunks' as const,
        chunks: [{ id: 'chunk1', content: 'test content' }],
        options: { projectId }
      };
      const graphOperation = {
        type: 'storeChunks' as const,
        chunks: [{ id: 'chunk1', nodes: [{ id: 'chunk1', type: 'chunk' }] }],
        options: { projectId }
      };

      // Execute transaction with both vector and graph operations
      const result = await transactionCoordinator.executeTransaction(projectId, [
        {
          type: 'vector',
          operation: vectorOperation,
          compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] }
        },
        {
          type: 'graph',
          operation: graphOperation,
          compensatingOperation: { type: 'deleteNodes', nodeIds: ['chunk1'] }
        }
      ]);

      expect(result.success).toBe(true);
      expect(result.executedSteps).toBe(2);

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should rollback all operations on failure', async () => {
      const projectId = 'test_project';
      const vectorOperation = {
        type: 'storeChunks' as const,
        chunks: [{ id: 'chunk1', content: 'test content' }],
        options: { projectId }
      };
      const graphOperation = {
        type: 'storeChunks' as const,
        chunks: [{ id: 'chunk1', nodes: [{ id: 'chunk1', type: 'chunk' }] }],
        options: { projectId }
      };

      // Make vector storage fail
      vectorStorage.setShouldFail(true);

      // Execute transaction - should fail and rollback
      const result = await transactionCoordinator.executeTransaction(projectId, [
        {
          type: 'vector',
          operation: vectorOperation,
          compensatingOperation: { type: 'deleteChunks', chunkIds: ['chunk1'] }
        },
        {
          type: 'graph',
          operation: graphOperation,
          compensatingOperation: { type: 'deleteNodes', nodeIds: ['chunk1'] }
        }
      ]);

      expect(result.success).toBe(false);
      expect(result.executedSteps).toBeLessThan(2);

      // Reset failure flag
      vectorStorage.setShouldFail(false);

      // Check consistency - should be no data stored
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should handle complex multi-step transactions', async () => {
      const projectId = 'test_project';
      
      // Begin transaction
      const transactionId = await transactionCoordinator.beginTransaction();

      // Add multiple operations
      await transactionCoordinator.addVectorOperation(
        { type: 'storeChunks', chunks: [{ id: 'chunk1', content: 'content1' }] },
        { type: 'deleteChunks', chunkIds: ['chunk1'] }
      );

      await transactionCoordinator.addGraphOperation(
        { type: 'storeChunks', chunks: [{ id: 'node1', nodes: [{ id: 'node1' }] }] },
        { type: 'deleteNodes', nodeIds: ['node1'] }
      );

      await transactionCoordinator.addVectorOperation(
        { type: 'storeChunks', chunks: [{ id: 'chunk2', content: 'content2' }] },
        { type: 'deleteChunks', chunkIds: ['chunk2'] }
      );

      // Commit transaction
      const commitResult = await transactionCoordinator.commitTransaction();

      expect(commitResult).toBe(true);

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should rollback complex multi-step transactions on failure', async () => {
      const projectId = 'test_project';
      
      // Begin transaction
      const transactionId = await transactionCoordinator.beginTransaction();

      // Add multiple operations
      await transactionCoordinator.addVectorOperation(
        { type: 'storeChunks', chunks: [{ id: 'chunk1', content: 'content1' }] },
        { type: 'deleteChunks', chunkIds: ['chunk1'] }
      );

      await transactionCoordinator.addGraphOperation(
        { type: 'storeChunks', chunks: [{ id: 'node1', nodes: [{ id: 'node1' }] }] },
        { type: 'deleteNodes', nodeIds: ['node1'] }
      );

      // Make the next operation fail
      vectorStorage.setShouldFail(true);

      await transactionCoordinator.addVectorOperation(
        { type: 'storeChunks', chunks: [{ id: 'chunk2', content: 'content2' }] },
        { type: 'deleteChunks', chunkIds: ['chunk2'] }
      );

      // Commit transaction - should fail and rollback
      const commitResult = await transactionCoordinator.commitTransaction();

      expect(commitResult).toBe(false);

      // Reset failure flag
      vectorStorage.setShouldFail(false);

      // Check consistency - should be no data stored
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });
  });

  describe('Bulk Operations and Consistency', () => {
    it('should handle bulk entity creation with consistency checks', async () => {
      const projectId = 'test_project';
      const entities = [
        { id: 'file1', content: 'content1', nodes: [{ id: 'file1', type: 'file' }] },
        { id: 'file2', content: 'content2', nodes: [{ id: 'file2', type: 'file' }] },
        { id: 'file3', content: 'content3', nodes: [{ id: 'file3', type: 'file' }] },
      ];

      // Create entities
      const results = await Promise.all(
        entities.map(entity => 
          entityMappingService.createEntity(
            'file',
            projectId,
            { id: entity.id, content: entity.content },
            { id: entity.id, nodes: entity.nodes }
          )
        )
      );

      expect(results.every(r => r.success)).toBe(true);

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
      expect(consistencyResult.totalEntities).toBe(3);
    });

    it('should handle bulk repair operations', async () => {
      const projectId = 'test_project';
      
      // Create entities with missing data
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);
      await entityMappingService.createEntity('file', projectId, undefined, { id: 'file2', nodes: [{ id: 'file2', type: 'file' }] });
      await entityMappingService.createEntity('file', projectId, undefined, undefined);

      // Check consistency - should find issues
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBeGreaterThan(0);

      // Repair all issues
      const repairResults = await consistencyChecker.repairAllIssues(projectId);
      expect(repairResults.length).toBeGreaterThan(0);
      expect(repairResults.every(r => r.success)).toBe(true);

      // Check consistency again - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should handle partial failures in bulk operations gracefully', async () => {
      const projectId = 'test_project';
      
      // Create entities with missing data
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);
      await entityMappingService.createEntity('file', projectId, undefined, { id: 'file2', nodes: [{ id: 'file2', type: 'file' }] });
      await entityMappingService.createEntity('file', projectId, undefined, undefined);

      // Check consistency - should find issues
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBeGreaterThan(0);

      // Make one repair fail
      jest.spyOn(consistencyChecker, 'repairIssue').mockImplementationOnce(async () => {
        throw new Error('Repair failed');
      });

      // Repair all issues - should handle partial failures
      const repairResults = await consistencyChecker.repairAllIssues(projectId);
      expect(repairResults.length).toBeGreaterThan(0);
      expect(repairResults.some(r => !r.success)).toBe(true);
      expect(repairResults.some(r => r.success)).toBe(true);
    });
  });

  describe('Cross-Database Data Synchronization', () => {
    it('should synchronize entities between databases', async () => {
      const projectId = 'test_project';
      
      // Create entity with only vector data
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);

      // Check consistency - should find missing graph data
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);
      expect(consistencyResult.issues[0].type).toBe('missing_graph');

      // Sync the project
      const syncResults = await entityMappingService.syncProject(projectId);
      expect(syncResults.length).toBe(1);
      expect(syncResults[0].success).toBe(true);

      // Check consistency again - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should handle synchronization failures gracefully', async () => {
      const projectId = 'test_project';
      
      // Create entity with only vector data
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);

      // Make sync fail
      jest.spyOn(entityMappingService, 'syncEntity').mockImplementationOnce(async () => {
        throw new Error('Sync failed');
      });

      // Sync the project - should handle failure gracefully
      const syncResults = await entityMappingService.syncProject(projectId);
      expect(syncResults.length).toBe(1);
      expect(syncResults[0].success).toBe(false);
    });

    it('should maintain consistency during batch operations', async () => {
      const projectId = 'test_project';
      
      // Create batch operations
      const batch = await entityMappingService.createBatch(projectId, [
        {
          type: 'create',
          entityType: 'file',
          entityId: 'file1',
          vectorData: { id: 'file1', content: 'content1' },
          graphData: { id: 'file1', nodes: [{ id: 'file1', type: 'file' }] }
        },
        {
          type: 'create',
          entityType: 'file',
          entityId: 'file2',
          vectorData: { id: 'file2', content: 'content2' },
          graphData: { id: 'file2', nodes: [{ id: 'file2', type: 'file' }] }
        }
      ]);

      // Execute batch
      const results = await entityMappingService.executeBatch(batch.id);
      expect(results.every(r => r.success)).toBe(true);

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
      expect(consistencyResult.totalEntities).toBe(2);
    });
  });

  describe('Error Recovery and Data Repair', () => {
    it('should recover from partial database failures', async () => {
      const projectId = 'test_project';
      
      // Create entity
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);

      // Check consistency - should find missing graph data
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(1);

      // Simulate partial database failure
      vectorStorage.setShouldFail(true);

      // Attempt repair - should fail gracefully
      const issue = consistencyResult.issues[0];
      const repairResult = await consistencyChecker.repairIssue(issue.id);
      expect(repairResult.success).toBe(false);

      // Reset failure
      vectorStorage.setShouldFail(false);

      // Repair again - should succeed
      const secondRepairResult = await consistencyChecker.repairIssue(issue.id);
      expect(secondRepairResult.success).toBe(true);

      // Check consistency - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should handle orphaned entities', async () => {
      const projectId = 'test_project';
      
      // Create entity mapping without actual data (orphaned)
      const mapping = entityIdManager.createMapping(
        'orphaned_entity',
        'file',
        projectId,
        'vector_orphaned_entity',
        'graph_orphaned_entity'
      );

      // Check consistency - should find orphaned entity
      let consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBeGreaterThan(0);

      // Find orphaned entity issue
      const orphanedIssue = consistencyResult.issues.find(issue => issue.type === 'orphaned_entity');
      expect(orphanedIssue).toBeDefined();

      // Repair orphaned entity
      if (orphanedIssue) {
        const repairResult = await consistencyChecker.repairIssue(orphanedIssue.id);
        expect(repairResult.success).toBe(true);
        expect(repairResult.action).toBe('removed_orphaned_entity');
      }

      // Check consistency - should be no issues
      consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBe(0);
    });

    it('should maintain consistency statistics', async () => {
      const projectId = 'test_project';
      
      // Create entities with various consistency issues
      await entityMappingService.createEntity('file', projectId, { id: 'file1', content: 'content1' }, undefined);
      await entityMappingService.createEntity('file', projectId, undefined, { id: 'file2', nodes: [{ id: 'file2', type: 'file' }] });
      await entityMappingService.createEntity('file', projectId, undefined, undefined);

      // Check consistency
      const consistencyResult = await consistencyChecker.checkProjectConsistency(projectId);
      expect(consistencyResult.issuesFound).toBeGreaterThan(0);

      // Get statistics
      const stats = consistencyChecker.getConsistencyStats(projectId);
      expect(stats.totalIssues).toBeGreaterThan(0);
      expect(stats.byType.missing_vector).toBeGreaterThan(0);
      expect(stats.byType.missing_graph).toBeGreaterThan(0);
      expect(stats.resolutionRate).toBe(0);

      // Repair all issues
      await consistencyChecker.repairAllIssues(projectId);

      // Get updated statistics
      const updatedStats = consistencyChecker.getConsistencyStats(projectId);
      expect(updatedStats.resolutionRate).toBe(100);
    });
  });
});