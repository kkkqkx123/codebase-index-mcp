import { injectable, inject } from 'inversify';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { CodebaseIndexError } from '../core/ErrorHandlerService';
import { EntityMappingService, SyncOperation } from './EntityMappingService';

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
  private errorHandler: ErrorHandlerService;
  private entityMappingService: EntityMappingService;
  private activeTransactions: Map<string, Transaction> = new Map();
  private transactionHistory: Transaction[] = [];

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(EntityMappingService) entityMappingService: EntityMappingService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.entityMappingService = entityMappingService;
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
    // This would interact with the vector database service
    // For now, we'll simulate the operation
    this.logger.debug('Executing vector operation', operation);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  private async executeGraphOperation(operation: any): Promise<void> {
    // This would interact with the graph database service
    // For now, we'll simulate the operation
    this.logger.debug('Executing graph operation', operation);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
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
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
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

  getStats() {
    const active = this.activeTransactions.size;
    const recent = this.transactionHistory.slice(-100);
    const success = recent.filter(t => t.status === 'completed').length;
    const failed = recent.filter(t => t.status === 'failed').length;

    return {
      activeTransactions: active,
      recentSuccessRate: recent.length > 0 ? (success / recent.length) * 100 : 0,
      averageTransactionTime: recent.length > 0 
        ? recent.reduce((sum, t) => sum + (t.completedAt?.getTime() || 0) - t.createdAt.getTime(), 0) / recent.length 
        : 0
    };
  }
}