import { SmartCodeParser } from '../SmartCodeParser';
import { TreeSitterService } from '../TreeSitterService';
import { SnippetChunk } from '../types';
import { createTestContainer } from '@test/setup';
import { TYPES } from '../../../types';

describe('SmartCodeParser Snippet Integration', () => {
  let smartCodeParser: SmartCodeParser;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();
    
    // Create mock TreeSitterService
    const mockTreeSitterService = {
      parseFile: jest.fn().mockImplementation((filePath: string, content: string) => {
        // Check if this is the error test case
        if (filePath.includes('invalid-syntax') || content.includes('Missing closing brace')) {
          return Promise.resolve({
            ast: null,
            language: { name: 'JavaScript', supported: true },
            parseTime: 10,
            success: false,
            error: 'Syntax error: Missing closing brace'
          });
        }
        
        return Promise.resolve({
          ast: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: content.split('\n').length - 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: []
          },
          language: { name: 'JavaScript', supported: true },
          parseTime: 10,
          success: true
        });
      }),
      extractSnippets: jest.fn().mockImplementation((ast: any, content: string) => {
        // Return mock snippets based on content
        const snippets: SnippetChunk[] = [];
        
        if (content.includes('if')) {
          snippets.push({
            id: 'snippet_if_1',
            content: 'if (condition) {\n  console.log("true");\n}',
            startLine: 2,
            endLine: 4,
            startByte: 20,
            endByte: 60,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'control_structure',
              contextInfo: { nestingLevel: 0 },
              languageFeatures: {},
              complexity: 2,
              isStandalone: true,
              hasSideEffects: true
            }
          });
        }
        
        if (content.includes('try')) {
          snippets.push({
            id: 'snippet_try_1',
            content: 'try {\n  riskyOperation();\n} catch (error) {\n  console.error(error);\n}',
            startLine: 6,
            endLine: 10,
            startByte: 80,
            endByte: 150,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'error_handling',
              contextInfo: { nestingLevel: 0 },
              languageFeatures: {},
              complexity: 3,
              isStandalone: true,
              hasSideEffects: true
            }
          });
        }
        
        if (content.includes('@snippet')) {
          snippets.push({
            id: 'snippet_comment_1',
            content: 'function exampleFunction() {\n  console.log("This is a snippet");\n  return true;\n}',
            startLine: 12,
            endLine: 15,
            startByte: 170,
            endByte: 250,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'comment_marked',
              contextInfo: { nestingLevel: 0 },
              languageFeatures: {},
              complexity: 2,
              isStandalone: true,
              hasSideEffects: true,
              commentMarkers: ['// @snippet: Example snippet']
            }
          });
        }
        
        return snippets;
      }),
      extractFunctions: jest.fn().mockReturnValue([]),
      extractClasses: jest.fn().mockReturnValue([]),
      extractImports: jest.fn().mockReturnValue([]),
      extractExports: jest.fn().mockReturnValue([]),
      getSupportedLanguages: jest.fn().mockReturnValue([]),
      detectLanguage: jest.fn().mockReturnValue(null),
      async parseCode(code: string, language: string) {
        return this.parseFile('test.js', code);
      }
    };
    
    // Rebind TreeSitterService with mock
    container.unbind(TreeSitterService);
    container.bind(TreeSitterService).toConstantValue(mockTreeSitterService);
    
    smartCodeParser = container.get(SmartCodeParser);
  });

  describe('parseFile with snippet extraction', () => {
    test('should extract snippets when enabled', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
  
  try {
    riskyOperation();
  } catch (error) {
    console.error(error);
  }
}

// @snippet: Example snippet
function exampleFunction() {
  console.log("This is a snippet");
  return true;
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: true
      });
      
      // Snippets should have been extracted by the TreeSitterService
      
      // Check that snippets are included in the chunks
      const snippetChunks = parsedFile.chunks.filter(chunk => chunk.type === 'snippet') as SnippetChunk[];
      expect(snippetChunks.length).toBeGreaterThan(0);
      
      // Verify snippet count in metadata
      expect(parsedFile.metadata.snippets).toBe(snippetChunks.length);
      
      // Verify snippet types
      const controlSnippets = snippetChunks.filter(s => 
        s.snippetMetadata.snippetType === 'control_structure'
      );
      const errorSnippets = snippetChunks.filter(s => 
        s.snippetMetadata.snippetType === 'error_handling'
      );
      const commentSnippets = snippetChunks.filter(s => 
        s.snippetMetadata.snippetType === 'comment_marked'
      );
      
      expect(controlSnippets.length).toBeGreaterThan(0);
      expect(errorSnippets.length).toBeGreaterThan(0);
      expect(commentSnippets.length).toBeGreaterThan(0);
    });

    test('should not extract snippets when disabled', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: false
      });
      
      // Snippet extraction should not have been performed
      
      // Check that no snippets are included in the chunks
      const snippetChunks = parsedFile.chunks.filter(chunk => chunk.type === 'snippet');
      expect(snippetChunks.length).toBe(0);
      
      // Verify snippet count in metadata
      expect(parsedFile.metadata.snippets).toBe(0);
    });

    test('should use default snippet extraction option when not specified', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content);
      
      // Should use default option (extractSnippets: true)
      // Check that snippets were extracted
      const snippetChunks = parsedFile.chunks.filter(chunk => chunk.type === 'snippet');
      expect(snippetChunks.length).toBeGreaterThan(0);
    });

    test('should handle TreeSitterService errors gracefully', async () => {
      const filePath = '/test/invalid-syntax.js';
      const content = `
function example() {
  if (condition) {
    console.log("true")
  // Missing closing brace - invalid syntax
`;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: true
      });
      
      // Should fall back to generic chunking
      // Should still have chunks (generic ones)
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      
      // Should have no snippets due to parse error
      expect(parsedFile.metadata.snippets).toBe(0);
    });

    test('should include snippet metadata in parsed file', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
  
  try {
    riskyOperation();
  } catch (error) {
    console.error(error);
  }
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: true
      });
      
      // Verify that snippets have proper metadata
      const snippetChunks = parsedFile.chunks.filter(chunk => chunk.type === 'snippet') as SnippetChunk[];
      
      snippetChunks.forEach(snippet => {
        expect(snippet.snippetMetadata).toBeDefined();
        expect(snippet.snippetMetadata.snippetType).toBeDefined();
        expect(snippet.snippetMetadata.contextInfo).toBeDefined();
        expect(snippet.snippetMetadata.languageFeatures).toBeDefined();
        expect(snippet.snippetMetadata.complexity).toBeGreaterThan(0);
        expect(typeof snippet.snippetMetadata.isStandalone).toBe('boolean');
        expect(typeof snippet.snippetMetadata.hasSideEffects).toBe('boolean');
      });
    });

    test('should detect language correctly', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: true
      });
      
      // Language should be detected from TreeSitterService
      expect(parsedFile.language).toBe('javascript');
    });

    test('should generate unique IDs for snippets', async () => {
      const filePath = '/test/example.js';
      const content = `
function example() {
  if (condition) {
    console.log("true");
  }
  
  if (anotherCondition) {
    console.log("also true");
  }
}
      `;
      
      const parsedFile = await smartCodeParser.parseFile(filePath, content, {
        extractSnippets: true
      });
      
      const snippetChunks = parsedFile.chunks.filter(chunk => chunk.type === 'snippet');
      
      // All snippet IDs should be unique
      const snippetIds = snippetChunks.map(chunk => chunk.id);
      const uniqueSnippetIds = new Set(snippetIds);
      
      expect(uniqueSnippetIds.size).toBe(snippetIds.length);
    });
  });
});