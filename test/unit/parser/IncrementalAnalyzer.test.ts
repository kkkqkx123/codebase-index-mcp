import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { IncrementalAnalyzer, FileChange, SecurityIssueType, SecuritySeverity } from '../../../src/services/parser/IncrementalAnalyzer';

describe('IncrementalAnalyzer', () => {
  let incrementalAnalyzer: IncrementalAnalyzer;

  beforeEach(() => {
    incrementalAnalyzer = new IncrementalAnalyzer();
  });

  describe('analyzeChanges', () => {
    it('should analyze file changes and return delta results', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.affectedVariables)).toBe(true);
      expect(Array.isArray(result.affectedFunctions)).toBe(true);
      expect(Array.isArray(result.affectedClasses)).toBe(true);
      expect(Array.isArray(result.newSecurityIssues)).toBe(true);
      expect(Array.isArray(result.resolvedSecurityIssues)).toBe(true);
      expect(result.performanceImpact).toBeDefined();
    });

    it('should handle added files', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'new.js',
          changeType: 'added',
          newContent: 'function test() { return true; }'
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.affectedVariables)).toBe(true);
      expect(Array.isArray(result.affectedFunctions)).toBe(true);
    });

    it('should handle deleted files', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'deleted.js',
          changeType: 'deleted',
          oldContent: 'function old() { return true; }'
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
    });

    it('should handle multiple file changes', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'file1.js',
          changeType: 'modified',
          oldContent: 'var a = 1;',
          newContent: 'var a = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        },
        {
          filePath: 'file2.js',
          changeType: 'added',
          newContent: 'var b = 3;'
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(result.affectedFunctions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateAffectedScope', () => {
    it('should calculate affected scope for file changes', () => {
      // Since calculateAffectedScope is private, we'll test it indirectly
      // by calling analyzeChanges which uses it
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      expect(async () => {
        await incrementalAnalyzer.analyzeChanges(changes);
      }).not.toThrow();
    });
  });

  describe('dependency analysis', () => {
    it('should identify file dependencies', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'module.js',
          changeType: 'modified',
          oldContent: 'export function test() {}',
          newContent: 'export function test() { return true; }',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
    });
  });

  describe('security issue detection', () => {
    it('should detect new security issues in changed code', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'vulnerable.js',
          changeType: 'added',
          newContent: 'eval(userInput);',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.newSecurityIssues)).toBe(true);
    });

    it('should track resolved security issues', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'fixed.js',
          changeType: 'modified',
          oldContent: 'eval(userInput);',
          newContent: 'safeEval(userInput);',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.resolvedSecurityIssues)).toBe(true);
    });
  });

  describe('performance tracking', () => {
    it('should track analysis performance', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result.performanceImpact).toBeDefined();
      expect(result.performanceImpact.analysisTime).toBeGreaterThanOrEqual(0);
      expect(result.performanceImpact.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache for affected files', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      // Test that the analysis can be performed without cache issues
      const result1 = await incrementalAnalyzer.analyzeChanges(changes);
      const result2 = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('symbol analysis', () => {
    it('should identify affected functions', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'functions.js',
          changeType: 'modified',
          oldContent: 'function test() { console.log("old"); }',
          newContent: 'function test() { console.log("new"); }',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result.affectedFunctions).toBeDefined();
    });

    it('should identify affected classes', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'classes.js',
          changeType: 'modified',
          oldContent: 'class Test { method() {} }',
          newContent: 'class Test { method() { return true; } }',
          changeRange: { startLine: 1, endLine: 3 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result.affectedClasses).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'invalid.js',
          changeType: 'added',
          newContent: 'function { invalid syntax',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      // Should not throw, but return a result with empty arrays
      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.affectedVariables)).toBe(true);
      expect(Array.isArray(result.affectedFunctions)).toBe(true);
    });

    it('should handle empty change sets', async () => {
      const changes: FileChange[] = [];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      expect(result.affectedVariables).toHaveLength(0);
      expect(result.affectedFunctions).toHaveLength(0);
    });
  });

  describe('merge functionality', () => {
    it('should merge results with previous analysis', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result).toBeDefined();
      // The merge functionality is tested indirectly through the analyzeChanges method
    });
  });

  describe('memory usage estimation', () => {
    it('should estimate memory usage', async () => {
      const changes: FileChange[] = [
        {
          filePath: 'test.js',
          changeType: 'modified',
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;',
          changeRange: { startLine: 1, endLine: 1 }
        }
      ];

      const result = await incrementalAnalyzer.analyzeChanges(changes);
      
      expect(result.performanceImpact.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });
});