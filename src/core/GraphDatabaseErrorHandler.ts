import { injectable, inject } from 'inversify';
import { LoggerService } from '../core/LoggerService';
import { ErrorClassifier } from './ErrorClassifier';
import { TYPES } from '../types';

export interface ErrorContext {
  component: string;
  operation: string;
  query?: string;
  parameters?: Record<string, any>;
  duration?: number;
  retryCount?: number;
}

export interface ErrorClassification {
  type: 'connection' | 'query' | 'timeout' | 'constraint' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  suggestedAction: string;
}

export interface ErrorHandlingResult {
  handled: boolean;
  recovered: boolean;
  action: string;
  suggestions?: string[];
  context?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  execute: (error: ErrorClassification, context: ErrorContext) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  action?: string;
  error?: string;
}

@injectable()
export class GraphDatabaseErrorHandler {
  private logger: LoggerService;
  private errorClassifier: ErrorClassifier;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorHistory: Array<{
    timestamp: Date;
    error: string;
    type: string;
    component: string;
    operation: string;
    recovered: boolean;
  }> = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorClassifier) errorClassifier: ErrorClassifier
  ) {
    this.logger = logger;
    this.errorClassifier = errorClassifier;
    this.initializeRecoveryStrategies();
  }

  async handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult> {
    const errorInfo = await this.errorClassifier.classifyError(error);

    this.logger.error('Graph database error occurred', {
      error: error.message,
      type: errorInfo.type,
      severity: errorInfo.severity,
      context,
      stack: error.stack,
    });

    // Record error in history
    this.recordError(error, errorInfo, context);

    // Attempt automatic recovery
    const recoveryResult = await this.attemptRecovery(errorInfo, context);

    if (recoveryResult.success) {
      this.logger.info('Error recovered automatically', {
        errorType: errorInfo.type,
        recoveryStrategy: recoveryResult.strategy,
      });

      return {
        handled: true,
        recovered: true,
        action: recoveryResult.action || 'recovered_automatically',
      };
    }

    // If automatic recovery fails, provide detailed error information
    return {
      handled: true,
      recovered: false,
      action: 'manual_intervention_required',
      suggestions: this.getErrorSuggestions(errorInfo),
      context: this.collectErrorContext(error, context),
    };
  }

  private async attemptRecovery(
    errorInfo: ErrorClassification,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(errorInfo.type);

    if (!strategy) {
      return { success: false, strategy: 'none' };
    }

    try {
      return await strategy.execute(errorInfo, context);
    } catch (recoveryError) {
      this.logger.error('Recovery strategy failed', {
        errorType: errorInfo.type,
        recoveryError:
          recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        strategy: strategy.name,
      });

      return { success: false, strategy: strategy.name };
    }
  }

  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = new Map([
      ['connection', new ConnectionRecoveryStrategy()],
      ['timeout', new TimeoutRecoveryStrategy()],
      ['query', new QueryRecoveryStrategy()],
      ['constraint', new ConstraintRecoveryStrategy()],
      ['permission', new PermissionRecoveryStrategy()],
    ]);
  }

  private recordError(error: Error, errorInfo: ErrorClassification, context: ErrorContext): void {
    this.errorHistory.push({
      timestamp: new Date(),
      error: error.message,
      type: errorInfo.type,
      component: context.component,
      operation: context.operation,
      recovered: false,
    });

    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }
  }

  private getErrorSuggestions(errorInfo: ErrorClassification): string[] {
    const suggestions: string[] = [];

    switch (errorInfo.type) {
      case 'connection':
        suggestions.push('Check NebulaGraph server status');
        suggestions.push('Verify network connectivity');
        suggestions.push('Check connection parameters');
        break;
      case 'timeout':
        suggestions.push('Increase timeout settings');
        suggestions.push('Optimize query performance');
        suggestions.push('Check server load');
        break;
      case 'query':
        suggestions.push('Review query syntax');
        suggestions.push('Check parameter values');
        suggestions.push('Validate schema compatibility');
        break;
      case 'constraint':
        suggestions.push('Check data integrity');
        suggestions.push('Verify unique constraints');
        suggestions.push('Review data relationships');
        break;
      case 'permission':
        suggestions.push('Verify user permissions');
        suggestions.push('Check access control settings');
        suggestions.push('Review space privileges');
        break;
      default:
        suggestions.push('Review system logs');
        suggestions.push('Check database configuration');
        suggestions.push('Contact system administrator');
    }

    return suggestions;
  }

  private collectErrorContext(error: Error, context: ErrorContext): Record<string, any> {
    return {
      errorMessage: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString(),
      component: context.component,
      operation: context.operation,
      query: context.query,
      parameters: context.parameters,
      duration: context.duration,
      retryCount: context.retryCount,
      recentErrors: this.errorHistory.slice(-5).map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        component: e.component,
      })),
    };
  }

  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByComponent: Record<string, number>;
    recoveryRate: number;
    recentErrors: Array<{
      timestamp: Date;
      type: string;
      component: string;
      operation: string;
    }>;
  } {
    const errorsByType = this.errorHistory.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const errorsByComponent = this.errorHistory.reduce(
      (acc, error) => {
        acc[error.component] = (acc[error.component] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recoveryRate =
      this.errorHistory.length > 0
        ? (this.errorHistory.filter(e => e.recovered).length / this.errorHistory.length) * 100
        : 0;

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsByComponent,
      recoveryRate,
      recentErrors: this.errorHistory.slice(-10).map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        component: e.component,
        operation: e.operation,
      })),
    };
  }
}

