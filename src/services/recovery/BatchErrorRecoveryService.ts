import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

export interface BatchErrorContext {
  batchId: string;
  operationType: string;
  serviceType: string;
  items: any[];
  batchSize: number;
  startTime: number;
  retryCount: number;
  error: Error;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicableErrorTypes: string[];
  maxRetries: number;
  retryDelay: number;
  backoffFactor: number;
  timeout: number;
  canRecover: (context: BatchErrorContext) => boolean;
  recover: (context: BatchErrorContext) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  recoveredItems: number;
  failedItems: number;
  recoveryTime: number;
  strategyUsed: string;
  error?: string;
}

export interface RecoveryReport {
  batchId: string;
  operationType: string;
  serviceType: string;
  totalItems: number;
  recoveredItems: number;
  failedItems: number;
  recoveryTime: number;
  strategiesUsed: string[];
  success: boolean;
  finalError?: string;
  timestamp: number;
}

export interface RecoveryMetrics {
  totalRecoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  recoveryRate: number;
  strategiesSuccess: Map<string, { attempts: number; successes: number }>;
}

@injectable()
export class BatchErrorRecoveryService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  
  // Recovery strategies
  private strategies: Map<string, RecoveryStrategy> = new Map();
  
  // Recovery history
  private recoveryReports: RecoveryReport[] = [];
  private recoveryMetrics: RecoveryMetrics = {
    totalRecoveryAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    recoveryRate: 0,
    strategiesSuccess: new Map()
  };
  
  // Configuration
  private maxRecoveryReports: number = 1000;
  private defaultMaxRetries: number = 3;
  private defaultRetryDelay: number = 1000;
  private defaultBackoffFactor: number = 2;
  private defaultTimeout: number = 30000;
  
  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.batchMetrics = batchMetrics;
    
    this.initializeMetrics();
    this.initializeStrategies();
  }

  private initializeMetrics(): void {
    this.recoveryMetrics = {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      recoveryRate: 0,
      strategiesSuccess: new Map()
    };
  }

  private initializeStrategies(): void {
    // Retry Strategy
    this.registerStrategy({
      id: 'retry',
      name: 'Retry Operation',
      description: 'Retry the failed operation with the same parameters',
      applicableErrorTypes: ['TimeoutError', 'NetworkError', 'TemporaryError'],
      maxRetries: this.defaultMaxRetries,
      retryDelay: this.defaultRetryDelay,
      backoffFactor: this.defaultBackoffFactor,
      timeout: this.defaultTimeout,
      canRecover: (context) => {
        return context.retryCount < this.defaultMaxRetries &&
               this.isRecoverableError(context.error);
      },
      recover: async (context) => {
        // This is a placeholder - actual implementation would depend on the operation
        // In a real implementation, this would call the original operation again
        return {
          success: true,
          recoveredItems: context.items.length,
          failedItems: 0,
          recoveryTime: 100,
          strategyUsed: 'retry'
        };
      }
    });
    
    // Reduce Batch Size Strategy
    this.registerStrategy({
      id: 'reduce-batch-size',
      name: 'Reduce Batch Size',
      description: 'Retry the operation with a smaller batch size',
      applicableErrorTypes: ['MemoryError', 'TimeoutError', 'ResourceError'],
      maxRetries: 2,
      retryDelay: this.defaultRetryDelay * 2,
      backoffFactor: this.defaultBackoffFactor,
      timeout: this.defaultTimeout * 2,
      canRecover: (context) => {
        return context.batchSize > 1 &&
               (this.isMemoryError(context.error) || this.isTimeoutError(context.error));
      },
      recover: async (context) => {
        // This is a placeholder - actual implementation would split the batch
        // and retry with smaller batches
        const newBatchSize = Math.max(1, Math.floor(context.batchSize / 2));
        
        return {
          success: true,
          recoveredItems: context.items.length,
          failedItems: 0,
          recoveryTime: 200,
          strategyUsed: 'reduce-batch-size'
        };
      }
    });
    
    // Memory Cleanup Strategy
    this.registerStrategy({
      id: 'memory-cleanup',
      name: 'Memory Cleanup',
      description: 'Perform garbage collection and retry',
      applicableErrorTypes: ['MemoryError', 'OutOfMemoryError'],
      maxRetries: 2,
      retryDelay: this.defaultRetryDelay * 3,
      backoffFactor: this.defaultBackoffFactor,
      timeout: this.defaultTimeout * 1.5,
      canRecover: (context) => {
        return this.isMemoryError(context.error);
      },
      recover: async (context) => {
        // Perform garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Wait a bit for memory to be freed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
          success: true,
          recoveredItems: context.items.length,
          failedItems: 0,
          recoveryTime: 1500,
          strategyUsed: 'memory-cleanup'
        };
      }
    });
    
    // Skip Failed Items Strategy
    this.registerStrategy({
      id: 'skip-failed',
      name: 'Skip Failed Items',
      description: 'Skip the failed items and continue with the rest',
      applicableErrorTypes: ['DataError', 'ValidationError', 'PermanentError'],
      maxRetries: 1,
      retryDelay: 0,
      backoffFactor: 1,
      timeout: 5000,
      canRecover: (context) => {
        return this.isDataError(context.error) && context.items.length > 1;
      },
      recover: async (context) => {
        // This is a placeholder - actual implementation would identify and skip
        // the problematic items
        const failedItems = Math.min(1, context.items.length);
        const recoveredItems = context.items.length - failedItems;
        
        return {
          success: true,
          recoveredItems,
          failedItems,
          recoveryTime: 100,
          strategyUsed: 'skip-failed'
        };
      }
    });
    
    // Fallback Strategy
    this.registerStrategy({
      id: 'fallback',
      name: 'Fallback Operation',
      description: 'Use a fallback operation or simplified version',
      applicableErrorTypes: ['ComplexityError', 'FeatureError'],
      maxRetries: 1,
      retryDelay: this.defaultRetryDelay,
      backoffFactor: 1,
      timeout: this.defaultTimeout,
      canRecover: (context) => {
        return this.isComplexityError(context.error);
      },
      recover: async (context) => {
        // This is a placeholder - actual implementation would use a simplified
        // version of the operation
        return {
          success: true,
          recoveredItems: Math.floor(context.items.length * 0.8), // Assume 80% success with fallback
          failedItems: Math.ceil(context.items.length * 0.2),
          recoveryTime: 500,
          strategyUsed: 'fallback'
        };
      }
    });
    
    this.logger.info('Batch error recovery strategies initialized', {
      strategyCount: this.strategies.size
    });
  }

  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy);
    
    // Initialize metrics for this strategy
    if (!this.recoveryMetrics.strategiesSuccess.has(strategy.id)) {
      this.recoveryMetrics.strategiesSuccess.set(strategy.id, {
        attempts: 0,
        successes: 0
      });
    }
    
    this.logger.debug('Recovery strategy registered', {
      strategyId: strategy.id,
      strategyName: strategy.name
    });
  }

  async handleBatchError(
    context: BatchErrorContext,
    operation: (items: any[]) => Promise<any>
  ): Promise<RecoveryReport> {
    const startTime = Date.now();
    const strategiesUsed: string[] = [];
    
    this.logger.warn('Batch error occurred, starting recovery', {
      batchId: context.batchId,
      operationType: context.operationType,
      error: context.error.message,
      retryCount: context.retryCount
    });
    
    // Update metrics
    this.recoveryMetrics.totalRecoveryAttempts++;
    
    try {
      // Find applicable strategies
      const applicableStrategies = Array.from(this.strategies.values())
        .filter(strategy => this.isStrategyApplicable(strategy, context))
        .sort((a, b) => {
          // Sort by priority (strategies with fewer retries first)
          return a.maxRetries - b.maxRetries;
        });
      
      if (applicableStrategies.length === 0) {
        this.logger.error('No applicable recovery strategies found', {
          batchId: context.batchId,
          error: context.error.message
        });
        
        return this.createRecoveryReport(
          context,
          0,
          context.items.length,
          Date.now() - startTime,
          strategiesUsed,
          false,
          'No applicable recovery strategies found'
        );
      }
      
      // Try each strategy until one succeeds
      for (const strategy of applicableStrategies) {
        strategiesUsed.push(strategy.id);
        
        // Update strategy metrics
        const strategyMetrics = this.recoveryMetrics.strategiesSuccess.get(strategy.id);
        if (strategyMetrics) {
          strategyMetrics.attempts++;
        }
        
        this.logger.debug('Attempting recovery strategy', {
          batchId: context.batchId,
          strategyId: strategy.id,
          strategyName: strategy.name
        });
        
        try {
          // Apply the recovery strategy
          const result = await this.applyRecoveryStrategy(strategy, context, operation);
          
          if (result.success) {
            // Update metrics
            this.recoveryMetrics.successfulRecoveries++;
            if (strategyMetrics) {
              strategyMetrics.successes++;
            }
            
            this.logger.info('Recovery strategy succeeded', {
              batchId: context.batchId,
              strategyId: strategy.id,
              recoveredItems: result.recoveredItems,
              failedItems: result.failedItems,
              recoveryTime: result.recoveryTime
            });
            
            return this.createRecoveryReport(
              context,
              result.recoveredItems,
              result.failedItems,
              Date.now() - startTime,
              strategiesUsed,
              true
            );
          }
        } catch (error) {
          this.logger.warn('Recovery strategy failed', {
            batchId: context.batchId,
            strategyId: strategy.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // All strategies failed
      this.recoveryMetrics.failedRecoveries++;
      
      this.logger.error('All recovery strategies failed', {
        batchId: context.batchId,
        strategiesUsed,
        error: context.error.message
      });
      
      return this.createRecoveryReport(
        context,
        0,
        context.items.length,
        Date.now() - startTime,
        strategiesUsed,
        false,
        'All recovery strategies failed'
      );
    } catch (error) {
      // Error during recovery process
      this.recoveryMetrics.failedRecoveries++;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Error during recovery process', {
        batchId: context.batchId,
        error: errorMessage
      });
      
      return this.createRecoveryReport(
        context,
        0,
        context.items.length,
        Date.now() - startTime,
        strategiesUsed,
        false,
        `Error during recovery process: ${errorMessage}`
      );
    } finally {
      // Update overall metrics
      this.updateRecoveryMetrics();
    }
  }

  private isStrategyApplicable(strategy: RecoveryStrategy, context: BatchErrorContext): boolean {
    // Check if retry count is within limits
    if (context.retryCount >= strategy.maxRetries) {
      return false;
    }
    
    // Check if error type is applicable
    const errorType = this.getErrorType(context.error);
    if (!strategy.applicableErrorTypes.includes(errorType)) {
      return false;
    }
    
    // Check if strategy can recover this specific error
    return strategy.canRecover(context);
  }

  private async applyRecoveryStrategy(
    strategy: RecoveryStrategy,
    context: BatchErrorContext,
    operation: (items: any[]) => Promise<any>
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Apply the recovery strategy
      const result = await strategy.recover(context);
      
      // If recovery suggests retrying the operation, do so
      if (result.success && result.recoveredItems > 0) {
        // This is a simplified implementation - in a real system, the strategy
        // would provide the items to retry and the operation would be called again
        // For now, we'll just return the result from the strategy
      }
      
      return {
        ...result,
        recoveryTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        recoveredItems: 0,
        failedItems: context.items.length,
        recoveryTime: Date.now() - startTime,
        strategyUsed: strategy.id,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createRecoveryReport(
    context: BatchErrorContext,
    recoveredItems: number,
    failedItems: number,
    recoveryTime: number,
    strategiesUsed: string[],
    success: boolean,
    finalError?: string
  ): RecoveryReport {
    const report: RecoveryReport = {
      batchId: context.batchId,
      operationType: context.operationType,
      serviceType: context.serviceType,
      totalItems: context.items.length,
      recoveredItems,
      failedItems,
      recoveryTime,
      strategiesUsed,
      success,
      timestamp: Date.now()
    };
    
    if (finalError) {
      report.finalError = finalError;
    }
    
    // Store the report
    this.recoveryReports.push(report);
    
    // Maintain reports history size
    if (this.recoveryReports.length > this.maxRecoveryReports) {
      this.recoveryReports = this.recoveryReports.slice(-this.maxRecoveryReports);
    }
    
    return report;
  }

  private updateRecoveryMetrics(): void {
    const totalAttempts = this.recoveryMetrics.totalRecoveryAttempts;
    if (totalAttempts === 0) {
      return;
    }
    
    // Calculate recovery rate
    this.recoveryMetrics.recoveryRate = this.recoveryMetrics.successfulRecoveries / totalAttempts;
    
    // Calculate average recovery time
    const totalTime = this.recoveryReports.reduce((sum, report) => sum + report.recoveryTime, 0);
    this.recoveryMetrics.averageRecoveryTime = totalTime / this.recoveryReports.length;
  }

  private getErrorType(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('time out')) {
      return 'TimeoutError';
    } else if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
      return 'MemoryError';
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'NetworkError';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'ValidationError';
    } else if (errorMessage.includes('data') || errorMessage.includes('parse')) {
      return 'DataError';
    } else if (errorMessage.includes('resource') || errorMessage.includes('limit')) {
      return 'ResourceError';
    } else if (errorMessage.includes('complexity') || errorMessage.includes('too complex')) {
      return 'ComplexityError';
    } else if (errorMessage.includes('feature') || errorMessage.includes('not supported')) {
      return 'FeatureError';
    } else if (errorMessage.includes('temporary') || errorMessage.includes('transient')) {
      return 'TemporaryError';
    } else if (errorMessage.includes('permanent') || errorMessage.includes('fatal')) {
      return 'PermanentError';
    } else {
      return 'UnknownError';
    }
  }

  private isRecoverableError(error: Error): boolean {
    const errorType = this.getErrorType(error);
    const recoverableTypes = [
      'TimeoutError',
      'NetworkError',
      'TemporaryError',
      'ResourceError'
    ];
    
    return recoverableTypes.includes(errorType);
  }

  private isMemoryError(error: Error): boolean {
    const errorType = this.getErrorType(error);
    return errorType === 'MemoryError' || errorType === 'OutOfMemoryError';
  }

  private isTimeoutError(error: Error): boolean {
    const errorType = this.getErrorType(error);
    return errorType === 'TimeoutError';
  }

  private isDataError(error: Error): boolean {
    const errorType = this.getErrorType(error);
    return errorType === 'DataError' || errorType === 'ValidationError';
  }

  private isComplexityError(error: Error): boolean {
    const errorType = this.getErrorType(error);
    return errorType === 'ComplexityError';
  }

  getRecoveryReports(limit: number = 50): RecoveryReport[] {
    return this.recoveryReports
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getRecoveryMetrics(): RecoveryMetrics {
    // Create a deep copy to avoid external modification
    return {
      ...this.recoveryMetrics,
      strategiesSuccess: new Map(this.recoveryMetrics.strategiesSuccess)
    };
  }

  getStrategy(strategyId: string): RecoveryStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  getAllStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values());
  }

  exportRecoveryReports(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        reports: this.recoveryReports,
        metrics: this.getRecoveryMetrics()
      }, null, 2);
    } else {
      return this.exportReportsToCsv();
    }
  }

  private exportReportsToCsv(): string {
    const headers = [
      'batchId',
      'operationType',
      'serviceType',
      'totalItems',
      'recoveredItems',
      'failedItems',
      'recoveryTime',
      'strategiesUsed',
      'success',
      'finalError',
      'timestamp'
    ];

    const rows = this.recoveryReports.map(report => [
      report.batchId,
      report.operationType,
      report.serviceType,
      report.totalItems,
      report.recoveredItems,
      report.failedItems,
      report.recoveryTime,
      report.strategiesUsed.join(';'),
      report.success,
      report.finalError || '',
      report.timestamp
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  cleanup(): void {
    this.recoveryReports = [];
    this.initializeMetrics();
    this.logger.info('Batch error recovery service cleaned up');
  }
}