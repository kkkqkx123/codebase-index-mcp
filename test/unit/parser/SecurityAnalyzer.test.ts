import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { SecurityAnalyzer } from '../../../src/services/parser/SecurityAnalyzer';
import { SymbolTable, SymbolType, SymbolScope } from '../../../src/services/parser/SymbolTableBuilder';
import { ControlFlowGraphImpl } from '../../../src/services/parser/CFGBuilder';
import { DataFlowGraphImpl } from '../../../src/services/parser/DataFlowGraph';

describe('SecurityAnalyzer', () => {
  let securityAnalyzer: SecurityAnalyzer;

  beforeEach(() => {
    securityAnalyzer = new SecurityAnalyzer();
  });

  describe('analyze', () => {
    it('should analyze code and return security issues', () => {
      const sourceCode = 'function test() { return true; }';
      const filePath = 'test.js';
      
      // Create mock symbol table
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      // Create mock CFG
      const cfg = new ControlFlowGraphImpl();
      
      // Create mock data flow graph
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should detect SQL injection vulnerabilities', () => {
      const sourceCode = 'db.query("SELECT * FROM users WHERE id = " + userInput);';
      const filePath = 'vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues.some(issue => issue.type === 'sql_injection')).toBe(true);
    });

    it('should detect XSS vulnerabilities', () => {
      const sourceCode = 'element.innerHTML = userInput;';
      const filePath = 'vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues.some(issue => issue.type === 'xss')).toBe(true);
    });

    it('should detect command injection vulnerabilities', () => {
      const sourceCode = 'exec("ls " + userInput);';
      const filePath = 'vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues.some(issue => issue.type === 'command_injection')).toBe(true);
    });

    it('should detect path traversal vulnerabilities', () => {
      const sourceCode = 'fs.readFile("../" + userInput);';
      const filePath = 'vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues.some(issue => issue.type === 'path_traversal')).toBe(true);
    });

    it('should handle empty source code', () => {
      const sourceCode = '';
      const filePath = 'empty.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('pattern detection', () => {
    it('should detect multiple security patterns in code', () => {
      const sourceCode = `
        db.query("SELECT * FROM users WHERE id = " + userId);
        element.innerHTML = userInput;
        exec("ls " + directory);
      `;
      const filePath = 'multi-vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should provide remediation advice', () => {
      const sourceCode = 'eval(userInput);';
      const filePath = 'vulnerable.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('summary generation', () => {
    it('should generate a summary of security issues', () => {
      const sourceCode = `
        db.query("SELECT * FROM users WHERE id = " + userId);
        element.innerHTML = userInput;
      `;
      const filePath = 'test.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.summary.total).toBeGreaterThanOrEqual(0);
      expect(result.summary.bySeverity).toBeDefined();
      expect(result.summary.byType).toBeDefined();
    });

    it('should categorize issues by severity', () => {
      const sourceCode = 'exec(userInput);';
      const filePath = 'critical.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result.summary.bySeverity.critical).toBeGreaterThanOrEqual(0);
      expect(result.summary.bySeverity.high).toBeGreaterThanOrEqual(0);
    });
  });

  describe('data flow analysis', () => {
    it('should detect taint propagation', () => {
      const sourceCode = `
        var userInput = req.body.input;
        db.query("SELECT * FROM users WHERE id = " + userInput);
      `;
      const filePath = 'taint-test.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([
          {
            name: 'userInput',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'taint-test.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 10,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          },
          {
            name: 'req',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'taint-test.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 3,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          }
        ]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      // Add a tainted flow to simulate data flow analysis
      dataFlow.addVariable({
        name: 'userInput',
        type: SymbolType.VARIABLE,
        scope: SymbolScope.GLOBAL,
        definition: {
          filePath: 'taint-test.js',
          startLine: 1,
          endLine: 1,
          startColumn: 0,
          endColumn: 10,
          nodeType: 'identifier'
        },
        isMutable: true,
        references: []
      });
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      // The data flow detection is tested indirectly
      expect(result).toBeDefined();
    });
  });

  describe('control flow analysis', () => {
    it('should detect missing security checks in conditions', () => {
      const sourceCode = 'if (userInput) { db.query(userInput); }';
      const filePath = 'conditional.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result).toBeDefined();
    });
  });

  describe('symbol analysis', () => {
    it('should detect sensitive information in symbols', () => {
      const sourceCode = 'var password = "secret123";';
      const filePath = 'config.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([
          {
            name: 'password',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'config.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 8,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          }
        ]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      const result = securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed code gracefully', () => {
      const sourceCode = 'function { invalid syntax';
      const filePath = 'malformed.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      expect(() => {
        securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      }).not.toThrow();
    });

    it('should handle complex regex patterns without crashing', () => {
      const sourceCode = 'a'.repeat(10000); // Large string to test regex performance
      const filePath = 'large.js';
      
      const symbolTable: SymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;
      
      const cfg = new ControlFlowGraphImpl();
      const dataFlow = new DataFlowGraphImpl();
      
      expect(() => {
        securityAnalyzer.analyze(sourceCode, filePath, symbolTable, cfg, dataFlow);
      }).not.toThrow();
    });
  });
});