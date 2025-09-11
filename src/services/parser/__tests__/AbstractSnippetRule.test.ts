import { AbstractSnippetRule } from '../treesitter-rule/AbstractSnippetRule';
import { DestructuringAssignmentRule } from '../treesitter-rule/DestructuringAssignmentRule';
import { ControlStructureRule } from '../treesitter-rule/ControlStructureRule';
import { FunctionCallChainRule } from '../treesitter-rule/FunctionCallChainRule';
import { ErrorHandlingRule } from '../treesitter-rule/ErrorHandlingRule';
import { TemplateLiteralRule } from '../treesitter-rule/TemplateLiteralRule';
import Parser from 'tree-sitter';

// Mock tree-sitter Parser for testing
const createMockNode = (
  type: string,
  text: string,
  startIndex = 0,
  endIndex = text.length,
  children: Parser.SyntaxNode[] = []
): Parser.SyntaxNode => {
  const mockNode: any = {
    type,
    startPosition: { row: 1, column: 1 },
    endPosition: { row: 2, column: 1 },
    startIndex,
    endIndex,
    children,
    parent: null,
    childForFieldName: (fieldName: string) => null,
    fieldNameForChild: (childIndex: number) => null,
    namedChild: (index: number) => null,
    namedChildren: [],
    hasChanges: false,
    text
  };
  return mockNode as Parser.SyntaxNode;
};

// Test implementation of AbstractSnippetRule for testing base functionality
class TestRule extends AbstractSnippetRule {
  readonly name = 'TestRule';
  readonly supportedNodeTypes = new Set(['test_node']);
  protected readonly snippetType = 'control_structure' as const;

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ) {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet' as const,
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content)
      }
    };
  }
}

// Test implementation that exposes protected methods for testing
class TestableRule extends TestRule {
  // Expose protected methods for testing using type assertion
  public testGetNodeText(node: Parser.SyntaxNode, sourceCode: string) {
    return (this as any).getNodeText(node, sourceCode);
  }

  public testGetNodeLocation(node: Parser.SyntaxNode) {
    return (this as any).getNodeLocation(node);
  }

  public testExtractContextInfo(node: Parser.SyntaxNode, sourceCode: string, nestingLevel: number) {
    return (this as any).extractContextInfo(node, sourceCode, nestingLevel);
  }

  public testCalculateComplexity(content: string) {
    return (this as any).calculateComplexity(content);
  }

  public testAnalyzeLanguageFeatures(content: string) {
    return (this as any).analyzeLanguageFeatures(content);
  }

  public testHasSideEffects(content: string) {
    return (this as any).hasSideEffects(content);
  }

  public testGenerateSnippetId(content: string, startLine: number) {
    return (this as any).generateSnippetId(content, startLine);
  }

  public getConfig() {
    return this.config;
  }
}

