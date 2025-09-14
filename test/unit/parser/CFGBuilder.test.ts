import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { CFGBuilder, ControlFlowGraphImpl, CFGNodeType, CFGEdgeType } from '../../../src/services/parser/CFGBuilder';
import Parser from 'tree-sitter';

describe('CFGBuilder', () => {
  let cfgBuilder: CFGBuilder;
  let mockAST: Parser.SyntaxNode;

  beforeEach(() => {
    cfgBuilder = new CFGBuilder();
    
    // Create mock AST for testing
    mockAST = {
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
  });

  describe('build', () => {
    it('should create a control flow graph from AST', () => {
      const result = cfgBuilder.build(mockAST, 'test.ts');
      
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.entryPoint).toBe('entry');
      expect(result.exitPoints).toContain('exit');
    });

    it('should handle empty AST', () => {
      const emptyAST = {
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

      const result = cfgBuilder.build(emptyAST, 'empty.ts');
      
      expect(result).toBeDefined();
      expect(result.nodes.length).toBeGreaterThanOrEqual(2); // entry and exit nodes
    });

    it('should create entry and exit nodes', () => {
      const result = cfgBuilder.build(mockAST, 'test.ts');
      
      const entryNode = result.nodes.find(node => node.id === 'entry');
      const exitNode = result.nodes.find(node => node.id === 'exit');
      
      expect(entryNode).toBeDefined();
      expect(exitNode).toBeDefined();
      expect(entryNode?.isEntry).toBe(true);
      expect(exitNode?.isExit).toBe(true);
    });
  });

  describe('ControlFlowGraphImpl', () => {
    let cfg: ControlFlowGraphImpl;

    beforeEach(() => {
      cfg = new ControlFlowGraphImpl();
    });

    describe('node operations', () => {
      it('should add and retrieve nodes', () => {
        const node = {
          id: 'test_node',
          type: CFGNodeType.STATEMENT,
          statements: [],
          startLine: 1,
          endLine: 2,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        cfg.addNode(node);
        const retrieved = cfg.getNode('test_node');
        
        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe('test_node');
      });

      it('should return undefined for non-existent nodes', () => {
        const result = cfg.getNode('non_existent');
        expect(result).toBeUndefined();
      });
    });

    describe('edge operations', () => {
      it('should add and traverse edges', () => {
        const node1 = {
          id: 'node1',
          type: CFGNodeType.STATEMENT,
          statements: [],
          startLine: 1,
          endLine: 1,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        const node2 = {
          id: 'node2',
          type: CFGNodeType.STATEMENT,
          statements: [],
          startLine: 2,
          endLine: 2,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        const edge = {
          from: 'node1',
          to: 'node2',
          type: CFGEdgeType.NORMAL
        };

        cfg.addNode(node1);
        cfg.addNode(node2);
        cfg.addEdge(edge);

        const successors = cfg.getSuccessors('node1');
        expect(successors).toHaveLength(1);
        expect(successors[0].id).toBe('node2');

        const predecessors = cfg.getPredecessors('node2');
        expect(predecessors).toHaveLength(1);
        expect(predecessors[0].id).toBe('node1');
      });
    });

    describe('graph traversal', () => {
      beforeEach(() => {
        // Create a simple graph: entry -> node1 -> node2 -> exit
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

        const node1 = {
          id: 'node1',
          type: CFGNodeType.STATEMENT,
          statements: [],
          startLine: 1,
          endLine: 1,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        const node2 = {
          id: 'node2',
          type: CFGNodeType.STATEMENT,
          statements: [],
          startLine: 2,
          endLine: 2,
          scope: 'global',
          isEntry: false,
          isExit: false,
          conditions: []
        };

        const exitNode = {
          id: 'exit',
          type: CFGNodeType.EXIT,
          statements: [],
          startLine: 3,
          endLine: 3,
          scope: 'global',
          isEntry: false,
          isExit: true,
          conditions: []
        };

        cfg.addNode(entryNode);
        cfg.addNode(node1);
        cfg.addNode(node2);
        cfg.addNode(exitNode);

        cfg.addEdge({ from: 'entry', to: 'node1', type: CFGEdgeType.NORMAL });
        cfg.addEdge({ from: 'node1', to: 'node2', type: CFGEdgeType.NORMAL });
        cfg.addEdge({ from: 'node2', to: 'exit', type: CFGEdgeType.NORMAL });
      });

      it('should determine reachability', () => {
        expect(cfg.isReachable('entry', 'node1')).toBe(true);
        expect(cfg.isReachable('entry', 'node2')).toBe(true);
        expect(cfg.isReachable('entry', 'exit')).toBe(true);
        expect(cfg.isReachable('node1', 'exit')).toBe(true);
        expect(cfg.isReachable('node2', 'node1')).toBe(false);
      });

      it('should get dominators', () => {
        const dominators = cfg.getDominators('node2');
        expect(dominators).toBeDefined();
        // Entry node should be a dominator
        expect(dominators.some(node => node.id === 'entry')).toBe(true);
      });
    });

    describe('function management', () => {
      it('should add and retrieve functions', () => {
        const mockCFG = new ControlFlowGraphImpl();
        cfg.addFunction('testFunction', mockCFG);
        
        const retrieved = cfg.functions.get('testFunction');
        expect(retrieved).toBe(mockCFG);
      });
    });
  });

  describe('processNode', () => {
    it('should process different statement types', () => {
      const mockNode = {
        type: 'if_statement',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 3, column: 1 },
        startIndex: 0,
        endIndex: 30,
        children: [],
        text: 'if (true) { console.log("test"); }',
        childForFieldName: jest.fn().mockImplementation((fieldName) => {
          if (fieldName === 'condition') {
            return {
              type: 'parenthesized_expression',
              text: '(true)',
              startPosition: { row: 1, column: 3 },
              endPosition: { row: 1, column: 9 }
            };
          }
          return null;
        }),
        walk: jest.fn()
      } as any;

      // Test that the CFG builder can process different node types
      expect(() => {
        cfgBuilder.build(mockNode, 'test.ts');
      }).not.toThrow();
    });

    it('should handle function declarations', () => {
      const mockFunctionNode = {
        type: 'function_declaration',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 5, column: 1 },
        startIndex: 0,
        endIndex: 50,
        children: [],
        text: 'function test() { return true; }',
        childForFieldName: jest.fn().mockImplementation((fieldName) => {
          if (fieldName === 'name') {
            return { type: 'identifier', text: 'test' };
          }
          if (fieldName === 'body') {
            return {
              type: 'statement_block',
              startPosition: { row: 0, column: 17 },
              endPosition: { row: 2, column: 1 },
              children: []
            };
          }
          return null;
        }),
        walk: jest.fn()
      } as any;

      const result = cfgBuilder.build(mockFunctionNode, 'test.ts');
      expect(result.nodes.some(node => node.type === CFGNodeType.FUNCTION_CALL)).toBe(true);
    });

    it('should handle return statements', () => {
      const mockReturnNode = {
        type: 'return_statement',
        startPosition: { row: 1, column: 2 },
        endPosition: { row: 1, column: 15 },
        startIndex: 10,
        endIndex: 25,
        children: [],
        text: 'return true;',
        childForFieldName: jest.fn(),
        walk: jest.fn()
      } as any;

      const result = cfgBuilder.build(mockReturnNode, 'test.ts');
      expect(result.nodes.some(node => node.type === CFGNodeType.RETURN)).toBe(true);
    });
  });
});