import { AsyncPatternRule } from './src/services/parser/treesitter-rule/modern-features/AsyncPatternRule';
import Parser from 'tree-sitter';

// Create a more realistic mock node structure
const createMockNode = (
  type: string,
  text: string,
  startIndex = 0,
  endIndex = text.length,
  children: Parser.SyntaxNode[] = []
): Parser.SyntaxNode => {
  const mockNode: any = {
    type,
    text,
    startPosition: { row: 1, column: 0 },
    endPosition: { row: text.split('\n').length, column: text.split('\n').pop()?.length || 0 },
    startIndex,
    endIndex,
    children,
    parent: null,
    namedChildren: children,
    childForFieldName: (fieldName: string) => null,
    fieldNameForChild: (childIndex: number) => null,
    namedChild: (index: number) => children[index] || null,
    firstChild: children[0] || null,
    lastChild: children[children.length - 1] || null,
    nextSibling: null,
    previousSibling: null,
    hasChanges: false,
    hasError: () => false,
    isMissing: () => false,
    toString: () => text,
    walk: () => ({ current: mockNode }),
  };

  children.forEach(child => {
    if (child) child.parent = mockNode;
  });

  return mockNode as Parser.SyntaxNode;
};

// Helper to create a mock AST root that contains the test node
const createMockAST = (node: Parser.SyntaxNode): Parser.SyntaxNode => {
  const rootNode: any = {
    type: 'program',
    text: node.text,
    startPosition: { row: 0, column: 0 },
    endPosition: node.endPosition,
    startIndex: 0,
    endIndex: node.endIndex,
    children: [node],
    parent: null,
    namedChildren: [node],
    childForFieldName: (fieldName: string) => null,
    fieldNameForChild: (childIndex: number) => null,
    namedChild: (index: number) => index === 0 ? node : null,
    firstChild: node,
    lastChild: node,
    nextSibling: null,
    previousSibling: null,
    hasChanges: false,
    hasError: () => false,
    isMissing: () => false,
    toString: () => node.text,
    walk: () => ({ current: rootNode }),
  };
  
  node.parent = rootNode;
  return rootNode as Parser.SyntaxNode;
};

// Debug the async pattern test
const rule = new AsyncPatternRule();
const sourceCode = `
  async function fetchUserData(userId: string): Promise<User> {
    const response = await fetch(\`/api/users/\${userId}\`);
    const userData = await response.json();
    return userData;
  }
`;

console.log('Source code:', sourceCode);
console.log('Lines:', sourceCode.split('\n').filter(line => line.trim().length > 0));
console.log('Await count:', (sourceCode.match(/\bawait\s+/g) || []).length);

const node = createMockNode('function_definition', sourceCode);
const ast = createMockAST(node);

console.log('Node type:', node.type);
console.log('Supported node types:', Array.from(rule.supportedNodeTypes));
console.log('Should support node type:', rule.supportedNodeTypes.has(node.type));

// Test the individual methods
const content = sourceCode;
console.log('Contains async pattern:', (rule as any).containsAsyncPattern(content));
console.log('Has sufficient complexity:', (rule as any).hasSufficientComplexity(content));

const result = rule.extract(ast, sourceCode);
console.log('Extract result:', result);
console.log('Result length:', result.length);