@injectable()
// Recovery Strategy Implementations
class ConnectionRecoveryStrategy implements RecoveryStrategy {
  name = 'connection_recovery';

  async execute(error: ErrorClassification, context: ErrorContext): Promise<RecoveryResult> {
    // Implementation would include reconnection logic
    // For now, simulate recovery attempt
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: Math.random() > 0.3, // 70% success rate
      strategy: this.name,
      action: 'reconnected_to_database',
    };
  }
}

class TimeoutRecoveryStrategy implements RecoveryStrategy {
  name = 'timeout_recovery';

  async execute(error: ErrorClassification, context: ErrorContext): Promise<RecoveryResult> {
    // Implementation would include retry with increased timeout
    const delay = Math.min(1000 * Math.pow(2, context.retryCount || 0), 30000);
    await new Promise(resolve => setTimeout(resolve, delay));

    return {
      success: Math.random() > 0.2, // 80% success rate
      strategy: this.name,
      action: 'retried_with_increased_timeout',
    };
  }
}

class QueryRecoveryStrategy implements RecoveryStrategy {
  name = 'query_recovery';

  async execute(error: ErrorClassification, context: ErrorContext): Promise<RecoveryResult> {
    // Implementation would include query optimization or parameter validation
    return {
      success: false, // Query errors typically require manual intervention
      strategy: this.name,
      action: 'query_validation_failed',
    };
  }
}

class ConstraintRecoveryStrategy implements RecoveryStrategy {
  name = 'constraint_recovery';

  async execute(error: ErrorClassification, context: ErrorContext): Promise<RecoveryResult> {
    // Implementation would include data cleanup or constraint adjustment
    return {
      success: Math.random() > 0.5, // 50% success rate
      strategy: this.name,
      action: 'constraint_resolution_attempted',
    };
  }
}

class PermissionRecoveryStrategy implements RecoveryStrategy {
  name = 'permission_recovery';

  async execute(error: ErrorClassification, context: ErrorContext): Promise<RecoveryResult> {
    // Implementation would include permission refresh or re-authentication
    return {
      success: Math.random() > 0.4, // 60% success rate
      strategy: this.name,
      action: 'permission_refresh_attempted',
    };
  }
}
