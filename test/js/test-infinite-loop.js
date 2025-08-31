const { TreeSitterService } = require('../../src/services/parser/TreeSitterService');

// Create a simple test
const treeSitterService = new TreeSitterService();

// Simple test code with error handling
const code = `
function example() {
  try {
    riskyOperation();
  } catch (error) {
    console.error(error);
  } finally {
    cleanup();
  }
}
`;

console.log('Creating mock AST...');
// Create a mock AST similar to what the tests do
function createMockSyntaxNode(type, text, startPosition, endPosition, startIndex, endIndex, children = [], parent = null) {
  const node = {
    type,
    startPosition,
    endPosition,
    startIndex,
    endIndex,
    children,
    parent,
    childForFieldName: () => null
  };

  // Set parent relationship for children
  children.forEach(child => {
    child.parent = node;
  });

  return node;
}

function createMockAST(code) {
  const lines = code.split('\n');
  const nodes = [];

  // Create nodes based on code patterns
  lines.forEach((line, index) => {
    if (line.includes('try') || line.includes('catch')) {
      nodes.push(createMockSyntaxNode(
        line.includes('try') ? 'try_statement' : 'catch_clause',
        line,
        { row: index, column: 0 },
        { row: index, column: line.length },
        code.indexOf(line),
        code.indexOf(line) + line.length,
        []
      ));
    }
  });

  // Create root node with all the created nodes as children
  const rootNode = createMockSyntaxNode(
    'program',
    code,
    { row: 0, column: 0 },
    { row: lines.length - 1, column: lines[lines.length - 1].length },
    0,
    code.length,
    nodes,
    null
  );

  return rootNode;
}

const mockAST = createMockAST(code);
console.log('Mock AST created:', JSON.stringify(mockAST, null, 2));

console.log('Extracting snippets...');
const snippets = treeSitterService.extractSnippets(mockAST, code);
console.log('Snippets extracted:', snippets.length);