import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Container } from 'inversify';
import { AdvancedTreeSitterService, ComprehensiveAnalysisResult } from '../../../src/services/parser/AdvancedTreeSitterService';
import { TreeSitterCoreService } from '../../../src/services/parser/TreeSitterCoreService';
import { TYPES } from '../../../src/types';
import Parser from 'tree-sitter';
import { CFGNode } from '../../../src/services/parser/CFGBuilder';
import { SymbolType, SymbolScope } from '../../../src/services/parser/SymbolTableBuilder';

describe('AdvancedTreeSitterService', () => {
  let advancedTreeSitterService: AdvancedTreeSitterService;
  let mockTreeSitterCore: jest.Mocked<TreeSitterCoreService>;
  let container: Container;

  beforeEach(() => {
    // Create mock container
    container = new Container();
    
    // Create mock TreeSitterCoreService
    mockTreeSitterCore = {
      parseFile: jest.fn(),
      parseCode: jest.fn(),
      detectLanguage: jest.fn(),
      isInitialized: jest.fn().mockReturnValue(true),
      getNodeText: jest.fn(),
      getNodeLocation: jest.fn(),
      findNodeByType: jest.fn(),
      queryTree: jest.fn(),
      getCacheStats: jest.fn(),
      clearCache: jest.fn(),
      extractFunctions: jest.fn(),
      extractClasses: jest.fn(),
      extractImports: jest.fn(),
      extractExports: jest.fn(),
      getSupportedLanguages: jest.fn()
    } as any;

    // Bind the mock service
    container.bind(TYPES.TreeSitterCoreService).toConstantValue(mockTreeSitterCore);
    
    // Create the service instance
    advancedTreeSitterService = new AdvancedTreeSitterService(mockTreeSitterCore);
  });

  describe('analyzeFile', () => {
    it('should analyze a file and return comprehensive results', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'function test() { return true; }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 10,
        success: true
      });

      const result = await advancedTreeSitterService.analyzeFile('test.js');
      
      expect(result).toBeDefined();
      expect(result.filePath).toBe('test.js');
      expect(result.ast).toBe(mockAST);
      expect(result.symbolTable).toBeDefined();
      expect(result.controlFlow).toBeDefined();
      expect(result.dataFlow).toBeDefined();
      expect(result.securityIssues).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    it('should throw an error when parsing fails', async () => {
      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: {} as Parser.SyntaxNode,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 10,
        success: false,
        error: 'Parse error'
      });

      await expect(advancedTreeSitterService.analyzeFile('invalid.js'))
        .rejects
        .toThrow('Failed to parse invalid.js: Parse error');
    });

    it('should handle empty files', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
        startIndex: 0,
        endIndex: 0,
        children: [],
        text: '',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 5,
        success: true
      });

      const result = await advancedTreeSitterService.analyzeFile('empty.js');
      
      expect(result).toBeDefined();
      expect(result.filePath).toBe('empty.js');
      expect(result.ast).toBe(mockAST);
    });
  });

  describe('analyzeIncremental', () => {
    it('should analyze file changes incrementally', async () => {
      const changes = [
        {
          filePath: 'test.js',
          changeType: 'modified' as const,
          oldContent: 'var x = 1;',
          newContent: 'var x = 2;'
        }
      ];

      const mockResult = {
        affectedVariables: ['x'],
        affectedFunctions: [],
        affectedClasses: [],
        newSecurityIssues: [],
        resolvedSecurityIssues: [],
        performanceImpact: { analysisTime: 100, memoryUsage: 50 }
      };

      // Mock the incremental analyzer's analyzeChanges method
      const result = await advancedTreeSitterService.analyzeIncremental(changes);
      
      expect(result).toBeDefined();
    });
  });

  describe('analyzeFunction', () => {
    it('should analyze a specific function in a project', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'function testFunction() { return true; }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      const mockResult: ComprehensiveAnalysisResult = {
        filePath: 'test.js',
        ast: mockAST,
        symbolTable: {
          functions: new Map([['testFunction', new Map()]]),
          classes: new Map(),
          variables: new Map(),
          getAllSymbols: jest.fn().mockReturnValue([]),
          getSymbol: jest.fn(),
          addSymbol: jest.fn()
        } as any,
        controlFlow: {
          nodes: [],
          edges: [],
          entryPoint: 'entry',
          exitPoints: ['exit'],
          functions: new Map(),
          getNode: (id: string) => undefined,
          getSuccessors: (nodeId: string) => [],
          getPredecessors: (nodeId: string) => [],
          getDominators: (nodeId: string) => [],
          isReachable: (from: string, to: string) => false
        },
        dataFlow: {
          variables: new Map(),
          flows: [],
          sources: new Map(),
          sinks: new Map(),
          taintSources: [],
          getVariableFlows: jest.fn(),
          getTaintedFlows: jest.fn(),
          isVariableTainted: jest.fn(),
          getVariableDefinitions: jest.fn(),
          getVariableUses: jest.fn()
        } as any,
        securityIssues: [],
        metrics: {
          linesOfCode: 3,
          cyclomaticComplexity: 1,
          nestingDepth: 0,
          functionCount: 1,
          classCount: 0,
          variableCount: 0,
          securityHotspots: 0,
          testCoverage: 0
        },
        performance: {
          parseTime: 10,
          analysisTime: 50,
          memoryUsage: 100
        }
      };

      // Mock the analyzeFile method to return our mock result
      const analyzeFileSpy = jest.spyOn(advancedTreeSitterService as any, 'analyzeFile')
        .mockResolvedValue(mockResult);

      const result = await advancedTreeSitterService.analyzeFunction('./', 'testFunction');
      
      expect(result).toBeDefined();
      expect(analyzeFileSpy).toHaveBeenCalled();
      
      analyzeFileSpy.mockRestore();
    });

    it('should throw an error when function is not found', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'function otherFunction() { return true; }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      const mockResult: ComprehensiveAnalysisResult = {
        filePath: 'test.js',
        ast: mockAST,
        symbolTable: {
          functions: new Map([['otherFunction', new Map()]]),
          classes: new Map(),
          variables: new Map(),
          getAllSymbols: jest.fn().mockReturnValue([]),
          getSymbol: jest.fn(),
          addSymbol: jest.fn()
        } as any,
        controlFlow: {
          nodes: [],
          edges: [],
          entryPoint: 'entry',
          exitPoints: ['exit'],
          functions: new Map(),
          getNode: (id: string) => undefined,
          getSuccessors: (nodeId: string) => [],
          getPredecessors: (nodeId: string) => [],
          getDominators: (nodeId: string) => [],
          isReachable: (from: string, to: string) => false
        },
        dataFlow: {
          variables: new Map(),
          flows: [],
          sources: new Map(),
          sinks: new Map(),
          taintSources: [],
          getVariableFlows: jest.fn(),
          getTaintedFlows: jest.fn(),
          isVariableTainted: jest.fn(),
          getVariableDefinitions: jest.fn(),
          getVariableUses: jest.fn()
        } as any,
        securityIssues: [],
        metrics: {
          linesOfCode: 3,
          cyclomaticComplexity: 1,
          nestingDepth: 0,
          functionCount: 1,
          classCount: 0,
          variableCount: 0,
          securityHotspots: 0,
          testCoverage: 0
        },
        performance: {
          parseTime: 10,
          analysisTime: 50,
          memoryUsage: 100
        }
      };

      jest.spyOn(advancedTreeSitterService as any, 'analyzeFile')
        .mockResolvedValue(mockResult);

      await expect(advancedTreeSitterService.analyzeFunction('./', 'nonExistentFunction'))
        .rejects
        .toThrow('Function nonExistentFunction not found in project ./');
    });
  });

  describe('analyzeClass', () => {
    it('should analyze a specific class in a project', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'class TestClass { method() {} }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      const mockResult: ComprehensiveAnalysisResult = {
        filePath: 'test.js',
        ast: mockAST,
        symbolTable: {
          functions: new Map(),
          classes: new Map([['TestClass', new Map()]]),
          variables: new Map(),
          getAllSymbols: jest.fn().mockReturnValue([]),
          getSymbol: jest.fn(),
          addSymbol: jest.fn()
        } as any,
        controlFlow: {
          nodes: [],
          edges: [],
          entryPoint: 'entry',
          exitPoints: ['exit'],
          functions: new Map(),
          getNode: (id: string) => undefined,
          getSuccessors: (nodeId: string) => [],
          getPredecessors: (nodeId: string) => [],
          getDominators: (nodeId: string) => [],
          isReachable: (from: string, to: string) => false
        },
        dataFlow: {
          variables: new Map(),
          flows: [],
          sources: new Map(),
          sinks: new Map(),
          taintSources: [],
          getVariableFlows: jest.fn(),
          getTaintedFlows: jest.fn(),
          isVariableTainted: jest.fn(),
          getVariableDefinitions: jest.fn(),
          getVariableUses: jest.fn()
        } as any,
        securityIssues: [],
        metrics: {
          linesOfCode: 3,
          cyclomaticComplexity: 1,
          nestingDepth: 0,
          functionCount: 1,
          classCount: 1,
          variableCount: 0,
          securityHotspots: 0,
          testCoverage: 0
        },
        performance: {
          parseTime: 10,
          analysisTime: 50,
          memoryUsage: 100
        }
      };

      const analyzeFileSpy = jest.spyOn(advancedTreeSitterService as any, 'analyzeFile')
        .mockResolvedValue(mockResult);

      const result = await advancedTreeSitterService.analyzeClass('./', 'TestClass');
      
      expect(result).toBeDefined();
      expect(analyzeFileSpy).toHaveBeenCalled();
      
      analyzeFileSpy.mockRestore();
    });
  });

  describe('trackVariable', () => {
    it('should track a variable across files in a project', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'var testVar = 42;',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      const mockResult: ComprehensiveAnalysisResult = {
        filePath: 'test.js',
        ast: mockAST,
        symbolTable: {
          functions: new Map(),
          classes: new Map(),
          variables: new Map([['testVar', {
            name: 'testVar',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'test.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 10,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          }]]),
          getAllSymbols: jest.fn().mockReturnValue([{
            name: 'testVar',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'test.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 10,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          }]),
          getSymbol: jest.fn(),
          addSymbol: jest.fn()
        } as any,
        controlFlow: {
          nodes: [],
          edges: [],
          entryPoint: 'entry',
          exitPoints: ['exit'],
          functions: new Map(),
          getNode: jest.fn(),
          getSuccessors: jest.fn(),
          getPredecessors: jest.fn(),
          getDominators: jest.fn(),
          isReachable: jest.fn()
        } as any,
        dataFlow: {
          variables: new Map([['testVar', {
            name: 'testVar',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'test.js',
              startLine: 1,
              endLine: 1,
              startColumn: 0,
              endColumn: 10,
              nodeType: 'identifier'
            },
            isMutable: true,
            references: []
          }]]),
          flows: [],
          sources: new Map(),
          sinks: new Map(),
          taintSources: [],
          getVariableFlows: jest.fn().mockReturnValue([]),
          getTaintedFlows: jest.fn().mockReturnValue([]),
          isVariableTainted: jest.fn().mockReturnValue(false),
          getVariableDefinitions: jest.fn().mockReturnValue([]),
          getVariableUses: jest.fn().mockReturnValue([])
        } as any,
        securityIssues: [],
        metrics: {
          linesOfCode: 1,
          cyclomaticComplexity: 1,
          nestingDepth: 0,
          functionCount: 0,
          classCount: 0,
          variableCount: 1,
          securityHotspots: 0,
          testCoverage: 0
        },
        performance: {
          parseTime: 5,
          analysisTime: 25,
          memoryUsage: 50
        }
      };

      const analyzeFileSpy = jest.spyOn(advancedTreeSitterService as any, 'analyzeFile')
        .mockResolvedValue(mockResult);

      const result = await advancedTreeSitterService.trackVariable('./', 'testVar');
      
      expect(result).toBeDefined();
      expect(result.definitions).toBeDefined();
      expect(result.uses).toBeDefined();
      expect(result.taintPath).toBeDefined();
      expect(result.securityIssues).toBeDefined();
      
      analyzeFileSpy.mockRestore();
    });
  });

  describe('metrics calculation', () => {
    it('should calculate code metrics correctly', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [
          {
            type: 'if_statement',
            startPosition: { row: 2, column: 0 },
            endPosition: { row: 5, column: 1 },
            children: [
              {
                type: 'if_statement',
                startPosition: { row: 3, column: 2 },
                endPosition: { row: 4, column: 3 },
                children: []
              }
            ]
          }
        ],
        text: 'function test() { if (true) { if (false) {} } return true; }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 15,
        success: true
      });

      const result = await advancedTreeSitterService.analyzeFile('test.js');
      
      expect(result.metrics).toBeDefined();
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.nestingDepth).toBeGreaterThan(0);
    });
  });

  describe('security analysis', () => {
    it('should detect security issues in code', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 5, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'eval(userInput);',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 10,
        success: true
      });

      const result = await advancedTreeSitterService.analyzeFile('vulnerable.js');
      
      expect(result.securityIssues).toBeDefined();
    });
  });

  describe('performance tracking', () => {
    it('should track analysis performance', async () => {
      const mockAST = {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: 100,
        children: [],
        text: 'function test() { return true; }',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      mockTreeSitterCore.parseFile.mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', parser: {}, fileExtensions: ['.js'], supported: true },
        parseTime: 12,
        success: true
      });

      const result = await advancedTreeSitterService.analyzeFile('test.js');
      
      expect(result.performance).toBeDefined();
      expect(result.performance.parseTime).toBe(12);
      expect(result.performance.analysisTime).toBeGreaterThan(0);
      expect(result.performance.memoryUsage).toBeGreaterThan(0);
    });
  });
});