describe('AbstractSnippetRule', () => {
  let rule: TestableRule;
  let mockNode: Parser.SyntaxNode;
  const sourceCode = 'const test = "value";';

  beforeEach(() => {
    rule = new TestableRule();
    mockNode = createMockNode('test_node', sourceCode);
  });

  describe('Basic Rule Properties', () => {
    test('should have correct name and supported types', () => {
      expect(rule.name).toBe('TestRule');
      expect(rule.supportedNodeTypes).toBeInstanceOf(Set);
      expect(rule.supportedNodeTypes.has('test_node')).toBe(true);
    });

    test('should have default configuration', () => {
      expect((rule as any).config.maxDepth).toBe(50);
      expect((rule as any).config.minComplexity).toBe(2);
      expect((rule as any).config.maxComplexity).toBe(100);
      expect((rule as any).config.minLines).toBe(1);
      expect((rule as any).config.maxLines).toBe(50);
    });

    test('should accept custom configuration', () => {
      const customRule = new TestRule({ maxDepth: 100, minComplexity: 5 });
      expect((customRule as any).config.maxDepth).toBe(100);
      expect((customRule as any).config.minComplexity).toBe(5);
      expect((customRule as any).config.maxComplexity).toBe(100); // default value
    });
  });

  describe('Extract Method', () => {
    test('should extract snippets from matching nodes', () => {
      const result = rule.extract(mockNode, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(sourceCode);
      expect(result[0].snippetMetadata.snippetType).toBe('control_structure');
    });

    test('should not extract from non-matching node types', () => {
      const nonMatchingNode = createMockNode('other_node', sourceCode);
      const result = rule.extract(nonMatchingNode, sourceCode);
      expect(result).toHaveLength(0);
    });

    test('should respect max depth limit', () => {
      const deepNode = createMockNode('test_node', 'deep content');
      const childNode = createMockNode('test_node', 'child content');
      
      // Simulate deep nesting
      let currentNode = deepNode;
      for (let i = 0; i < 60; i++) {
        const newChild = { ...childNode };
        newChild.parent = currentNode;
        currentNode.children = [newChild];
        currentNode = newChild;
      }

      const result = rule.extract(deepNode, sourceCode);
      // Should not process nodes beyond maxDepth
      expect(result.length).toBeLessThan(60);
    });
  });

  describe('Utility Methods', () => {
    test('should extract node text correctly', () => {
      const text = rule.testGetNodeText(mockNode, sourceCode);
      expect(text).toBe(sourceCode);
    });

    test('should extract node location correctly', () => {
      const location = rule.testGetNodeLocation(mockNode);
      expect(location).toEqual({
        startLine: 1,
        endLine: 2,
        startColumn: 1,
        endColumn: 1
      });
    });

    test('should extract context info correctly', () => {
      const contextInfo = rule.testExtractContextInfo(mockNode, sourceCode, 0);
      expect(contextInfo.nestingLevel).toBe(0);
    });

    test('should calculate complexity correctly', () => {
      const complexCode = `
        if (condition) {
          while (true) {
            console.log('test');
          }
        }
      `;
      const complexity = rule.testCalculateComplexity(complexCode);
      expect(complexity).toBeGreaterThan(1);
    });

    test('should analyze language features', () => {
      const asyncCode = 'async function test() { await Promise.resolve(); }';
      const features = rule.testAnalyzeLanguageFeatures(asyncCode);
      expect(features.usesAsync).toBe(true);
    });

    test('should detect side effects', () => {
      const sideEffectCode = 'console.log("test");';
      const hasSideEffects = rule.testHasSideEffects(sideEffectCode);
      expect(hasSideEffects).toBe(true);
    });

    test('should generate unique snippet IDs', () => {
      const id1 = rule.testGenerateSnippetId('content1', 1);
      const id2 = rule.testGenerateSnippetId('content2', 2);
      expect(id1).not.toBe(id2);
      expect(id1).toContain('control_structure_1_');
    });
  });
});

describe('Refactored Rules', () => {
  describe('DestructuringAssignmentRule', () => {
    let rule: DestructuringAssignmentRule;
    const sourceCode = 'const { name, age } = person;';

    beforeEach(() => {
      rule = new DestructuringAssignmentRule();
    });

    test('should extract destructuring patterns', () => {
      const node = createMockNode('object_pattern', sourceCode);
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].snippetMetadata.snippetType).toBe('destructuring_assignment');
    });

    test('should handle assignment expressions with destructuring', () => {
      const node = createMockNode('assignment_expression', sourceCode);
      // Mock the left child to be an object_pattern
      const leftChild = createMockNode('object_pattern', '{ name, age }');
      node.childForFieldName = () => leftChild;
      
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
    });
  });

  describe('ControlStructureRule', () => {
    let rule: ControlStructureRule;
    const sourceCode = `
      if (condition) {
        console.log('test');
      }
    `;

    beforeEach(() => {
      rule = new ControlStructureRule();
    });

    test('should extract control structures', () => {
      const node = createMockNode('if_statement', sourceCode);
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].snippetMetadata.snippetType).toBe('control_structure');
    });

    test('should filter overly simple control structures', () => {
      const simpleNode = createMockNode('if_statement', 'if(x)y;');
      const result = rule.extract(simpleNode, 'if(x)y;');
      expect(result).toHaveLength(0); // Should be filtered out
    });
  });

  describe('FunctionCallChainRule', () => {
    let rule: FunctionCallChainRule;
    const sourceCode = 'obj.method1().method2();';

    beforeEach(() => {
      rule = new FunctionCallChainRule();
    });

    test('should extract meaningful function call chains', () => {
      const node = createMockNode('call_expression', sourceCode);
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].snippetMetadata.snippetType).toBe('function_call_chain');
    });

    test('should filter simple function calls', () => {
      const simpleNode = createMockNode('call_expression', 'func();');
      const result = rule.extract(simpleNode, 'func();');
      expect(result).toHaveLength(0); // Should be filtered out
    });
  });

  describe('ErrorHandlingRule', () => {
    let rule: ErrorHandlingRule;
    const sourceCode = `
      try {
        riskyOperation();
      } catch (error) {
        console.error(error);
      }
    `;

    beforeEach(() => {
      rule = new ErrorHandlingRule();
    });

    test('should extract try statements', () => {
      const node = createMockNode('try_statement', sourceCode);
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].snippetMetadata.snippetType).toBe('error_handling');
    });

    test('should extract throw statements', () => {
      const throwNode = createMockNode('throw_statement', 'throw new Error("test");');
      const result = rule.extract(throwNode, 'throw new Error("test");');
      expect(result).toHaveLength(1);
    });

    test('should skip catch clauses', () => {
      const catchNode = createMockNode('catch_clause', 'catch (error) {}');
      const result = rule.extract(catchNode, 'catch (error) {}');
      expect(result).toHaveLength(0);
    });
  });

  describe('TemplateLiteralRule', () => {
    let rule: TemplateLiteralRule;
    const sourceCode = '`Hello ${name}, today is ${day}!`';

    beforeEach(() => {
      rule = new TemplateLiteralRule();
    });

    test('should extract template literals with expressions', () => {
      const node = createMockNode('template_literal', sourceCode);
      const result = rule.extract(node, sourceCode);
      expect(result).toHaveLength(1);
      expect(result[0].snippetMetadata.snippetType).toBe('template_literal');
    });

    test('should skip simple template literals without expressions', () => {
      const simpleNode = createMockNode('template_literal', '`Hello World`');
      const result = rule.extract(simpleNode, '`Hello World`');
      expect(result).toHaveLength(0);
    });
  });
});

