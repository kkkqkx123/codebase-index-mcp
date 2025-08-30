import { 
  ErrorHandlerService, 
  CodebaseIndexError, 
  ErrorContext, 
  ErrorReport 
} from '../ErrorHandlerService';
import { LoggerService } from '../LoggerService';

// Mock LoggerService
jest.mock('../../src/core/LoggerService');
const MockedLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ErrorHandlerService', () => {
  let errorHandlerService: ErrorHandlerService;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // Create mock logger service
    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    // Reset mock implementation
    MockedLoggerService.mockClear();

    // Create ErrorHandlerService instance
    errorHandlerService = new ErrorHandlerService(mockLoggerService);
  });

  describe('Constructor', () => {
    it('should initialize with provided logger service', () => {
      expect(errorHandlerService).toBeInstanceOf(ErrorHandlerService);
    });

    it('should initialize empty error reports map', () => {
      const errorReports = (errorHandlerService as any).errorReports;
      expect(errorReports).toBeInstanceOf(Map);
      expect(errorReports.size).toBe(0);
    });

    it('should initialize empty error callbacks array', () => {
      const errorCallbacks = (errorHandlerService as any).errorCallbacks;
      expect(Array.isArray(errorCallbacks)).toBe(true);
      expect(errorCallbacks.length).toBe(0);
    });
  });

  describe('handleError Method', () => {
    it('should handle standard Error object', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);

      expect(report).toMatchObject({
        type: 'Error',
        message: 'Test error',
        context,
        severity: 'medium',
        handled: false,
      });

      expect(report.id).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.stack).toBeDefined();
    });

    it('should handle CodebaseIndexError with custom severity', () => {
      const error = new CodebaseIndexError(
        'Custom error',
        { component: 'TestComponent', operation: 'testOperation' },
        'high'
      );
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);

      expect(report.severity).toBe('high');
      expect(report.type).toBe('CodebaseIndexError');
    });

    it('should store error report in internal map', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);
      const errorReports = (errorHandlerService as any).errorReports;

      expect(errorReports.has(report.id)).toBe(true);
      expect(errorReports.get(report.id)).toBe(report);
    });

    it('should log error based on severity', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
        metadata: { test: 'data' },
      };

      errorHandlerService.handleError(error, context);

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Test error',
        expect.objectContaining({
          errorId: expect.any(String),
          type: 'Error',
          severity: 'medium',
          component: 'TestComponent',
          operation: 'testOperation',
          metadata: { test: 'data' },
        })
      );
    });

    it('should log critical severity as error', () => {
      const error = new CodebaseIndexError(
        'Critical error',
        { component: 'TestComponent', operation: 'testOperation' },
        'critical'
      );
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      errorHandlerService.handleError(error, context);

      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should log high severity as error', () => {
      const error = new CodebaseIndexError(
        'High severity error',
        { component: 'TestComponent', operation: 'testOperation' },
        'high'
      );
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      errorHandlerService.handleError(error, context);

      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should log medium severity as warning', () => {
      const error = new CodebaseIndexError(
        'Medium severity error',
        { component: 'TestComponent', operation: 'testOperation' },
        'medium'
      );
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      errorHandlerService.handleError(error, context);

      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should log low severity as debug', () => {
      const error = new CodebaseIndexError(
        'Low severity error',
        { component: 'TestComponent', operation: 'testOperation' },
        'low'
      );
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      errorHandlerService.handleError(error, context);

      expect(mockLoggerService.debug).toHaveBeenCalled();
    });

    it('should notify error callbacks', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const mockCallback = jest.fn();
      errorHandlerService.onError(mockCallback);

      errorHandlerService.handleError(error, context);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          context,
        })
      );
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete (error as any).stack;
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);

      expect(report.stack).toBeUndefined();
    });
  });

  describe('handleAsyncError Method', () => {
    it('should handle successful async operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const result = await errorHandlerService.handleAsyncError(operation, context);

      expect(result).toBe('success');
    });

    it('should handle failed async operation', async () => {
      const error = new Error('Async error');
      const operation = jest.fn().mockRejectedValue(error);
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      await expect(errorHandlerService.handleAsyncError(operation, context))
        .rejects.toThrow('Async error');
    });

    it('should preserve original error when handling async error', async () => {
      const originalError = new Error('Original error');
      const operation = jest.fn().mockRejectedValue(originalError);
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      await expect(errorHandlerService.handleAsyncError(operation, context))
        .rejects.toBe(originalError);
    });
  });

  describe('wrapAsync Method', () => {
    it('should return a wrapped function that handles errors', async () => {
      const originalFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = errorHandlerService.wrapAsync(originalFn, 'TestComponent');

      const result = await wrappedFn('arg1', 'arg2');

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle errors in wrapped function', async () => {
      const error = new Error('Wrapped error');
      const originalFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = errorHandlerService.wrapAsync(originalFn, 'TestComponent');

      await expect(wrappedFn('arg1', 'arg2'))
        .rejects.toThrow('Wrapped error');

      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('onError Method', () => {
    it('should register error callback', () => {
      const callback = jest.fn();
      const unsubscribe = errorHandlerService.onError(callback);

      expect(typeof unsubscribe).toBe('function');
      
      // Check that callback is registered
      const errorCallbacks = (errorHandlerService as any).errorCallbacks;
      expect(errorCallbacks).toContain(callback);
    });

    it('should return unsubscribe function that removes callback', () => {
      const callback = jest.fn();
      const unsubscribe = errorHandlerService.onError(callback);

      unsubscribe();

      const errorCallbacks = (errorHandlerService as any).errorCallbacks;
      expect(errorCallbacks).not.toContain(callback);
    });

    it('should handle multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      errorHandlerService.onError(callback1);
      errorHandlerService.onError(callback2);
      errorHandlerService.onError(callback3);

      const errorCallbacks = (errorHandlerService as any).errorCallbacks;
      expect(errorCallbacks).toHaveLength(3);
      expect(errorCallbacks).toContain(callback1);
      expect(errorCallbacks).toContain(callback2);
      expect(errorCallbacks).toContain(callback3);
    });

    it('should not error when unregistering non-existent callback', () => {
      const callback = jest.fn();
      const unsubscribe = errorHandlerService.onError(callback);

      unsubscribe(); // First unsubscribe
      unsubscribe(); // Second unsubscribe should not error
    });
  });

  describe('getErrorReports Method', () => {
    it('should return all error reports when no filter is provided', () => {
      errorHandlerService.handleError(new Error('Error 1'), {
        component: 'Component1',
        operation: 'operation1',
      });

      errorHandlerService.handleError(new Error('Error 2'), {
        component: 'Component2',
        operation: 'operation2',
      });

      const reports = errorHandlerService.getErrorReports();

      expect(reports).toHaveLength(2);
      expect(reports.map(r => r.message)).toContain('Error 1');
      expect(reports.map(r => r.message)).toContain('Error 2');
    });

    it('should filter by severity', () => {
      const highSeverityError = new CodebaseIndexError(
        'High severity error',
        { component: 'Component1', operation: 'operation1' },
        'high'
      );
      errorHandlerService.handleError(highSeverityError, {
        component: 'Component1',
        operation: 'operation1',
      });

      const reports = errorHandlerService.getErrorReports({ severity: 'high' });

      expect(reports).toHaveLength(1);
      expect(reports[0].severity).toBe('high');
      expect(reports[0].message).toBe('High severity error');
    });

    it('should filter by component', () => {
      errorHandlerService.handleError(new Error('Component 2 error'), {
        component: 'Component2',
        operation: 'operation1',
      });

      const reports = errorHandlerService.getErrorReports({ component: 'Component2' });

      expect(reports).toHaveLength(1);
      expect(reports[0].context.component).toBe('Component2');
    });

    it('should apply multiple filters', () => {
      const highSeverityError = new CodebaseIndexError(
        'High severity error',
        { component: 'Component1', operation: 'operation1' },
        'high'
      );
      errorHandlerService.handleError(highSeverityError, {
        component: 'Component1',
        operation: 'operation1',
      });

      const reports = errorHandlerService.getErrorReports({ 
        severity: 'high',
        component: 'Component1'
      });

      expect(reports).toHaveLength(1);
      expect(reports[0].severity).toBe('high');
      expect(reports[0].context.component).toBe('Component1');
    });

    it('should return empty array when no reports match filter', () => {
      const reports = errorHandlerService.getErrorReports({ 
        component: 'NonExistentComponent'
      });

      expect(reports).toHaveLength(0);
    });
  });

  describe('markErrorHandled Method', () => {
    it('should mark existing error as handled', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);
      const result = errorHandlerService.markErrorHandled(report.id);

      expect(result).toBe(true);
      expect(report.handled).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        `Error marked as handled: ${report.id}`
      );
    });

    it('should return false for non-existent error ID', () => {
      const result = errorHandlerService.markErrorHandled('non-existent-id');

      expect(result).toBe(false);
      expect(mockLoggerService.info).not.toHaveBeenCalled();
    });
  });

  describe('clearErrorReports Method', () => {
    it('should clear all error reports', () => {
      // Add some error reports
      errorHandlerService.handleError(new Error('Error 1'), {
        component: 'Component1',
        operation: 'operation1',
      });
      errorHandlerService.handleError(new Error('Error 2'), {
        component: 'Component2',
        operation: 'operation2',
      });

      errorHandlerService.clearErrorReports();

      const reports = errorHandlerService.getErrorReports();
      expect(reports).toHaveLength(0);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Error reports cleared');
    });

    it('should work when no error reports exist', () => {
      errorHandlerService.clearErrorReports();

      const reports = errorHandlerService.getErrorReports();
      expect(reports).toHaveLength(0);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Error reports cleared');
    });
  });

  describe('Static Error Factory Methods', () => {
    it('should create config error with high severity', () => {
      const error = ErrorHandlerService.createConfigError('Config validation failed', {
        input: { invalid: true }
      });

      expect(error).toBeInstanceOf(CodebaseIndexError);
      expect(error.message).toBe('Config validation failed');
      expect(error.severity).toBe('high');
      expect(error.context.component).toBe('ConfigService');
      expect(error.context.operation).toBe('validation');
      expect(error.context.input).toEqual({ invalid: true });
    });

    it('should create database error with high severity', () => {
      const error = ErrorHandlerService.createDatabaseError('Database connection failed', {
        metadata: { host: 'localhost' }
      });

      expect(error).toBeInstanceOf(CodebaseIndexError);
      expect(error.message).toBe('Database connection failed');
      expect(error.severity).toBe('high');
      expect(error.context.component).toBe('DatabaseService');
      expect(error.context.operation).toBe('query');
      expect(error.context.metadata).toEqual({ host: 'localhost' });
    });

    it('should create file error with medium severity', () => {
      const error = ErrorHandlerService.createFileError('File not found', {
        input: { path: '/test/file.txt' }
      });

      expect(error).toBeInstanceOf(CodebaseIndexError);
      expect(error.message).toBe('File not found');
      expect(error.severity).toBe('medium');
      expect(error.context.component).toBe('FileService');
      expect(error.context.operation).toBe('io');
      expect(error.context.input).toEqual({ path: '/test/file.txt' });
    });

    it('should create embedding error with medium severity', () => {
      const error = ErrorHandlerService.createEmbeddingError('Embedding generation failed', {
        metadata: { model: 'text-embedding-ada-002' }
      });

      expect(error).toBeInstanceOf(CodebaseIndexError);
      expect(error.message).toBe('Embedding generation failed');
      expect(error.severity).toBe('medium');
      expect(error.context.component).toBe('EmbeddingService');
      expect(error.context.operation).toBe('embedding');
      expect(error.context.metadata).toEqual({ model: 'text-embedding-ada-002' });
    });

    it('should handle empty context in factory methods', () => {
      const error = ErrorHandlerService.createConfigError('Test error', {});

      expect(error.context.component).toBe('ConfigService');
      expect(error.context.operation).toBe('validation');
    });
  });

  describe('Error Callback Error Handling', () => {
    it('should handle errors in error callbacks gracefully', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      errorHandlerService.onError(errorCallback);

      // Should not throw even though callback throws
      expect(() => {
        errorHandlerService.handleError(error, context);
      }).not.toThrow();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Error in error callback',
        expect.any(Error)
      );
    });

    it('should continue processing other callbacks when one fails', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const failingCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const workingCallback = jest.fn();

      errorHandlerService.onError(failingCallback);
      errorHandlerService.onError(workingCallback);

      expect(() => {
        errorHandlerService.handleError(error, context);
      }).not.toThrow();

      expect(failingCallback).toHaveBeenCalled();
      expect(workingCallback).toHaveBeenCalled();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Error in error callback',
        expect.any(Error)
      );
    });
  });

  describe('Error ID Generation', () => {
    it('should generate unique error IDs', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report1 = errorHandlerService.handleError(error1, context);
      const report2 = errorHandlerService.handleError(error2, context);

      expect(report1.id).not.toBe(report2.id);
      expect(report1.id).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(report2.id).toMatch(/^error_\d+_[a-z0-9]+$/);
    });

    it('should include timestamp in error ID', () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        component: 'TestComponent',
        operation: 'testOperation',
      };

      const report = errorHandlerService.handleError(error, context);
      const timestampPart = report.id.split('_')[1];

      expect(parseInt(timestampPart)).toBeGreaterThan(Date.now() - 1000);
      expect(parseInt(timestampPart)).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('CodebaseIndexError Class', () => {
    it('should extend Error class', () => {
      const error = new CodebaseIndexError(
        'Test error',
        { component: 'TestComponent', operation: 'testOperation' },
        'medium'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CodebaseIndexError);
    });

    it('should set name correctly', () => {
      const error = new CodebaseIndexError(
        'Test error',
        { component: 'TestComponent', operation: 'testOperation' },
        'medium'
      );

      expect(error.name).toBe('CodebaseIndexError');
    });

    it('should capture stack trace when available', () => {
      const originalCaptureStackTrace = (Error as any).captureStackTrace;
      (Error as any).captureStackTrace = jest.fn();

      new CodebaseIndexError(
        'Test error',
        { component: 'TestComponent', operation: 'testOperation' },
        'medium'
      );

      expect((Error as any).captureStackTrace).toHaveBeenCalled();

      // Restore original function
      (Error as any).captureStackTrace = originalCaptureStackTrace;
    });

    it('should not fail when captureStackTrace is not available', () => {
      const originalCaptureStackTrace = (Error as any).captureStackTrace;
      (Error as any).captureStackTrace = undefined;

      expect(() => {
        new CodebaseIndexError(
          'Test error',
          { component: 'TestComponent', operation: 'testOperation' },
          'medium'
        );
      }).not.toThrow();

      // Restore original function
      (Error as any).captureStackTrace = originalCaptureStackTrace;
    });
  });
});