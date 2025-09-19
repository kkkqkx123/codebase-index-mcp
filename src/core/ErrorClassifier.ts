import { ErrorClassification, ErrorContext } from './GraphDatabaseErrorHandler';
import { injectable } from 'inversify';

@injectable()
export class ErrorClassifier {
  classifyError(error: Error): ErrorClassification {
    // Handle null or undefined error
    if (!error) {
      return {
        type: 'unknown',
        severity: 'medium',
        retryable: false,
        suggestedAction: 'Investigate error logs',
      };
    }

    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    // Connection errors
    if (this.isConnectionError(message, name)) {
      return {
        type: 'connection',
        severity: 'critical',
        retryable: true,
        suggestedAction: 'Reconnect to database',
      };
    }

    // Timeout errors
    if (this.isTimeoutError(message, name)) {
      return {
        type: 'timeout',
        severity: 'medium',
        retryable: true,
        suggestedAction: 'Retry with increased timeout',
      };
    }

    // Query syntax errors
    if (this.isQueryError(message, name)) {
      return {
        type: 'query',
        severity: 'high',
        retryable: false,
        suggestedAction: 'Fix query syntax',
      };
    }

    // Constraint violations
    if (this.isConstraintError(message, name)) {
      return {
        type: 'constraint',
        severity: 'medium',
        retryable: false,
        suggestedAction: 'Resolve constraint violation',
      };
    }

    // Permission errors
    if (this.isPermissionError(message, name)) {
      return {
        type: 'permission',
        severity: 'high',
        retryable: false,
        suggestedAction: 'Check user permissions',
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      severity: 'medium',
      retryable: false,
      suggestedAction: 'Investigate error logs',
    };
  }

  private isConnectionError(message: string, name: string): boolean {
    return (
      message.includes('connection') ||
      message.includes('connect') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      name.includes('connection') ||
      name.includes('network')
    );
  }

  private isTimeoutError(message: string, name: string): boolean {
    return (
      message.includes('timeout') ||
      message.includes('time out') ||
      message.includes('etimedout') ||
      message.includes('timed out') ||
      message.includes('timeout after') ||
      message.includes('deadline') ||
      name.includes('timeout')
    );
  }

  private isQueryError(message: string, name: string): boolean {
    return (
      message.includes('syntax') ||
      message.includes('parse') ||
      message.includes('invalid') ||
      message.includes('syntax error') ||
      name.includes('syntax') ||
      name.includes('parse')
    );
  }

  private isConstraintError(message: string, name: string): boolean {
    return (
      message.includes('constraint') ||
      message.includes('unique') ||
      message.includes('duplicate') ||
      message.includes('foreign key') ||
      message.includes('exists') ||
      name.includes('constraint')
    );
  }

  private isPermissionError(message: string, name: string): boolean {
    return (
      message.includes('permission') ||
      message.includes('access') ||
      message.includes('denied') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('insufficient privileges') ||
      name.includes('permission') ||
      name.includes('access')
    );
  }
}
