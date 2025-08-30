import { SmartCodeParser } from '../SmartCodeParser';
import { TreeSitterService } from '../TreeSitterService';
import { performance } from 'perf_hooks';

// Mock TreeSitterService for performance testing
jest.mock('../TreeSitterService', () => {
  return {
    TreeSitterService: jest.fn().mockImplementation(() => {
      return {
        parseFile: jest.fn().mockImplementation((filePath: string, content: string) => {
          // Simulate parsing time based on content size
          const parseTime = Math.max(1, content.length / 10000);
          
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
            parseTime,
            success: true
          });
        }),
        extractSnippets: jest.fn().mockImplementation((ast: any, content: string) => {
          // Simulate snippet extraction time based on content size
          const extractionTime = Math.max(1, content.length / 20000);
          
          // Return mock snippets based on content size
          const snippetCount = Math.min(100, Math.floor(content.length / 500));
          const snippets = [];
          
          for (let i = 0; i < snippetCount; i++) {
            snippets.push({
              id: `snippet_${i}`,
              content: `// Snippet ${i}\nfunction snippet${i}() {\n  console.log("snippet ${i}");\n}`,
              startLine: i * 5 + 1,
              endLine: i * 5 + 4,
              startByte: i * 100,
              endByte: i * 100 + 80,
              type: 'snippet',
              imports: [],
              exports: [],
              metadata: {},
              snippetMetadata: {
                snippetType: i % 3 === 0 ? 'control_structure' : 
                             i % 3 === 1 ? 'error_handling' : 'comment_marked',
                contextInfo: { nestingLevel: i % 3 },
                languageFeatures: {},
                complexity: (i % 5) + 1,
                isStandalone: true,
                hasSideEffects: i % 2 === 0
              }
            });
          }
          
          return snippets;
        }),
        extractFunctions: jest.fn().mockReturnValue([]),
        extractClasses: jest.fn().mockReturnValue([]),
        extractImports: jest.fn().mockReturnValue([]),
        extractExports: jest.fn().mockReturnValue([]),
        getNodeText: jest.fn().mockImplementation((node: any, content: string) => {
          return content.substring(node.startIndex, node.endIndex);
        }),
        getNodeLocation: jest.fn().mockImplementation((node: any) => {
          return {
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            startColumn: node.startPosition.column + 1,
            endColumn: node.endPosition.column + 1
          };
        }),
        findNodeByType: jest.fn().mockReturnValue([]),
        isInitialized: jest.fn().mockReturnValue(true)
      };
    })
  };
});

// Helper function to generate test code with specified size
function generateTestCode(lines: number): string {
  let code = '';
  
  for (let i = 0; i < lines; i++) {
    if (i % 20 === 0) {
      // Add a function definition
      code += `function testFunction${i}() {\n`;
      code += `  if (condition${i}) {\n`;
      code += `    console.log("condition${i} is true");\n`;
      code += `  }\n`;
      code += `  return true;\n`;
      code += `}\n\n`;
    } else if (i % 20 === 10) {
      // Add a comment marker for snippet extraction
      code += `// @snippet: Example snippet ${i}\n`;
      code += `function snippetFunction${i}() {\n`;
      code += `  console.log("This is a snippet ${i}");\n`;
      code += `  return true;\n`;
      code += `}\n\n`;
    } else {
      // Add a regular line of code
      code += `const variable${i} = "value${i}";\n`;
    }
  }
  
  return code;
}

