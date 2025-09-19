import 'reflect-metadata';
import { ErrorClassifier } from '../ErrorClassifier';

describe('ErrorClassifier', () => {
  let errorClassifier: ErrorClassifier;

  beforeEach(() => {
    errorClassifier = new ErrorClassifier();
  });

  describe('classifyError', () => {
    it('should classify connection errors', () => {
      const error = new Error('Connection refused');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('connection');
      expect(classification.severity).toBe('critical');
      expect(classification.retryable).toBeTruthy();
      expect(classification.suggestedAction).toContain('Reconnect to database');
    });

    it('should classify timeout errors', () => {
      const error = new Error('Operation timed out');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('timeout');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBeTruthy();
      expect(classification.suggestedAction).toContain('Retry with increased timeout');
    });

    it('should classify query errors', () => {
      const error = new Error('Syntax error in query');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('query');
      expect(classification.severity).toBe('high');
      expect(classification.retryable).toBeFalsy();
      expect(classification.suggestedAction).toContain('Fix query syntax');
    });

    it('should classify constraint errors', () => {
      const error = new Error('Unique constraint violation');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('constraint');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBeFalsy();
      expect(classification.suggestedAction).toContain('Resolve constraint violation');
    });

    it('should classify permission errors', () => {
      const error = new Error('Permission denied');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('permission');
      expect(classification.severity).toBe('high');
      expect(classification.retryable).toBeFalsy();
      expect(classification.suggestedAction).toContain('Check user permissions');
    });

    it('should classify unknown errors as unknown type', () => {
      const error = new Error('Some random error');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBeFalsy();
      expect(classification.suggestedAction).toContain('Investigate error logs');
    });

    it('should handle errors with specific error names', () => {
      const error = new Error('Connection failed');
      error.name = 'ConnectionError';
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('connection');
    });

    it('should handle empty error messages', () => {
      const error = new Error('');
      const classification = errorClassifier.classifyError(error);
      
      expect(classification.type).toBe('unknown');
    });

    it('should handle null error', () => {
      const classification = errorClassifier.classifyError(null as any);
      
      expect(classification.type).toBe('unknown');
      expect(classification.severity).toBe('medium');
    });
  });

  describe('private helper methods', () => {
    // Test the private methods indirectly through classifyError
    it('should detect connection errors correctly', () => {
      const testCases = [
        'Connection refused',
        'Connection timeout',
        'Network unreachable',
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND'
      ];

      testCases.forEach(message => {
        const error = new Error(message);
        const classification = errorClassifier.classifyError(error);
        expect(classification.type).toBe('connection');
      });
    });

    it('should detect timeout errors correctly', () => {
      const testCases = [
        'Operation timed out',
        'Timeout exceeded',
        'ETIMEDOUT',
        'timeout after'
      ];

      testCases.forEach(message => {
        const error = new Error(message);
        const classification = errorClassifier.classifyError(error);
        expect(classification.type).toBe('timeout');
      });
    });

    it('should detect query errors correctly', () => {
      const testCases = [
        'Syntax error',
        'Invalid query',
        'SQL syntax',
        'Parse error',
        'cypher syntax'
      ];

      testCases.forEach(message => {
        const error = new Error(message);
        const classification = errorClassifier.classifyError(error);
        expect(classification.type).toBe('query');
      });
    });

    it('should detect constraint errors correctly', () => {
      const testCases = [
        'Unique constraint',
        'Constraint violation',
        'Duplicate entry',
        'Foreign key constraint'
      ];

      testCases.forEach(message => {
        const error = new Error(message);
        const classification = errorClassifier.classifyError(error);
        expect(classification.type).toBe('constraint');
      });
    });

    it('should detect permission errors correctly', () => {
      const testCases = [
        'Permission denied',
        'Access denied',
        'Unauthorized',
        'Forbidden',
        'Insufficient privileges'
      ];

      testCases.forEach(message => {
        const error = new Error(message);
        const classification = errorClassifier.classifyError(error);
        expect(classification.type).toBe('permission');
      });
    });
  });
});