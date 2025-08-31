import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { CodebaseIndexError } from '../../core/ErrorHandlerService';
import { EntityMappingService } from './EntityMappingService';
import { VectorStorageService } from '../storage/VectorStorageService';
import { GraphPersistenceService } from '../storage/GraphPersistenceService';

export interface TransactionStep {
  id: string;
  type: 'vector' | 'graph' | 'mapping';
  operation: any;
  compensatingOperation?: any;
  executed: boolean;
  compensated: boolean;
}

export interface Transaction {
  id: string;
  projectId: string;
  steps: TransactionStep[];
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensating';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface TransactionResult {
  transactionId: string;
  success: boolean;
  executedSteps: number;
  failedStep?: string;
  error?: string;
  duration: number;
}

@injectable()
export class TransactionCoordinator {
  private logger: LoggerService;
  private activeTransactions: Map<string, Transaction> = new Map();
  private transactionHistory: Transaction[] = [];
  private currentTransaction: Transaction | null = null;
  private vectorStorageService: VectorStorageService;
  private graphPersistenceService: GraphPersistenceService;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) _errorHandler: ErrorHandlerService,
    @inject(EntityMappingService) _entityMappingService: EntityMappingService,
    @inject(VectorStorageService) vectorStorageService: VectorStorageService,
    @inject(GraphPersistenceService) graphPersistenceService: GraphPersistenceService
  ) {
    this.logger = logger;
    this.vectorStorageService = vectorStorageService;
    this.graphPersistenceService = graphPersistenceService;
  }

  async executeTransaction(
    projectId: string,
    operations: Array<{
      type: 'vector' | 'graph' | 'mapping';
      operation: any;
      compensatingOperation?: any;
    }>
  ): Promise<TransactionResult> {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    const transaction: Transaction = {
      id: transactionId,
      projectId,
      steps: operations.map((op, index) => ({
        id: `step_${index}`,
        type: op.type,
        operation: op.operation,
        compensatingOperation: op.compensatingOperation,
        executed: false,
        compensated: false
      })),
      status: 'pending',
      createdAt: new Date()
    };

    this.activeTransactions.set(transactionId, transaction);
    this.logger.info('Starting transaction', { transactionId, stepCount: operations.length });

    try {
      transaction.status = 'executing';
      
      for (const step of transaction.steps) {
        try {
          await this.executeStep(transaction, step);
          step.executed = true;
        } catch (error) {
          step.executed = false;
          throw error;
        }
      }

      transaction.status = 'completed';
      transaction.completedAt = new Date();

      const result: TransactionResult = {
        transactionId,
        success: true,
        executedSteps: transaction.steps.filter(s => s.executed).length,
        duration: Date.now() - startTime
      };

      this.transactionHistory.push(transaction);
      this.activeTransactions.delete(transactionId);

      this.logger.info('Transaction completed successfully', { 
        transactionId, 
        duration: result.duration 
      });

      return result;
    } catch (error) {
      this.logger.error('Transaction failed, starting compensation', { 
        transactionId, 
        error: error instanceof Error ? error.message : String(error) 
      });

      await this.compensateTransaction(transaction);

      transaction.status = 'failed';
      transaction.error = error instanceof Error ? error.message : String(error);
      transaction.completedAt = new Date();

      const result: TransactionResult = {
        transactionId,
        success: false,
        executedSteps: transaction.steps.filter(s => s.executed).length,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.transactionHistory.push(transaction);
      this.activeTransactions.delete(transactionId);

      return result;
    }
  }

  private async executeStep(transaction: Transaction, step: TransactionStep): Promise<void> {
    this.logger.debug('Executing transaction step', { 
      transactionId: transaction.id, 
      stepId: step.id,
      type: step.type 
    });

    try {
      switch (step.type) {
        case 'vector':
          await this.executeVectorOperation(step.operation);
          break;
        case 'graph':
          await this.executeGraphOperation(step.operation);
          break;
        case 'mapping':
          await this.executeMappingOperation(step.operation);
          break;
        default:
          throw new CodebaseIndexError(`Unknown step type: ${step.type}`, { 
            component: 'TransactionCoordinator', 
            operation: 'executeStep' 
          });
      }
    } catch (error) {
      this.logger.error('Step execution failed', { 
        transactionId: transaction.id, 
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  private async compensateTransaction(transaction: Transaction): Promise<void> {
    transaction.status = 'compensating';
    
    this.logger.info('Starting transaction compensation', { transactionId: transaction.id });

    // Execute compensating operations in reverse order
    for (let i = transaction.steps.length - 1; i >= 0; i--) {
      const step = transaction.steps[i];
      
      if (step.executed && step.compensatingOperation) {
        try {
          this.logger.debug('Executing compensating operation', { 
            transactionId: transaction.id, 
            stepId: step.id 
          });

          await this.executeCompensatingOperation(step.compensatingOperation);
          step.compensated = true;
        } catch (error) {
          this.logger.error('Compensating operation failed', { 
            transactionId: transaction.id, 
            stepId: step.id,
            error: error instanceof Error ? error.message : String(error) 
          });
          // Continue with other compensating operations even if one fails
        }
      }
    }

    this.logger.info('Transaction compensation completed', { transactionId: transaction.id });
  }

  private async executeVectorOperation(operation: any): Promise<void> {
    this.logger.debug('Executing vector operation', operation);
    
    try {
      switch (operation.type) {
        case 'storeChunks':
          // Actually store chunks in vector database
          if (operation.chunks && operation.chunks.length > 0) {
            const result = await this.vectorStorageService.storeChunks(
              operation.chunks.filter((chunk: any) => chunk !== undefined),
              operation.options
            );
            
            if (!result.success) {
              throw new Error(`Failed to store chunks in vector database: ${result.errors.join(', ')}`);
            }
            
            this.logger.debug('Successfully stored chunks in vector database', {
              chunkCount: result.totalChunks,
              uniqueChunks: result.uniqueChunks,
              processingTime: result.processingTime
            });
          }
          break;
          
        case 'deleteChunks':
          // In a real implementation, we would delete chunks from vector database
          this.logger.debug('Deleting chunks from vector database', {
            chunkCount: operation.chunkIds?.length || 0
          });
          // For now, we'll just log the operation
          break;
          
        default:
          this.logger.warn('Unknown vector operation type', { type: operation.type });
          throw new Error(`Unknown vector operation type: ${operation.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to execute vector operation', {
        operation,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async executeGraphOperation(operation: any): Promise<void> {
    this.logger.debug('Executing graph operation', operation);
    
    try {
      switch (operation.type) {
        case 'storeChunks':
          // Actually store chunks in graph database
          if (operation.chunks && operation.chunks.length > 0) {
            const result = await this.graphPersistenceService.storeChunks(
              operation.chunks.filter((chunk: any) => chunk !== undefined),
              operation.options
            );
            
            if (!result.success) {
              throw new Error(`Failed to store chunks in graph database: ${result.errors.join(', ')}`);
            }
            
            this.logger.debug('Successfully stored chunks in graph database', {
              chunkCount: result.nodesCreated,
              relationshipsCreated: result.relationshipsCreated,
              processingTime: result.processingTime
            });
          }
          break;
          
        case 'deleteNodes':
          // In a real implementation, we would delete nodes from graph database
          this.logger.debug('Deleting nodes from graph database', {
            nodeCount: operation.nodeIds?.length || 0
          });
          // For now, we'll just log the operation
          break;
          
        default:
          this.logger.warn('Unknown graph operation type', { type: operation.type });
          throw new Error(`Unknown graph operation type: ${operation.type}`);
      }
    } catch (error) {
      this.logger.error('Failed to execute graph operation', {
        operation,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async executeMappingOperation(operation: any): Promise<void> {
    // This would interact with the entity mapping service
    // For now, we'll simulate the operation
    this.logger.debug('Executing mapping operation', operation);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  private async executeCompensatingOperation(operation: any): Promise<void> {
    // This would execute the compensating operation
    this.logger.debug('Executing compensating operation', operation);
    
    try {
      // In a real implementation, we would interact with the appropriate service here
      // For now, we'll simulate the operation based on the operation type
      
      switch (operation.type) {
        case 'deleteChunks':
          // Compensating operation for storeChunks - delete the stored chunks
          this.logger.debug('Compensating: Deleting chunks from vector database', {
            chunkCount: operation.chunkIds?.length || 0
          });
          break;
          
        case 'restoreChunks':
          // Compensating operation for deleteChunks - restore the deleted chunks
          this.logger.debug('Compensating: Restoring chunks to vector database', {
            chunkCount: operation.chunkIds?.length || 0
          });
          break;
          
        case 'deleteNodes':
          // Compensating operation for storeChunks - delete the created nodes
          this.logger.debug('Compensating: Deleting nodes from graph database', {
            nodeCount: operation.nodeIds?.length || 0
          });
          break;
          
        case 'restoreNodes':
          // Compensating operation for deleteNodes - restore the deleted nodes
          this.logger.debug('Compensating: Restoring nodes to graph database', {
            nodeCount: operation.nodeIds?.length || 0
          });
          break;
          
        default:
          this.logger.warn('Unknown compensating operation type', { type: operation.type });
      }
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      this.logger.error('Failed to execute compensating operation', {
        operation,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.activeTransactions.get(transactionId) || null;
  }

  async getActiveTransactions(): Promise<Transaction[]> {
    return Array.from(this.activeTransactions.values());
  }

  async getTransactionHistory(limit: number = 100): Promise<Transaction[]> {
    return this.transactionHistory.slice(-limit);
  }

  async cancelTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return false;
    }

    if (transaction.status === 'executing') {
      await this.compensateTransaction(transaction);
    }

    transaction.status = 'failed';
    transaction.error = 'Cancelled by user';
    transaction.completedAt = new Date();

    this.activeTransactions.delete(transactionId);
    this.transactionHistory.push(transaction);

    this.logger.info('Transaction cancelled', { transactionId });
    return true;
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async beginTransaction(): Promise<string> {
    if (this.currentTransaction) {
      throw new Error('A transaction is already in progress');
    }

    const transactionId = this.generateTransactionId();
    
    this.currentTransaction = {
      id: transactionId,
      projectId: 'incremental_indexing',
      steps: [],
      status: 'pending',
      createdAt: new Date()
    };

    this.logger.debug('Transaction began', { transactionId });
    return transactionId;
  }

  async commitTransaction(): Promise<boolean> {
    if (!this.currentTransaction) {
      throw new Error('No active transaction to commit');
    }

    const transactionId = this.currentTransaction.id;
    
    try {
      // Execute all queued operations
      if (this.currentTransaction.steps.length > 0) {
        const result = await this.executeTransactionSteps(this.currentTransaction);
        
        if (!result.success) {
          throw new Error(`Transaction execution failed: ${result.error}`);
        }
      }

      this.currentTransaction.status = 'completed';
      this.currentTransaction.completedAt = new Date();
      
      this.transactionHistory.push(this.currentTransaction);
      this.logger.debug('Transaction committed', { transactionId });
      
      this.currentTransaction = null;
      return true;
    } catch (error) {
      this.logger.error('Failed to commit transaction', {
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Attempt to rollback on commit failure
      await this.rollbackTransaction();
      return false;
    }
  }

  async rollbackTransaction(): Promise<boolean> {
    if (!this.currentTransaction) {
      this.logger.warn('No active transaction to rollback');
      return false;
    }

    const transactionId = this.currentTransaction.id;
    
    try {
      // Compensate for executed steps
      await this.compensateTransaction(this.currentTransaction);
      
      this.currentTransaction.status = 'failed';
      this.currentTransaction.error = 'Rolled back';
      this.currentTransaction.completedAt = new Date();
      
      this.transactionHistory.push(this.currentTransaction);
      this.logger.debug('Transaction rolled back', { transactionId });
      
      this.currentTransaction = null;
      return true;
    } catch (error) {
      this.logger.error('Failed to rollback transaction', {
        transactionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Still clear the current transaction even if rollback fails
      this.currentTransaction = null;
      return false;
    }
  }

  async addVectorOperation(operation: any, compensatingOperation?: any): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    this.currentTransaction.steps.push({
      id: `step_${this.currentTransaction.steps.length}`,
      type: 'vector',
      operation,
      compensatingOperation,
      executed: false,
      compensated: false
    });
  }

  async addGraphOperation(operation: any, compensatingOperation?: any): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error('No active transaction');
    }

    this.currentTransaction.steps.push({
      id: `step_${this.currentTransaction.steps.length}`,
      type: 'graph',
      operation,
      compensatingOperation,
      executed: false,
      compensated: false
    });
  }

  private async executeTransactionSteps(transaction: Transaction): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      transaction.status = 'executing';
      
      for (const step of transaction.steps) {
        try {
          await this.executeStep(transaction, step);
          step.executed = true;
        } catch (error) {
          step.executed = false;
          throw error;
        }
      }

      transaction.status = 'completed';
      transaction.completedAt = new Date();

      const result: TransactionResult = {
        transactionId: transaction.id,
        success: true,
        executedSteps: transaction.steps.filter(s => s.executed).length,
        duration: Date.now() - startTime
      };

      return result;
    } catch (error) {
      transaction.status = 'failed';
      transaction.error = error instanceof Error ? error.message : String(error);
      transaction.completedAt = new Date();

      const result: TransactionResult = {
        transactionId: transaction.id,
        success: false,
        executedSteps: transaction.steps.filter(s => s.executed).length,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      return result;
    }
  }

  getStats() {
    const active = this.activeTransactions.size;
    const recent = this.transactionHistory.slice(-100);
    const success = recent.filter(t => t.status === 'completed').length;

    return {
      activeTransactions: active,
      recentSuccessRate: recent.length > 0 ? (success / recent.length) * 100 : 0,
      averageTransactionTime: recent.length > 0
        ? recent.reduce((sum, t) => sum + (t.completedAt?.getTime() || 0) - t.createdAt.getTime(), 0) / recent.length
        : 0
    };
  }
}