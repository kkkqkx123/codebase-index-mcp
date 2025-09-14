import { injectable, inject } from 'inversify';
import { LoggerService } from './LoggerService';
import { TYPES } from '../types';

export interface ErrorContext {
  component: string;
  operation: string;
  input?: any;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
  stack: string | undefined;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export class CodebaseIndexError extends Error {
  public readonly context: ErrorContext;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = 'CodebaseIndexError';
    this.context = context;
    this.severity = severity;
    // Capture stack trace in a cross-environment way
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, CodebaseIndexError);
    }
  }
}

@injectable()
export class ErrorHandlerService {
  private logger: LoggerService;
  private errorReports: Map<string, ErrorReport> = new Map();
  private errorCallbacks: Array<(error: ErrorReport) => void> = [];

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  handleError(error: Error, context: ErrorContext): ErrorReport {
    const report: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      type: error.name,
      message: error.message,
      stack: error.stack,
      context,
      severity: error instanceof CodebaseIndexError ? error.severity : 'medium',
      handled: false
    };

    this.errorReports.set(report.id, report);
    this.logError(report);
    this.notifyCallbacks(report);

    return report;
  }

  handleAsyncError(operation: () => Promise<any>, context: ErrorContext): Promise<any> {
    return operation().catch((error) => {
      this.handleError(error, context);
      throw error;
    });
  }

  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    component: string
  ): T {
    return ((...args: any[]) => {
      const context: ErrorContext = {
        component,
        operation: fn.name,
        input: args
      };
      return this.handleAsyncError(() => fn(...args), context);
    }) as T;
  }

  onError(callback: (error: ErrorReport) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  getErrorReports(filter?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
    since?: Date;
  }): ErrorReport[] {
    let reports = Array.from(this.errorReports.values());

    if (filter) {
      if (filter.severity) {
        reports = reports.filter(r => r.severity === filter.severity);
      }
      if (filter.component) {
        reports = reports.filter(r => r.context.component === filter.component);
      }
      if (filter.since !== undefined) {
        const since = filter.since;
        reports = reports.filter(r => r.timestamp >= since);
      }
    }

    return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  markErrorHandled(id: string): boolean {
    const report = this.errorReports.get(id);
    if (report) {
      report.handled = true;
      this.logger.info(`Error marked as handled: ${id}`);
      return true;
    }
    return false;
  }

  clearErrorReports(): void {
    this.errorReports.clear();
    this.logger.info('Error reports cleared');
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(report: ErrorReport): void {
    const logData = {
      errorId: report.id,
      type: report.type,
      severity: report.severity,
      component: report.context.component,
      operation: report.context.operation,
      metadata: report.context.metadata
    };

    switch (report.severity) {
      case 'critical':
      case 'high':
        this.logger.error(report.message, logData);
        break;
      case 'medium':
        this.logger.warn(report.message, logData);
        break;
      case 'low':
        this.logger.debug(report.message, logData);
        break;
    }
  }

  private notifyCallbacks(report: ErrorReport): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(report);
      } catch (error) {
        this.logger.error('Error in error callback', error);
      }
    });
  }

  static createConfigError(message: string, context: Partial<ErrorContext>): CodebaseIndexError {
    return new CodebaseIndexError(message, {
      component: 'ConfigService',
      operation: 'validation',
      ...context
    }, 'high');
  }

  static createDatabaseError(message: string, context: Partial<ErrorContext>): CodebaseIndexError {
    return new CodebaseIndexError(message, {
      component: 'DatabaseService',
      operation: 'query',
      ...context
    }, 'high');
  }

  static createFileError(message: string, context: Partial<ErrorContext>): CodebaseIndexError {
    return new CodebaseIndexError(message, {
      component: 'FileService',
      operation: 'io',
      ...context
    }, 'medium');
  }

  static createEmbeddingError(message: string, context: Partial<ErrorContext>): CodebaseIndexError {
    return new CodebaseIndexError(message, {
      component: 'EmbeddingService',
      operation: 'embedding',
      ...context
    }, 'medium');
  }
}