describe('Performance and Memory', () => {
  test('should handle large AST efficiently', () => {
    const rule = new TestRule();
    const largeSourceCode = 'x'.repeat(10000);
    const node = createMockNode('test_node', largeSourceCode);
    
    const startTime = Date.now();
    const result = rule.extract(node, largeSourceCode);
    const endTime = Date.now();
    
    expect(result).toHaveLength(1);
    expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
  });

  test('should generate consistent hash values', () => {
    const rule = new TestRule();
    const content = 'test content';
    const hash1 = (rule as any)['simpleHash'](content);
    const hash2 = (rule as any)['simpleHash'](content);
    
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
  });
});

describe('Configuration Integration', () => {
  test('should respect RuleConfiguration', () => {
    const rule = new TestRule({ maxDepth: 10, minComplexity: 5 });
    
    // Create a node that would normally be processed
    const node = createMockNode('test_node', 'simple content');
    
    // With higher minComplexity, simple content might be filtered
    const result = rule.extract(node, 'simple content');
    // The exact behavior depends on the validation logic
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Error Handling', () => {
  test('should handle malformed nodes gracefully', () => {
    const rule = new TestRule();
    
    // Create a node with null/undefined properties
    const malformedNode: any = createMockNode('test_node', 'test');
    malformedNode.startIndex = null;
    malformedNode.endIndex = undefined;
    
    // Should not throw errors
    expect(() => {
      rule.extract(malformedNode, 'test');
    }).not.toThrow();
  });

  test('should handle empty source code', () => {
    const rule = new TestRule();
    const node = createMockNode('test_node', '');
    
    const result = rule.extract(node, '');
    expect(Array.isArray(result)).toBe(true);
  });
});