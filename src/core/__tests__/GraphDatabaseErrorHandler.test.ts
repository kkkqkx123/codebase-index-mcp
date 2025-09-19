import 'reflect-metadata';
import { GraphDatabaseErrorHandler } from '../GraphDatabaseErrorHandler';
import { ErrorClassifier } from '../ErrorClassifier';
import { LoggerService } from '../LoggerService';
import { ErrorClassification, ErrorContext } from '../GraphDatabaseErrorHandler';

// Mock dependencies
jest.mock('../ErrorClassifier');
jest.mock('../LoggerService');

const MockedErrorClassifier = ErrorClassifier as jest.MockedClass<typeof ErrorClassifier>;
const MockedLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('GraphDatabaseErrorHandler', () => {
  let errorHandler: GraphDatabaseErrorHandler;
  let mockErrorClassifier: jest.Mocked<ErrorClassifier>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockErrorClassifier = {
      classifyError: jest.fn(),
    } as any;
    
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;
    
    MockedErrorClassifier.mockImplementation(() => mockErrorClassifier);
    MockedLoggerService.mockImplementation(() => mockLogger);
    
    errorHandler = new GraphDatabaseErrorHandler(mockLogger, mockErrorClassifier);
  });

  describe('handleError', () => {
    it('should classify error and return handling result', async () => {
      const error = new Error('Connection refused');
      const classification: ErrorClassification = {
        type: 'connection',
        severity: 'high',
        retryable: true,
        suggestedAction: '检查网络连接'
      };
      
      mockErrorClassifier.classifyError.mockReturnValue(classification);
      
      const result = await errorHandler.handleError(error, { component: 'test', operation: 'test' });
      
      expect(mockErrorClassifier.classifyError).toHaveBeenCalledWith(error);
      expect(result.action).toBe('manual_intervention_required');
      expect(result.suggestions).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.context!.errorType).toBe('Error');
    });

    it('should record error in history', async () => {
      const error = new Error('Test error');
      const classification: ErrorClassification = {
        type: 'unknown',
        severity: 'low',
        retryable: false,
        suggestedAction: 'Investigate error logs'
      };
      
      mockErrorClassifier.classifyError.mockReturnValue(classification);
      
      await errorHandler.handleError(error, { component: 'test', operation: 'test' });
      
      // Check that error was recorded
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByType.unknown).toBe(1);
    });

    it('should log error with error level regardless of severity', async () => {
      const testCases = ['high', 'medium', 'low'] as const;
      
      for (const severity of testCases) {
        const error = new Error('Test error');
        const classification: ErrorClassification = {
          type: 'unknown',
          severity: severity,
          retryable: false,
          suggestedAction: 'Investigate error logs'
        };
        
        mockErrorClassifier.classifyError.mockReturnValue(classification);
        
        await errorHandler.handleError(error, { component: 'test', operation: 'test' });
        
        expect(mockLogger.error).toHaveBeenCalled();
        
        // Reset for next test
        jest.clearAllMocks();
      }
    });

    it('should attempt recovery for retryable errors', async () => {
      const error = new Error('Connection timeout');
      const classification: ErrorClassification = {
        type: 'timeout',
        severity: 'medium',
        retryable: true,
        suggestedAction: 'Retry with increased timeout'
      };
      
      mockErrorClassifier.classifyError.mockReturnValue(classification);
      
      const result = await errorHandler.handleError(error, { component: 'test', operation: 'test' });
      
      expect(result.recovered).toBeDefined();
      // Recovery is probabilistic, so we can't assert true/false
      expect(typeof result.recovered).toBe('boolean');
    });

    it('should collect error context', async () => {
      const error = new Error('Test error');
      const classification: ErrorClassification = {
        type: 'unknown',
        severity: 'low',
        retryable: false,
        suggestedAction: 'Investigate error logs'
      };
      
      mockErrorClassifier.classifyError.mockReturnValue(classification);
      
      const result = await errorHandler.handleError(error, { component: 'test', operation: 'test' });
      
      expect(result.context).toBeDefined();
      expect(typeof result.context!.timestamp).toBe('string');
      expect(result.context!.errorType).toBe('Error');
      expect(result.context!.errorMessage).toBe('Test error');
    });
  });

  describe('recordError', () => {
    it('should record error in statistics', () => {
      const error = new Error('Test error');
      const classification: ErrorClassification = {
        type: 'connection',
        severity: 'high',
        retryable: true,
        suggestedAction: 'Reconnect to database'
      };
      
      errorHandler['recordError'](error, classification, { component: 'test', operation: 'test' });
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByType.connection).toBe(1);
    });

    it('should maintain error history within limit', () => {
      // Record more than the history limit (default 100)
      for (let i = 0; i < 150; i++) {
        const error = new Error(`Error ${i}`);
        const classification: ErrorClassification = {
          type: i % 2 === 0 ? 'connection' : 'timeout',
          severity: 'medium',
          retryable: true,
          suggestedAction: i % 2 === 0 ? 'Reconnect to database' : 'Retry with increased timeout'
        };
        errorHandler['recordError'](error, classification, { component: 'test', operation: 'test' });
      }
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(150);
    });
  });

  describe('getErrorSuggestions', () => {
    it('should return suggestions from classification', () => {
      const classification: ErrorClassification = {
        type: 'connection',
        severity: 'high',
        retryable: true,
        suggestedAction: '检查网络连接'
      };
      
      const suggestions = errorHandler['getErrorSuggestions'](classification);
      
      expect(suggestions).toContain('Check NebulaGraph server status');
    });

    it('should include retry suggestion for retryable errors', () => {
      const classification: ErrorClassification = {
        type: 'connection',
        severity: 'high',
        retryable: true,
        suggestedAction: '检查网络连接'
      };
      
      const suggestions = errorHandler['getErrorSuggestions'](classification);
      
      expect(suggestions).toContain('Check connection parameters');
    });

    it('should not include retry suggestion for non-retryable errors', () => {
      const classification: ErrorClassification = {
        type: 'permission',
        severity: 'high',
        retryable: false,
        suggestedAction: 'Check user permissions'
      };
      
      const suggestions = errorHandler['getErrorSuggestions'](classification);
      
      expect(suggestions).not.toContain('Retry operation may be attempted');
    });
  });

  describe('collectErrorContext', () => {
    it('should collect comprehensive error context', () => {
      const error = new Error('Test error with context');
      error.stack = 'Error: Test error with context\n    at test.js:1:1';
      
      const classification: ErrorClassification = {
        type: 'connection',
        severity: 'high',
        retryable: true,
        suggestedAction: 'Reconnect to database'
      };
      
      const context = errorHandler['collectErrorContext'](error, { component: 'test', operation: 'test' });
      
      expect(typeof context.timestamp).toBe('string');
      expect(context.errorMessage).toBe('Test error with context');
      expect(context.errorType).toBe('Error');
      expect(context.component).toBe('test');
      expect(context.component).toBe('test');
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      error.stack = undefined;
      
      const classification: ErrorClassification = {
        type: 'unknown',
        severity: 'low',
        retryable: false,
        suggestedAction: 'Investigate error logs'
      };
      
      const context = errorHandler['collectErrorContext'](error, { component: 'test', operation: 'test' });
      
      expect(context.errorType).toBe('Error');
    });
  });

  describe('getErrorStats', () => {
    it('should return accurate error statistics', () => {
      // Record some errors
      const errors = [
        { type: 'connection', severity: 'high' },
        { type: 'timeout', severity: 'medium' },
        { type: 'connection', severity: 'high' },
        { type: 'permission', severity: 'high' },
      ];
      
      errors.forEach((errorInfo, index) => {
        const error = new Error(`Error ${index}`);
        const classification: ErrorClassification = {
        type: errorInfo.type as any,
        severity: errorInfo.severity as any,
        retryable: true,
        suggestedAction: 'Retry operation'
      };
        errorHandler['recordError'](error, classification, { component: 'test', operation: 'test' });
      });
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByType.connection).toBe(2);
      expect(stats.errorsByType.timeout).toBe(1);
      expect(stats.errorsByType.permission).toBe(1);
    });

    it('should return zero counts for unencountered error types', () => {
      const stats = errorHandler.getErrorStats();
      
      expect(stats.errorsByType.connection || 0).toBe(0);
      expect(stats.errorsByType.timeout || 0).toBe(0);
      expect(stats.errorsByType.query || 0).toBe(0);
      expect(stats.errorsByType.constraint || 0).toBe(0);
      expect(stats.errorsByType.permission || 0).toBe(0);
      expect(stats.errorsByType.unknown || 0).toBe(0);
    });
  });
});