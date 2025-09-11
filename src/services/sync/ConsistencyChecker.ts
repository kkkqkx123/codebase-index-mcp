import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../core/ErrorHandlerService';
import { EntityIdManager, EntityMapping } from './EntityIdManager';
import { VectorStorageService } from '../storage/vector/VectorStorageService';
import { GraphPersistenceService } from '../storage/graph/GraphPersistenceService';
import { TransactionCoordinator } from './TransactionCoordinator';

export interface ConsistencyIssue {
  id: string;
  type: 'missing_vector' | 'missing_graph' | 'data_mismatch' | 'orphaned_entity';
  entityId: string;
  entityType: string;
  projectId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface ConsistencyCheckResult {
  projectId: string;
  totalEntities: number;
  issuesFound: number;
  issues: ConsistencyIssue[];
  checkedAt: Date;
  duration: number;
}

export interface DataRepairResult {
  issueId: string;
  success: boolean;
  action: string;
  message: string;
  timestamp: Date;
}

@injectable()
export class ConsistencyChecker {
  private logger: LoggerService;
  private entityIdManager: EntityIdManager;
  private consistencyIssues: Map<string, ConsistencyIssue> = new Map();
  private repairHistory: DataRepairResult[] = [];
  private vectorStorageService: VectorStorageService;
  private graphPersistenceService: GraphPersistenceService;
  private transactionCoordinator: TransactionCoordinator;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) _errorHandler: ErrorHandlerService,
    @inject(EntityIdManager) entityIdManager: EntityIdManager,
    @inject(VectorStorageService) vectorStorageService: VectorStorageService,
    @inject(GraphPersistenceService) graphPersistenceService: GraphPersistenceService,
    @inject(TransactionCoordinator) transactionCoordinator: TransactionCoordinator
  ) {
    this.logger = logger;
    this.entityIdManager = entityIdManager;
    this.vectorStorageService = vectorStorageService;
    this.graphPersistenceService = graphPersistenceService;
    this.transactionCoordinator = transactionCoordinator;
  }

  async checkProjectConsistency(projectId: string): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    this.logger.info('Starting consistency check', { projectId });

    const mappings = this.entityIdManager.getMappingsByProject(projectId);
    const issues: ConsistencyIssue[] = [];

    // Check each mapping for consistency issues
    for (const mapping of mappings) {
      const entityIssues = await this.checkEntityConsistency(mapping);
      issues.push(...entityIssues);
    }

    // Store the issues
    for (const issue of issues) {
      this.consistencyIssues.set(issue.id, issue);
    }

    const result: ConsistencyCheckResult = {
      projectId,
      totalEntities: mappings.length,
      issuesFound: issues.length,
      issues,
      checkedAt: new Date(),
      duration: Date.now() - startTime
    };

    this.logger.info('Consistency check completed', { 
      projectId, 
      issuesFound: issues.length,
      duration: result.duration 
    });

    return result;
  }

  private async checkEntityConsistency(mapping: EntityMapping): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];

    // Check for missing vector data
    if (!mapping.vectorId) {
      issues.push({
        id: this.generateIssueId(),
        type: 'missing_vector',
        entityId: mapping.entityId,
        entityType: mapping.entityType,
        projectId: mapping.projectId,
        severity: 'medium',
        description: `Entity ${mapping.entityId} is missing vector data`,
        detectedAt: new Date()
      });
    }

    // Check for missing graph data
    if (!mapping.graphId) {
      issues.push({
        id: this.generateIssueId(),
        type: 'missing_graph',
        entityId: mapping.entityId,
        entityType: mapping.entityType,
        projectId: mapping.projectId,
        severity: 'medium',
        description: `Entity ${mapping.entityId} is missing graph data`,
        detectedAt: new Date()
      });
    }

    // Check for data consistency (this would involve actual data comparison)
    const hasDataMismatch = await this.checkDataConsistency(mapping);
    if (hasDataMismatch) {
      issues.push({
        id: this.generateIssueId(),
        type: 'data_mismatch',
        entityId: mapping.entityId,
        entityType: mapping.entityType,
        projectId: mapping.projectId,
        severity: 'high',
        description: `Data mismatch between vector and graph stores for entity ${mapping.entityId}`,
        detectedAt: new Date()
      });
    }

    return issues;
  }

  private async checkDataConsistency(_mapping: EntityMapping): Promise<boolean> {
    // This would compare the actual data between vector and graph stores
    // For now, we'll simulate the check
    // In a real implementation, this would fetch data from both databases and compare
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 5));
    
    // Return false (no mismatch) for now
    return false;
  }

  async repairIssue(issueId: string, strategy: 'auto' | 'manual' = 'auto'): Promise<DataRepairResult> {
    const issue = this.consistencyIssues.get(issueId);
    if (!issue) {
      throw new CodebaseIndexError(`Issue not found: ${issueId}`, { 
        component: 'ConsistencyChecker', 
        operation: 'repairIssue' 
      });
    }

    if (issue.resolvedAt) {
      throw new CodebaseIndexError(`Issue already resolved: ${issueId}`, { 
        component: 'ConsistencyChecker', 
        operation: 'repairIssue' 
      });
    }

    // Handle manual strategy by throwing an error
    if (strategy === 'manual') {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'repairIssue' 
      });
    }

    this.logger.info('Repairing consistency issue', { issueId, strategy });

    try {
      const result = await this.performRepair(issue, strategy);
      
      // Mark issue as resolved
      issue.resolvedAt = new Date();
      issue.resolution = result.message;
      
      this.repairHistory.push(result);
      
      this.logger.info('Issue repaired successfully', { issueId, action: result.action });
      return result;
    } catch (error) {
      const errorResult: DataRepairResult = {
        issueId,
        success: false,
        action: 'repair_failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
      
      this.repairHistory.push(errorResult);
      this.logger.error('Failed to repair issue', { issueId, error });
      
      throw error;
    }
  }

  private async performRepair(issue: ConsistencyIssue, strategy: 'auto' | 'manual'): Promise<DataRepairResult> {
    // Handle manual strategy by throwing an error for all issue types
    if (strategy === 'manual') {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'performRepair' 
      });
    }
    
    switch (issue.type) {
      case 'missing_vector':
        return await this.repairMissingVector(issue, strategy);
      case 'missing_graph':
        return await this.repairMissingGraph(issue, strategy);
      case 'data_mismatch':
        return await this.repairDataMismatch(issue, strategy);
      case 'orphaned_entity':
        return await this.repairOrphanedEntity(issue, strategy);
      default:
        throw new CodebaseIndexError(`Unknown issue type: ${issue.type}`, { 
          component: 'ConsistencyChecker', 
          operation: 'performRepair' 
        });
    }
  }

  private async repairMissingVector(issue: ConsistencyIssue, strategy: string): Promise<DataRepairResult> {
    if (strategy === 'auto') {
      try {
        // Get the entity mapping
        const mapping = this.entityIdManager.getMapping(issue.entityId);
        if (!mapping) {
          throw new CodebaseIndexError(`Entity mapping not found: ${issue.entityId}`, { 
            component: 'ConsistencyChecker', 
            operation: 'repairMissingVector' 
          });
        }

        // Create a transaction for vector repair
        const operations = [{
          type: 'vector' as const,
          operation: {
            type: 'storeChunks',
            chunks: [mapping], // Using the entire mapping as the chunk data
            options: { projectId: issue.projectId }
          }
        }];

        const result = await this.transactionCoordinator.executeTransaction(issue.projectId, operations);
        
        if (result.success) {
          // Get the current mapping to preserve the graphId
          const currentMapping = this.entityIdManager.getMapping(issue.entityId);
          // Update the mapping with vector ID
          await this.entityIdManager.updateMapping(issue.entityId, {
            vectorId: issue.entityId,
            graphId: currentMapping?.graphId
          });
          
          return {
            issueId: issue.id,
            success: true,
            action: 'created_vector_data',
            message: `Created missing vector data for entity ${issue.entityId}`,
            timestamp: new Date()
          };
        } else {
          throw new Error(result.error || 'Transaction failed');
        }
      } catch (error) {
        this.logger.error('Failed to repair missing vector data', { 
          entityId: issue.entityId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        throw error;
      }
    } else {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'repairMissingVector' 
      });
    }
  }

  private async repairMissingGraph(issue: ConsistencyIssue, strategy: string): Promise<DataRepairResult> {
    if (strategy === 'auto') {
      try {
        // Get the entity mapping
        const mapping = this.entityIdManager.getMapping(issue.entityId);
        if (!mapping) {
          throw new CodebaseIndexError(`Entity mapping not found: ${issue.entityId}`, { 
            component: 'ConsistencyChecker', 
            operation: 'repairMissingGraph' 
          });
        }

        // Create a transaction for graph repair
        const operations = [{
          type: 'graph' as const,
          operation: {
            type: 'storeChunks',
            chunks: [mapping], // Using the entire mapping as the chunk data
            options: { projectId: issue.projectId }
          }
        }];

        const result = await this.transactionCoordinator.executeTransaction(issue.projectId, operations);
        
        if (result.success) {
          // Get the current mapping to preserve the vectorId
          const currentMapping = this.entityIdManager.getMapping(issue.entityId);
          // Update the mapping with graph ID
          await this.entityIdManager.updateMapping(issue.entityId, {
            vectorId: currentMapping?.vectorId,
            graphId: issue.entityId
          });
          
          return {
            issueId: issue.id,
            success: true,
            action: 'created_graph_data',
            message: `Created missing graph data for entity ${issue.entityId}`,
            timestamp: new Date()
          };
        } else {
          throw new Error(result.error || 'Transaction failed');
        }
      } catch (error) {
        this.logger.error('Failed to repair missing graph data', { 
          entityId: issue.entityId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        throw error;
      }
    } else {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'repairMissingGraph' 
      });
    }
  }

  private async repairDataMismatch(issue: ConsistencyIssue, strategy: string): Promise<DataRepairResult> {
    // This would resolve data mismatches
    // For now, we'll simulate the repair
    
    if (strategy === 'auto') {
      // Simulate repair process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        issueId: issue.id,
        success: true,
        action: 'resolved_data_mismatch',
        message: `Resolved data mismatch for entity ${issue.entityId}`,
        timestamp: new Date()
      };
    } else {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'repairDataMismatch' 
      });
    }
  }

  private async repairOrphanedEntity(issue: ConsistencyIssue, strategy: string): Promise<DataRepairResult> {
    // This would handle orphaned entities
    // For now, we'll simulate the repair
    
    if (strategy === 'auto') {
      // Simulate repair process
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // Remove the orphaned mapping
      this.entityIdManager.deleteMapping(issue.entityId);
      
      return {
        issueId: issue.id,
        success: true,
        action: 'removed_orphaned_entity',
        message: `Removed orphaned entity ${issue.entityId}`,
        timestamp: new Date()
      };
    } else {
      throw new CodebaseIndexError('Manual repair not implemented', { 
        component: 'ConsistencyChecker', 
        operation: 'repairOrphanedEntity' 
      });
    }
  }

  async repairAllIssues(projectId?: string, strategy: 'auto' | 'manual' = 'auto'): Promise<DataRepairResult[]> {
    const issues = Array.from(this.consistencyIssues.values())
      .filter(issue => !issue.resolvedAt && (projectId ? issue.projectId === projectId : true));

    const results: DataRepairResult[] = [];

    this.logger.info('Starting bulk repair', { projectId, issueCount: issues.length });

    for (const issue of issues) {
      try {
        const result = await this.repairIssue(issue.id, strategy);
        results.push(result);
      } catch (error) {
        results.push({
          issueId: issue.id,
          success: false,
          action: 'repair_failed',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
        this.logger.error('Failed to repair issue during bulk repair', { 
          issueId: issue.id, 
          error 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info('Bulk repair completed', { 
      projectId, 
      successCount, 
      totalCount: results.length 
    });

    return results;
  }

  getIssues(projectId?: string, severity?: ConsistencyIssue['severity']): ConsistencyIssue[] {
    let issues = Array.from(this.consistencyIssues.values());

    if (projectId) {
      issues = issues.filter(issue => issue.projectId === projectId);
    }

    if (severity) {
      issues = issues.filter(issue => issue.severity === severity);
    }

    return issues.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  getRepairHistory(limit: number = 100): DataRepairResult[] {
    return this.repairHistory.slice(-limit);
  }

  getConsistencyStats(projectId?: string) {
    const issues = Array.from(this.consistencyIssues.values())
      .filter(issue => projectId ? issue.projectId === projectId : true);

    const total = issues.length;
    const resolved = issues.filter(i => i.resolvedAt).length;
    const bySeverity = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    };

    return {
      totalIssues: total,
      resolvedIssues: resolved,
      unresolvedIssues: total - resolved,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
      byType: {
        missing_vector: issues.filter(i => i.type === 'missing_vector').length,
        missing_graph: issues.filter(i => i.type === 'missing_graph').length,
        data_mismatch: issues.filter(i => i.type === 'data_mismatch').length,
        orphaned_entity: issues.filter(i => i.type === 'orphaned_entity').length
      },
      bySeverity
    };
  }

  clearResolvedIssues(projectId?: string): number {
    let clearedCount = 0;
    
    for (const [issueId, issue] of this.consistencyIssues.entries()) {
      if (issue.resolvedAt && (!projectId || issue.projectId === projectId)) {
        this.consistencyIssues.delete(issueId);
        clearedCount++;
      }
    }

    this.logger.info('Cleared resolved issues', { projectId, clearedCount });
    return clearedCount;
  }

  private generateIssueId(): string {
    return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}