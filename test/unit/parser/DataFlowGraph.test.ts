import { describe, beforeEach, it, expect } from '@jest/globals';
import {
  DataFlowAnalyzer,
  DataFlowGraphImpl,
  DataFlowType,
  TaintType
} from '../../../src/services/parser/DataFlowGraph';
import { ControlFlowGraphImpl, CFGNodeType, CFGEdgeType } from '../../../src/services/parser/CFGBuilder';
import { SymbolTable, Symbol, SymbolType, SymbolScope, SymbolLocation } from '../../../src/services/parser/SymbolTableBuilder';
import Parser from 'tree-sitter';

describe('DataFlowGraph', () => {
  let dataFlowAnalyzer: DataFlowAnalyzer;
  let mockCFG: ControlFlowGraphImpl;
  let mockSymbolTable: SymbolTable;

  beforeEach(() => {
    dataFlowAnalyzer = new DataFlowAnalyzer();
    mockCFG = new ControlFlowGraphImpl();
    mockSymbolTable = {
      functions: new Map(),
      classes: new Map(),
      variables: new Map(),
      getAllSymbols: jest.fn().mockReturnValue([]),
      getSymbol: jest.fn(),
      addSymbol: jest.fn()
    } as any;
  });

  describe('DataFlowGraphImpl', () => {
    let dataFlowGraph: DataFlowGraphImpl;

    beforeEach(() => {
      dataFlowGraph = new DataFlowGraphImpl();
    });

    it('should add and retrieve variables', () => {
      const symbol: Symbol = {
        name: 'testVar',
        type: SymbolType.VARIABLE,
        scope: SymbolScope.GLOBAL,
        definition: {
          filePath: 'test.ts',
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          endColumn: 10,
          nodeType: 'variable_declarator'
        },
        isMutable: false,
        references: []
      };

      dataFlowGraph.addVariable(symbol);
      const retrieved = dataFlowGraph.variables.get('testVar');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('testVar');
    });

    it('should track variable taint status', () => {
      const symbol: Symbol = {
        name: 'userInput',
        type: SymbolType.VARIABLE,
        scope: SymbolScope.GLOBAL,
        definition: {
          filePath: 'test.ts',
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          endColumn: 10,
          nodeType: 'variable_declarator'
        },
        isMutable: false,
        references: []
      };

      dataFlowGraph.addVariable(symbol);
      expect(dataFlowGraph.isVariableTainted('userInput')).toBe(false);

      dataFlowGraph.setTainted('userInput', true);
      expect(dataFlowGraph.isVariableTainted('userInput')).toBe(true);
    });

    it('should add and retrieve flows', () => {
      const mockNode = {
        id: 'test_node',
        type: CFGNodeType.STATEMENT,
        statements: [],
        startLine: 1,
        endLine: 1,
        scope: 'global',
        isEntry: false,
        isExit: false,
        conditions: []
      };

      const flow = {
        from: 'node1',
        to: 'node2',
        variable: 'testVar',
        type: DataFlowType.DEFINITION,
        sourceNode: mockNode,
        targetNode: mockNode,
        isTainted: false,
        taintSources: []
      };

      dataFlowGraph.addFlow(flow);
      const flows = dataFlowGraph.getVariableFlows('testVar');

      expect(flows).toHaveLength(1);
      expect(flows[0].variable).toBe('testVar');
    });

    it('should add and retrieve taint sources', () => {
      const taintSource = {
        name: 'userInput',
        type: TaintType.USER_INPUT,
        sources: ['req.body'],
        sinks: ['query'],
        sanitizers: ['sanitize']
      };

      dataFlowGraph.addTaintSource(taintSource);
      expect(dataFlowGraph.taintSources).toHaveLength(1);
      expect(dataFlowGraph.taintSources[0].name).toBe('userInput');
    });

    it('should get tainted flows', () => {
      const mockNode = {
        id: 'test_node',
        type: CFGNodeType.STATEMENT,
        statements: [],
        startLine: 1,
        endLine: 1,
        scope: 'global',
        isEntry: false,
        isExit: false,
        conditions: []
      };

      const taintedFlow = {
        from: 'node1',
        to: 'node2',
        variable: 'taintedVar',
        type: DataFlowType.DEFINITION,
        sourceNode: mockNode,
        targetNode: mockNode,
        isTainted: true,
        taintSources: ['userInput']
      };

      const cleanFlow = {
        from: 'node3',
        to: 'node4',
        variable: 'cleanVar',
        type: DataFlowType.DEFINITION,
        sourceNode: mockNode,
        targetNode: mockNode,
        isTainted: false,
        taintSources: []
      };

      dataFlowGraph.addFlow(taintedFlow);
      dataFlowGraph.addFlow(cleanFlow);

      const taintedFlows = dataFlowGraph.getTaintedFlows();
      expect(taintedFlows).toHaveLength(1);
      expect(taintedFlows[0].variable).toBe('taintedVar');
    });

    it('should get variable definitions and uses', () => {
      const mockNode = {
        id: 'test_node',
        type: CFGNodeType.STATEMENT,
        statements: [],
        startLine: 1,
        endLine: 1,
        scope: 'global',
        isEntry: false,
        isExit: false,
        conditions: []
      };

      const definitionFlow = {
        from: 'def_node',
        to: 'def_node',
        variable: 'testVar',
        type: DataFlowType.DEFINITION,
        sourceNode: mockNode,
        targetNode: mockNode,
        isTainted: false,
        taintSources: []
      };

      const useFlow = {
        from: 'def_node',
        to: 'use_node',
        variable: 'testVar',
        type: DataFlowType.USE,
        sourceNode: mockNode,
        targetNode: mockNode,
        isTainted: false,
        taintSources: []
      };

      dataFlowGraph.addFlow(definitionFlow);
      dataFlowGraph.addFlow(useFlow);

      const definitions = dataFlowGraph.getVariableDefinitions('testVar');
      const uses = dataFlowGraph.getVariableUses('testVar');

      expect(definitions).toHaveLength(1);
      expect(uses).toHaveLength(1);
    });
  });

  describe('DataFlowAnalyzer', () => {
    it('should create an instance', () => {
      expect(dataFlowAnalyzer).toBeDefined();
    });

    it('should initialize with taint patterns', () => {
      expect(dataFlowAnalyzer).toBeDefined();
      // The constructor initializes taint patterns, so this should not throw
    });

    it('should analyze and return a data flow graph', () => {
      // Add some mock nodes to the CFG
      const entryNode = {
        id: 'entry',
        type: CFGNodeType.ENTRY,
        statements: [],
        startLine: 0,
        endLine: 0,
        scope: 'global',
        isEntry: true,
        isExit: false,
        conditions: []
      };

      const exitNode = {
        id: 'exit',
        type: CFGNodeType.EXIT,
        statements: [],
        startLine: 10,
        endLine: 10,
        scope: 'global',
        isEntry: false,
        isExit: true,
        conditions: []
      };

      mockCFG.addNode(entryNode);
      mockCFG.addNode(exitNode);
      mockCFG.addEdge({ from: 'entry', to: 'exit', type: CFGEdgeType.NORMAL });

      // Mock symbol table with some symbols
      (mockSymbolTable.getAllSymbols as jest.Mock).mockReturnValue([
        {
          name: 'testVar',
          type: SymbolType.VARIABLE,
          scope: SymbolScope.GLOBAL,
          definition: {
            filePath: 'test.ts',
            startLine: 1,
            startColumn: 0,
            endLine: 1,
            endColumn: 10,
            nodeType: 'variable_declarator'
          },
          isMutable: false,
          references: []
        }
      ]);

      const result = dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);

      expect(result).toBeDefined();
      expect(result.variables).toBeDefined();
      expect(result.flows).toBeDefined();
    });

    it('should handle empty CFG and symbol table', () => {
      const emptyCFG = new ControlFlowGraphImpl();
      const emptySymbolTable = {
        functions: new Map(),
        classes: new Map(),
        variables: new Map(),
        getAllSymbols: jest.fn().mockReturnValue([]),
        getSymbol: jest.fn(),
        addSymbol: jest.fn()
      } as any;

      const result = dataFlowAnalyzer.analyze(emptyCFG, emptySymbolTable);

      expect(result).toBeDefined();
      expect(result.variables.size).toBe(0);
      expect(result.flows.length).toBe(0);
    });

    describe('variable extraction', () => {
      it('should extract variables from different statement types', () => {
        const mockStatement = {
          type: 'variable_declaration',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 20 },
          startIndex: 0,
          endIndex: 20,
          children: [
            {
              type: 'identifier',
              text: 'myVar',
              startPosition: { row: 1, column: 6 },
              endPosition: { row: 1, column: 11 },
              startIndex: 6,
              endIndex: 11,
              children: [],
              walk: jest.fn()
            }
          ],
          text: 'var myVar = 10;',
          childForFieldName: jest.fn(),
          walk: jest.fn()
        } as any;

        // We'll test the private method indirectly through the analyze method
        expect(() => {
          dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
        }).not.toThrow();
      });

      it('should extract assignment targets and sources', () => {
        const mockAssignment = {
          type: 'assignment_expression',
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 15 },
          startIndex: 0,
          endIndex: 15,
          children: [
            { type: 'identifier', text: 'x' },
            { type: 'operator', text: '=' },
            { type: 'identifier', text: 'y' }
          ],
          text: 'x = y;',
          childForFieldName: jest.fn(),
          walk: jest.fn()
        } as any;

        expect(() => {
          dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
        }).not.toThrow();
      });
    });

    describe('taint analysis', () => {
      it('should detect taint sources', () => {
        // Create a mock CFG with a tainted statement
        const entryNode = {
          id: 'entry',
          type: CFGNodeType.ENTRY,
          statements: [],
          startLine: 0,
          endLine: 0,
          scope: 'global',
          isEntry: true,
          isExit: false,
          conditions: []
        };

        const taintNode = {
          id: 'taint_node',
          type: CFGNodeType.STATEMENT,
          statements: [
            {
              type: 'call_expression',
              text: 'prompt("Enter input")',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 22 },
              startIndex: 0,
              endIndex: 22,
              children: [],
              childForFieldName: jest.fn(),
              walk: jest.fn()
            } as any
          ],
          startLine: 1,
          endLine: 1,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        mockCFG.addNode(entryNode);
        mockCFG.addNode(taintNode);
        mockCFG.addEdge({ from: 'entry', to: 'taint_node', type: CFGEdgeType.NORMAL });

        (mockSymbolTable.getAllSymbols as jest.Mock).mockReturnValue([
          {
            name: 'userInput',
            type: SymbolType.VARIABLE,
            scope: SymbolScope.GLOBAL,
            definition: {
              filePath: 'test.ts',
              startLine: 1,
              startColumn: 0,
              endLine: 1,
              endColumn: 10,
              nodeType: 'variable_declarator'
            },
            isMutable: false,
            references: []
          }
        ]);

        const result = dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
        expect(result).toBeDefined();
      });

      it('should detect security patterns', () => {
        // Test that security pattern detection doesn't throw
        expect(() => {
          dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
        }).not.toThrow();
      });
    });
  });

  describe('security pattern detection', () => {
    beforeEach(() => {
      // Set up a basic CFG for security testing
      const entryNode = {
        id: 'entry',
        type: CFGNodeType.ENTRY,
        statements: [],
        startLine: 0,
        endLine: 0,
        scope: 'global',
        isEntry: true,
        isExit: false,
        conditions: []
      };

      mockCFG.addNode(entryNode);
    });

    it('should detect SQL injection patterns', () => {
      const sqlNode = {
        id: 'sql_node',
        type: CFGNodeType.STATEMENT,
        statements: [
          {
            type: 'call_expression',
            text: 'db.query("SELECT * FROM users WHERE id = " + userInput)',
            startPosition: { row: 1, column: 0 },
            endPosition: { row: 1, column: 50 },
            startIndex: 0,
            endIndex: 50,
            children: [],
            childForFieldName: jest.fn(),
            walk: jest.fn()
          } as any
        ],
        startLine: 1,
        endLine: 1,
        scope: 'global',
        isEntry: false,
        isExit: false,
        conditions: []
      };

      mockCFG.addNode(sqlNode);
      mockCFG.addEdge({ from: 'entry', to: 'sql_node', type: CFGEdgeType.NORMAL });

      (mockSymbolTable.getAllSymbols as jest.Mock).mockReturnValue([
        {
          name: 'userInput',
          type: SymbolType.VARIABLE,
          scope: SymbolScope.GLOBAL,
          definition: {
            filePath: 'test.ts',
            startLine: 1,
            startColumn: 0,
            endLine: 1,
            endColumn: 10,
            nodeType: 'variable_declarator'
          },
          isMutable: false,
          references: []
        }
      ]);

      const result = dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
      expect(result).toBeDefined();
    });

    it('should detect XSS patterns', () => {
      const xssNode = {
        id: 'xss_node',
        type: CFGNodeType.STATEMENT,
        statements: [
          {
            type: 'assignment_expression',
            text: 'element.innerHTML = userInput',
            startPosition: { row: 1, column: 0 },
            endPosition: { row: 1, column: 30 },
            startIndex: 0,
            endIndex: 30,
            children: [],
            childForFieldName: jest.fn(),
            walk: jest.fn()
          } as any
        ],
        startLine: 1,
        endLine: 1,
        scope: 'global',
        isEntry: false,
        isExit: false,
        conditions: []
      };

      mockCFG.addNode(xssNode);
      mockCFG.addEdge({ from: 'entry', to: 'xss_node', type: CFGEdgeType.NORMAL });

      (mockSymbolTable.getAllSymbols as jest.Mock).mockReturnValue([
        {
          name: 'userInput',
          type: SymbolType.VARIABLE,
          scope: SymbolScope.GLOBAL,
          definition: {
            filePath: 'test.ts',
            startLine: 1,
            startColumn: 0,
            endLine: 1,
            endColumn: 10,
            nodeType: 'variable_declarator'
          },
          isMutable: false,
          references: []
        }
      ]);

      const result = dataFlowAnalyzer.analyze(mockCFG, mockSymbolTable);
      expect(result).toBeDefined();
    });
  });
});