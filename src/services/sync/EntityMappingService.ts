import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../core/ErrorHandlerService';
import { EntityIdManager } from './EntityIdManager';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  projectId: string;
  vectorData?: any;
  graphData?: any;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface SyncResult {
  operationId: string;
  success: boolean;
  vectorId?: string;
  graphId?: string;
  error?: string;
  timestamp: Date;
}

export interface SyncBatch {
  id: string;
  projectId: string;
  operations: SyncOperation[];
  createdAt: Date;
  executedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

@injectable()
export class EntityMappingService {
  private logger: LoggerService;
  private entityIdManager: EntityIdManager;
  private pendingOperations: Map<string, SyncOperation> = new Map();
  private errorHandler: ErrorHandlerService;
  private operationHistory: SyncOperation[] = [];

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(EntityIdManager) entityIdManager: EntityIdManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.entityIdManager = entityIdManager;
  }

  async createEntity(
    entityType: string,
    projectId: string,
    vectorData?: any,
    graphData?: any
  ): Promise<SyncResult> {
    const operationId = this.generateOperationId();
    const entityId = this.entityIdManager.generateEntityId(entityType as any, projectId);

    const operation: SyncOperation = {
      id: operationId,
      type: 'create',
      entityType,
      entityId,
      projectId,
      vectorData,
      graphData,
      timestamp: new Date(),
      status: 'pending'
    };

    this.pendingOperations.set(operationId, operation);
    this.logger.info('Queued entity creation', { operationId, entityId, entityType });

    try {
      const result = await this.executeOperation(operation);
      this.operationHistory.push(operation);
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.push(operation);
      this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        component: 'EntityMappingService',
        operation: 'createEntity',
        metadata: { entityId, entityType },
      });
      throw error;
    }
  }

  async updateEntity(
    entityId: string,
    updates: {
      vectorData?: any;
      graphData?: any;
    }
  ): Promise<SyncResult> {
    const mapping = this.entityIdManager.getMapping(entityId);
    if (!mapping) {
      const error = new CodebaseIndexError(`Entity not found: ${entityId}`, { component: 'EntityMappingService', operation: 'update' });
      this.errorHandler.handleError(error, error.context);
      throw error;
    }

    const operationId = this.generateOperationId();
    const operation: SyncOperation = {
      id: operationId,
      type: 'update',
      entityType: mapping.entityType,
      entityId,
      projectId: mapping.projectId,
      vectorData: updates.vectorData,
      graphData: updates.graphData,
      timestamp: new Date(),
      status: 'pending'
    };

    this.pendingOperations.set(operationId, operation);
    this.logger.info('Queued entity update', { operationId, entityId });

    try {
      const result = await this.executeOperation(operation);
      this.operationHistory.push(operation);
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.push(operation);
      this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        component: 'EntityMappingService',
        operation: 'updateEntity',
        metadata: { entityId },
      });
      throw error;
    }
  }

  async deleteEntity(entityId: string): Promise<SyncResult> {
    const mapping = this.entityIdManager.getMapping(entityId);
    if (!mapping) {
      const error = new CodebaseIndexError(`Entity not found: ${entityId}`, { component: 'EntityMappingService', operation: 'delete' });
      this.errorHandler.handleError(error, error.context);
      throw error;
    }

    const operationId = this.generateOperationId();
    const operation: SyncOperation = {
      id: operationId,
      type: 'delete',
      entityType: mapping.entityType,
      entityId,
      projectId: mapping.projectId,
      timestamp: new Date(),
      status: 'pending'
    };

    this.pendingOperations.set(operationId, operation);
    this.logger.info('Queued entity deletion', { operationId, entityId });

    try {
      const result = await this.executeOperation(operation);
      this.operationHistory.push(operation);
      this.entityIdManager.deleteMapping(entityId);
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.push(operation);
      this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        component: 'EntityMappingService',
        operation: 'deleteEntity',
        metadata: { entityId },
      });
      throw error;
    }
  }

  async syncEntity(entityId: string): Promise<SyncResult> {
    const mapping = this.entityIdManager.getMapping(entityId);
    if (!mapping) {
      const error = new CodebaseIndexError(`Entity not found: ${entityId}`, { component: 'EntityMappingService', operation: 'sync' });
      this.errorHandler.handleError(error, error.context);
      throw error;
    }

    // Determine what needs to be synced based on current status
    let needsVectorSync = false;
    let needsGraphSync = false;

    switch (mapping.syncStatus) {
      case 'vector_only':
        needsGraphSync = true;
        break;
      case 'graph_only':
        needsVectorSync = true;
        break;
      case 'conflict':
        needsVectorSync = true;
        needsGraphSync = true;
        break;
    }

    if (!needsVectorSync && !needsGraphSync) {
      return {
        operationId: this.generateOperationId(),
        success: true,
        timestamp: new Date()
      };
    }

    // This would typically fetch the missing data from the existing source
    // and create it in the target database
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type: 'update',
      entityType: mapping.entityType,
      entityId,
      projectId: mapping.projectId,
      timestamp: new Date(),
      status: 'pending'
    };

    try {
      const result = await this.executeOperation(operation);
      this.operationHistory.push(operation);
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.push(operation);
      this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
        component: 'EntityMappingService',
        operation: 'syncEntity',
        metadata: { entityId },
      });
      throw error;
    }
  }

  async syncProject(projectId: string): Promise<SyncResult[]> {
    const unsyncedMappings = this.entityIdManager.getUnsyncedMappings(projectId);
    const results: SyncResult[] = [];

    this.logger.info('Starting project sync', { projectId, entityCount: unsyncedMappings.length });

    for (const mapping of unsyncedMappings) {
      try {
        const result = await this.syncEntity(mapping.entityId);
        results.push(result);
      } catch (error) {
        results.push({
          operationId: this.generateOperationId(),
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
        this.logger.error('Failed to sync entity', { entityId: mapping.entityId, error });
        // Do not rethrow the error, allow the project sync to continue for other entities.
      }
    }

    return results;
  }

  async createBatch(projectId: string, operations: Omit<SyncOperation, 'id' | 'timestamp' | 'status'>[]): Promise<SyncBatch> {
    const batchId = this.generateBatchId();
    const batch: SyncBatch = {
      id: batchId,
      projectId,
      operations: operations.map(op => ({
        ...op,
        id: this.generateOperationId(),
        timestamp: new Date(),
        status: 'pending'
      })),
      createdAt: new Date(),
      status: 'pending'
    };

    for (const operation of batch.operations) {
      this.pendingOperations.set(operation.id, operation);
    }

    this.logger.info('Created sync batch', { batchId, operationCount: operations.length });
    return batch;
  }

  async executeBatch(batchId: string): Promise<SyncResult[]> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      const error = new CodebaseIndexError(`Batch not found: ${batchId}`, { component: 'EntityMappingService', operation: 'executeBatch' });
      this.errorHandler.handleError(error, error.context);
      throw error;
    }

    batch.status = 'executing';
    batch.executedAt = new Date();

    const results: SyncResult[] = [];

    for (const operation of batch.operations) {
      try {
        const result = await this.executeOperation(operation);
        results.push(result);
      } catch (error) {
        results.push({
          operationId: operation.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
        this.logger.error('Batch operation failed', { operationId: operation.id, error });
      }
    }

    const allSuccess = results.every(r => r.success);
    batch.status = allSuccess ? 'completed' : 'failed';

    this.logger.info('Batch execution completed', { batchId, successCount: results.filter(r => r.success).length });
    return results;
  }

  private async executeOperation(operation: SyncOperation): Promise<SyncResult> {
    operation.status = 'in_progress';
    
    try {
      // This is a simplified implementation
      // In a real implementation, this would coordinate with the actual database services
      const result = await this.performDatabaseOperation(operation);
      
      operation.status = 'completed';
      this.pendingOperations.delete(operation.id);
      
      return result;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async performDatabaseOperation(operation: SyncOperation): Promise<SyncResult> {
    // This would be implemented to actually interact with the databases
    // For now, we'll simulate the operation
    const mapping = this.entityIdManager.getMapping(operation.entityId);
    
    let vectorId: string | undefined;
    let graphId: string | undefined;

    if (operation.type === 'create') {
      const newMapping = this.entityIdManager.createMapping(
        operation.entityId,
        operation.entityType,
        operation.projectId,
        operation.vectorData ? 'vector_' + operation.entityId : undefined,
        operation.graphData ? 'graph_' + operation.entityId : undefined
      );
      vectorId = newMapping.vectorId;
      graphId = newMapping.graphId;
    } else if (operation.type === 'update' && mapping) {
      const updatedMapping = this.entityIdManager.updateMapping(
        operation.entityId,
        {
          vectorId: operation.vectorData ? 'vector_' + operation.entityId : mapping.vectorId,
          graphId: operation.graphData ? 'graph_' + operation.entityId : mapping.graphId
        }
      );
      vectorId = updatedMapping?.vectorId;
      graphId = updatedMapping?.graphId;
    }

    return {
      operationId: operation.id,
      success: true,
      ...(vectorId && { vectorId }),
      ...(graphId && { graphId }),
      timestamp: new Date()
    };
  }

  private async getBatch(batchId: string): Promise<SyncBatch | null> {
    // This would typically retrieve from persistent storage
    // For now, we'll search through pending operations
    const operations = Array.from(this.pendingOperations.values())
      .filter(op => op.id.startsWith(batchId + '_'));
    
    if (operations.length === 0) {
      return null;
    }

    return {
      id: batchId,
      projectId: operations[0].projectId,
      operations,
      createdAt: operations[0].timestamp,
      status: 'pending'
    };
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getPendingOperations(): SyncOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  getOperationHistory(limit: number = 100): SyncOperation[] {
    return this.operationHistory.slice(-limit);
  }

  getSyncStats(projectId?: string) {
    return this.entityIdManager.getSyncStats(projectId);
  }
}