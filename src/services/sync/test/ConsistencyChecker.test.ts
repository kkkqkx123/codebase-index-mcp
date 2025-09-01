import { ConsistencyChecker } from '../ConsistencyChecker';
import { EntityIdManager, EntityMapping } from '../EntityIdManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../../core/ErrorHandlerService';
import { VectorStorageService } from '../../storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../../storage/graph/GraphPersistenceService';
import { TransactionCoordinator } from '../TransactionCoordinator';
import { createMockEntityMapping, createMockConsistencyIssue } from '@test/setup';

// Mock dependencies
jest.mock('../../../core/LoggerService');
jest.mock('../EntityIdManager');
jest.mock('../../storage/VectorStorageService');
jest.mock('../../storage/GraphPersistenceService');
jest.mock('../TransactionCoordinator');

describe('ConsistencyChecker', () => {
  let consistencyChecker: ConsistencyChecker;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockEntityIdManager: jest.Mocked<EntityIdManager>;
  let mockMappings: EntityMapping[];

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
      getMappingsByProject: jest.fn(),
      getMapping: jest.fn().mockImplementation((entityId) => 
        mockMappings.find(mapping => mapping.entityId === entityId)
      ),
      updateMapping: jest.fn(),
      deleteMapping: jest.fn(),
    } as any;

    const mockVectorStorageService = {
      storeChunks: jest.fn(),
    } as any;

    const mockGraphPersistenceService = {
      storeParsedFiles: jest.fn(),
    } as any;

    const mockTransactionCoordinator = {
      executeTransaction: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    // Create test mappings
    mockMappings = [
      createMockEntityMapping({
        entityId: 'entity_1',
        vectorId: 'vector_1',
        graphId: 'graph_1',
      }),
      createMockEntityMapping({
        entityId: 'entity_2',
        vectorId: undefined, // Missing vector
        graphId: 'graph_2',
      }),
      createMockEntityMapping({
        entityId: 'entity_3',
        vectorId: 'vector_3',
        graphId: undefined, // Missing graph
      }),
      createMockEntityMapping({
        entityId: 'entity_4',
        vectorId: undefined, // Missing both
        graphId: undefined,
      }),
    ];

    // Setup mock return values
    mockEntityIdManager.getMappingsByProject.mockReturnValue(mockMappings);

    // Create ConsistencyChecker instance
    consistencyChecker = new ConsistencyChecker(
      mockLoggerService,
      mockErrorHandlerService,
      mockEntityIdManager,
      mockVectorStorageService,
      mockGraphPersistenceService,
      mockTransactionCoordinator
    );
  });

  describe('checkProjectConsistency', () => {
    it('should return consistency check result with issues found', async () => {
      const projectId = 'test_project';
      const result = await consistencyChecker.checkProjectConsistency(projectId);

      expect(result).toEqual({
        projectId,
        totalEntities: mockMappings.length,
        issuesFound: 4, // entity_2 (1), entity_3 (1), and entity_4 (2) have issues
        issues: expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_vector',
            entityId: 'entity_2',
            entityType: 'file',
            projectId,
            severity: 'medium',
          }),
          expect.objectContaining({
            type: 'missing_graph',
            entityId: 'entity_3',
            entityType: 'file',
            projectId,
            severity: 'medium',
          }),
          expect.objectContaining({
            type: 'missing_vector',
            entityId: 'entity_4',
            entityType: 'file',
            projectId,
            severity: 'medium',
          }),
          expect.objectContaining({
            type: 'missing_graph',
            entityId: 'entity_4',
            entityType: 'file',
            projectId,
            severity: 'medium',
          }),
        ]),
        checkedAt: expect.any(Date),
        duration: expect.any(Number),
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting consistency check', { projectId });
      expect(mockLoggerService.info).toHaveBeenCalledWith('Consistency check completed', {
        projectId,
        issuesFound: 4, // entity_4 has both missing_vector and missing_graph
        duration: expect.any(Number),
      });
    });

    it('should return no issues when all entities are consistent', async () => {
      const projectId = 'test_project';
      const consistentMappings = [
        createMockEntityMapping({
          entityId: 'entity_1',
          vectorId: 'vector_1',
          graphId: 'graph_1',
        }),
        createMockEntityMapping({
          entityId: 'entity_2',
          vectorId: 'vector_2',
          graphId: 'graph_2',
        }),
      ];

      mockEntityIdManager.getMappingsByProject.mockReturnValue(consistentMappings);

      const result = await consistencyChecker.checkProjectConsistency(projectId);

      expect(result.issuesFound).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle empty project', async () => {
      const projectId = 'empty_project';
      mockEntityIdManager.getMappingsByProject.mockReturnValue([]);

      const result = await consistencyChecker.checkProjectConsistency(projectId);

      expect(result).toEqual({
        projectId,
        totalEntities: 0,
        issuesFound: 0,
        issues: [],
        checkedAt: expect.any(Date),
        duration: expect.any(Number),
      });
    });
  });

  describe('repairIssue', () => {
    it('should repair missing vector issue successfully', async () => {
      const issue = createMockConsistencyIssue({
        type: 'missing_vector',
        entityId: 'entity_1',
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      const result = await consistencyChecker.repairIssue(issue.id);

      expect(result).toEqual({
        issueId: issue.id,
        success: true,
        action: 'created_vector_data',
        message: 'Created missing vector data for entity entity_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.updateMapping).toHaveBeenCalledWith('entity_1', {
        vectorId: 'entity_1',
        graphId: 'graph_1',
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Repairing consistency issue', {
        issueId: issue.id,
        strategy: 'auto',
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Issue repaired successfully', {
        issueId: issue.id,
        action: 'created_vector_data',
      });
    });

    it('should repair missing graph issue successfully', async () => {
      const issue = createMockConsistencyIssue({
        type: 'missing_graph',
        entityId: 'entity_1',
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      const result = await consistencyChecker.repairIssue(issue.id);

      expect(result).toEqual({
        issueId: issue.id,
        success: true,
        action: 'created_graph_data',
        message: 'Created missing graph data for entity entity_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.updateMapping).toHaveBeenCalledWith('entity_1', {
        graphId: 'entity_1',
        vectorId: 'vector_1',
      });
    });

    it('should repair data mismatch issue successfully', async () => {
      const issue = createMockConsistencyIssue({
        type: 'data_mismatch',
        entityId: 'entity_1',
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      const result = await consistencyChecker.repairIssue(issue.id);

      expect(result).toEqual({
        issueId: issue.id,
        success: true,
        action: 'resolved_data_mismatch',
        message: 'Resolved data mismatch for entity entity_1',
        timestamp: expect.any(Date),
      });
    });

    it('should repair orphaned entity issue successfully', async () => {
      const issue = createMockConsistencyIssue({
        type: 'orphaned_entity',
        entityId: 'entity_1',
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      const result = await consistencyChecker.repairIssue(issue.id);

      expect(result).toEqual({
        issueId: issue.id,
        success: true,
        action: 'removed_orphaned_entity',
        message: 'Removed orphaned entity entity_1',
        timestamp: expect.any(Date),
      });

      expect(mockEntityIdManager.deleteMapping).toHaveBeenCalledWith('entity_1');
    });

    it('should throw error when issue not found', async () => {
      await expect(consistencyChecker.repairIssue('nonexistent_issue')).rejects.toThrow(
        CodebaseIndexError
      );
    });

    it('should throw error when issue already resolved', async () => {
      const issue = createMockConsistencyIssue({
        resolvedAt: new Date(),
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      await expect(consistencyChecker.repairIssue(issue.id)).rejects.toThrow(
        CodebaseIndexError
      );
    });

    it('should handle repair failures', async () => {
      const issue = createMockConsistencyIssue({
        type: 'missing_vector',
        entityId: 'entity_1',
      });

      // Add issue to the checker's internal state
      (consistencyChecker as any).consistencyIssues.set(issue.id, issue);

      // Make updateMapping throw an error
      mockEntityIdManager.updateMapping.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(consistencyChecker.repairIssue(issue.id, 'manual')).rejects.toThrow(
        'Manual repair not implemented'
      );
    });
  });

  describe('repairAllIssues', () => {
    it('should repair all issues successfully', async () => {
      const projectId = 'test_project';
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          type: 'missing_vector',
          entityId: 'entity_1',
          projectId,
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          type: 'missing_graph',
          entityId: 'entity_2',
          projectId,
        }),
        createMockConsistencyIssue({
          id: 'issue_3',
          type: 'data_mismatch',
          entityId: 'entity_3',
          projectId,
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const results = await consistencyChecker.repairAllIssues(projectId);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting bulk repair', {
        projectId,
        issueCount: 3,
      });

      expect(mockLoggerService.info).toHaveBeenCalledWith('Bulk repair completed', {
        projectId,
        successCount: 3,
        totalCount: 3,
      });
    });

    it('should handle repair failures in bulk repair', async () => {
      const projectId = 'test_project';
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          type: 'missing_vector',
          entityId: 'entity_1',
          projectId,
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          type: 'missing_graph',
          entityId: 'entity_2',
          projectId,
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      // Make one repair fail
      jest.spyOn(consistencyChecker, 'repairIssue').mockImplementationOnce(async () => {
        throw new Error('Repair failed');
      });

      const results = await consistencyChecker.repairAllIssues(projectId);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to repair issue during bulk repair',
        expect.objectContaining({
          issueId: 'issue_1',
          error: expect.any(Error),
        })
      );
    });

    it('should filter issues by project ID', async () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          type: 'missing_vector',
          entityId: 'entity_1',
          projectId: 'project_1',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          type: 'missing_graph',
          entityId: 'entity_2',
          projectId: 'project_2',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const results = await consistencyChecker.repairAllIssues('project_1');

      expect(results).toHaveLength(1);
      expect(results[0].issueId).toBe('issue_1');
    });
  });

  describe('getIssues', () => {
    it('should return all issues', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          severity: 'low',
          detectedAt: new Date(Date.now() - 1000), // Earlier timestamp
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          severity: 'high',
          detectedAt: new Date(), // Later timestamp
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const result = consistencyChecker.getIssues();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('issue_2'); // Should be sorted by detectedAt descending
      expect(result[1].id).toBe('issue_1');
    });

    it('should filter issues by project ID', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          projectId: 'project_1',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          projectId: 'project_2',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const result = consistencyChecker.getIssues('project_1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('issue_1');
    });

    it('should filter issues by severity', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          severity: 'low',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          severity: 'high',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const result = consistencyChecker.getIssues(undefined, 'high');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('issue_2');
    });

    it('should filter issues by both project ID and severity', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          projectId: 'project_1',
          severity: 'low',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          projectId: 'project_1',
          severity: 'high',
        }),
        createMockConsistencyIssue({
          id: 'issue_3',
          projectId: 'project_2',
          severity: 'high',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const result = consistencyChecker.getIssues('project_1', 'high');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('issue_2');
    });
  });

  describe('getConsistencyStats', () => {
    it('should return correct statistics for all projects', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          type: 'missing_vector',
          severity: 'low',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          type: 'missing_graph',
          severity: 'medium',
        }),
        createMockConsistencyIssue({
          id: 'issue_3',
          type: 'data_mismatch',
          severity: 'high',
          resolvedAt: new Date(),
        }),
        createMockConsistencyIssue({
          id: 'issue_4',
          type: 'orphaned_entity',
          severity: 'critical',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const stats = consistencyChecker.getConsistencyStats();

      expect(stats).toEqual({
        totalIssues: 4,
        resolvedIssues: 1,
        unresolvedIssues: 3,
        resolutionRate: 25,
        byType: {
          missing_vector: 1,
          missing_graph: 1,
          data_mismatch: 1,
          orphaned_entity: 1,
        },
        bySeverity: {
          critical: 1,
          high: 1,
          medium: 1,
          low: 1,
        },
      });
    });

    it('should return correct statistics for specific project', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          projectId: 'project_1',
          type: 'missing_vector',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          projectId: 'project_2',
          type: 'missing_graph',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const stats = consistencyChecker.getConsistencyStats('project_1');

      expect(stats).toEqual({
        totalIssues: 1,
        resolvedIssues: 0,
        unresolvedIssues: 1,
        resolutionRate: 0,
        byType: {
          missing_vector: 1,
          missing_graph: 0,
          data_mismatch: 0,
          orphaned_entity: 0,
        },
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 1,
          low: 0,
        },
      });
    });

    it('should handle empty issues', () => {
      const stats = consistencyChecker.getConsistencyStats();

      expect(stats).toEqual({
        totalIssues: 0,
        resolvedIssues: 0,
        unresolvedIssues: 0,
        resolutionRate: 0,
        byType: {
          missing_vector: 0,
          missing_graph: 0,
          data_mismatch: 0,
          orphaned_entity: 0,
        },
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      });
    });
  });

  describe('clearResolvedIssues', () => {
    it('should clear resolved issues for specific project', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          projectId: 'project_1',
          resolvedAt: new Date(),
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
          projectId: 'project_1',
        }),
        createMockConsistencyIssue({
          id: 'issue_3',
          projectId: 'project_2',
          resolvedAt: new Date(),
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const clearedCount = consistencyChecker.clearResolvedIssues('project_1');

      expect(clearedCount).toBe(1);
      expect((consistencyChecker as any).consistencyIssues.has('issue_1')).toBe(false);
      expect((consistencyChecker as any).consistencyIssues.has('issue_2')).toBe(true);
      expect((consistencyChecker as any).consistencyIssues.has('issue_3')).toBe(true);
    });

    it('should clear all resolved issues when no project specified', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
          resolvedAt: new Date(),
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
        }),
        createMockConsistencyIssue({
          id: 'issue_3',
          resolvedAt: new Date(),
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const clearedCount = consistencyChecker.clearResolvedIssues();

      expect(clearedCount).toBe(2);
      expect((consistencyChecker as any).consistencyIssues.has('issue_1')).toBe(false);
      expect((consistencyChecker as any).consistencyIssues.has('issue_2')).toBe(true);
      expect((consistencyChecker as any).consistencyIssues.has('issue_3')).toBe(false);
    });

    it('should return 0 when no resolved issues', () => {
      const issues = [
        createMockConsistencyIssue({
          id: 'issue_1',
        }),
        createMockConsistencyIssue({
          id: 'issue_2',
        }),
      ];

      // Add issues to the checker's internal state
      issues.forEach(issue => {
        (consistencyChecker as any).consistencyIssues.set(issue.id, issue);
      });

      const clearedCount = consistencyChecker.clearResolvedIssues();

      expect(clearedCount).toBe(0);
      expect((consistencyChecker as any).consistencyIssues.size).toBe(2);
    });
  });

  describe('getRepairHistory', () => {
    it('should return repair history with default limit', () => {
      const repairHistory = [
        { issueId: 'issue_1', success: true, timestamp: new Date() },
        { issueId: 'issue_2', success: false, timestamp: new Date() },
      ];

      // Set repair history
      (consistencyChecker as any).repairHistory = repairHistory;

      const result = consistencyChecker.getRepairHistory();

      expect(result).toEqual(repairHistory);
    });

    it('should respect the limit parameter', () => {
      const repairHistory = [
        { issueId: 'issue_1', success: true, timestamp: new Date() },
        { issueId: 'issue_2', success: false, timestamp: new Date() },
        { issueId: 'issue_3', success: true, timestamp: new Date() },
      ];

      // Set repair history
      (consistencyChecker as any).repairHistory = repairHistory;

      const result = consistencyChecker.getRepairHistory(2);

      expect(result).toEqual(repairHistory.slice(-2));
    });

    it('should handle empty repair history', () => {
      // Set empty repair history
      (consistencyChecker as any).repairHistory = [];

      const result = consistencyChecker.getRepairHistory();

      expect(result).toEqual([]);
    });
  });
});