describe('SmartCodeParser Snippet Extraction Performance', () => {
  let smartCodeParser: SmartCodeParser;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;

  beforeEach(() => {
    // Create a mock TreeSitterService
    mockTreeSitterService = new TreeSitterService() as jest.Mocked<TreeSitterService>;
    
    // Create SmartCodeParser with the mocked service
    smartCodeParser = new SmartCodeParser(mockTreeSitterService);
  });

  describe('Performance benchmarks', () => {
    test('should handle small files efficiently', async () => {
      const filePath = '/test/small.js';
      const code = generateTestCode(100); // 100 lines
      
      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      console.log(`Small file (100 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`);
      
      // Should process small files in under 100ms
      expect(processingTime).toBeLessThan(100);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.metadata.snippets).toBeGreaterThan(0);
    });

    test('should handle medium files efficiently', async () => {
      const filePath = '/test/medium.js';
      const code = generateTestCode(1000); // 1000 lines
      
      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      console.log(`Medium file (1000 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`);
      
      // Should process medium files in under 500ms
      expect(processingTime).toBeLessThan(500);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.metadata.snippets).toBeGreaterThan(0);
    });

    test('should handle large files efficiently', async () => {
      const filePath = '/test/large.js';
      const code = generateTestCode(5000); // 5000 lines
      
      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      console.log(`Large file (5000 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`);
      
      // Should process large files in under 2000ms
      expect(processingTime).toBeLessThan(2000);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.metadata.snippets).toBeGreaterThan(0);
    });

    test('should handle very large files efficiently', async () => {
      const filePath = '/test/very-large.js';
      const code = generateTestCode(10000); // 10000 lines
      
      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      console.log(`Very large file (10000 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`);
      
      // Should process very large files in under 5000ms
      expect(processingTime).toBeLessThan(5000);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.metadata.snippets).toBeGreaterThan(0);
    });

    test('should maintain linear time complexity', async () => {
      const sizes = [100, 500, 1000, 2000, 5000];
      const times: number[] = [];
      
      for (const size of sizes) {
        const filePath = `/test/size-${size}.js`;
        const code = generateTestCode(size);
        
        const startTime = performance.now();
        await smartCodeParser.parseFile(filePath, code, {
          extractSnippets: true
        });
        const endTime = performance.now();
        
        times.push(endTime - startTime);
      }
      
      // Calculate the ratio between consecutive measurements
      const ratios = [];
      for (let i = 1; i < times.length; i++) {
        const sizeRatio = sizes[i] / sizes[i - 1];
        const timeRatio = times[i] / times[i - 1];
        ratios.push(timeRatio / sizeRatio);
      }
      
      // The average ratio should be close to 1 for linear time complexity
      const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
      
      console.log('Time complexity ratios:', ratios);
      console.log('Average ratio:', averageRatio);
      
      // Allow some deviation, but should be reasonably close to linear
      expect(averageRatio).toBeLessThan(1.5);
      expect(averageRatio).toBeGreaterThan(0.5);
    });

    test('should not excessively increase memory usage', async () => {
      // This is a simplified memory usage test
      // In a real environment, you would use more sophisticated memory profiling tools
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process a large file
      const filePath = '/test/memory-test.js';
      const code = generateTestCode(10000);
      
      await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should perform better with snippet extraction disabled', async () => {
      const filePath = '/test/performance-test.js';
      const code = generateTestCode(5000);
      
      // Test with snippet extraction enabled
      const startTimeWithSnippets = performance.now();
      await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTimeWithSnippets = performance.now();
      const timeWithSnippets = endTimeWithSnippets - startTimeWithSnippets;
      
      // Test with snippet extraction disabled
      const startTimeWithoutSnippets = performance.now();
      await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: false
      });
      const endTimeWithoutSnippets = performance.now();
      const timeWithoutSnippets = endTimeWithoutSnippets - startTimeWithoutSnippets;
      
      console.log(`With snippets: ${timeWithSnippets.toFixed(2)}ms`);
      console.log(`Without snippets: ${timeWithoutSnippets.toFixed(2)}ms`);
      
      // Processing without snippets should be faster
      expect(timeWithoutSnippets).toBeLessThan(timeWithSnippets);
    });

    test('should handle multiple files efficiently', async () => {
      const fileCount = 10;
      const code = generateTestCode(500); // 500 lines per file
      
      const startTime = performance.now();
      
      const promises = [];
      for (let i = 0; i < fileCount; i++) {
        promises.push(
          smartCodeParser.parseFile(`/test/file-${i}.js`, code, {
            extractSnippets: true
          })
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      const averageTimePerFile = processingTime / fileCount;
      
      console.log(`Multiple files (${fileCount} files): ${processingTime.toFixed(2)}ms total, ${averageTimePerFile.toFixed(2)}ms per file`);
      
      // Should process all files efficiently
      expect(processingTime).toBeLessThan(2000);
      
      // All files should have been processed successfully
      results.forEach(result => {
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.metadata.snippets).toBeGreaterThan(0);
      });
    });

    test('should handle files with many snippets efficiently', async () => {
      // Create a file with many comment markers to generate many snippets
      let code = '';
      for (let i = 0; i < 100; i++) {
        code += `// @snippet: Marker ${i}\n`;
        code += `function snippet${i}() {\n`;
        code += `  console.log("snippet ${i}");\n`;
        code += `  return ${i};\n`;
        code += `}\n\n`;
      }
      
      const filePath = '/test/many-snippets.js';
      
      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true
      });
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      console.log(`Many snippets test: ${processingTime.toFixed(2)}ms, ${parsedFile.metadata.snippets} snippets`);
      
      // Should extract all snippets efficiently
      expect(parsedFile.metadata.snippets).toBe(100);
      expect(processingTime).toBeLessThan(500);
    });
  });
});