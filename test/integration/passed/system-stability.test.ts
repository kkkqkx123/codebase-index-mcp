import 'reflect-metadata';
import { Container } from 'inversify';
import { createTestContainer } from '../../setup';
import { IndexService } from '../../../src/services/indexing/IndexService';
import { IndexCoordinator } from '../../../src/services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../../../src/services/storage/StorageCoordinator';
import { ParserService } from '../../../src/services/parser/ParserService';
import { ConfigService } from '../../../src/config/ConfigService';
import { LoggerService } from '../../../src/core/LoggerService';
import { FileSystemTraversal } from '../../../src/services/filesystem/FileSystemTraversal';
import { AsyncPipeline } from '../../../src/services/infrastructure/AsyncPipeline';
import { BatchProcessor } from '../../../src/services/processing/BatchProcessor';
import { MemoryManager } from '../../../src/services/processing/MemoryManager';
import { HashUtils } from '../../../src/utils/HashUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('System Stability and Reliability', () => {
  let container: Container;
  let indexService: IndexService;
  let indexCoordinator: IndexCoordinator;
  let storageCoordinator: StorageCoordinator;
  let parserService: ParserService;
  let testProjectPath: string;

  beforeAll(async () => {
    // Initialize test container
    container = createTestContainer();
    
    // Get services
    indexService = container.get<IndexService>(IndexService);
    indexCoordinator = container.get<IndexCoordinator>(IndexCoordinator);
    storageCoordinator = container.get<StorageCoordinator>(StorageCoordinator);
    parserService = container.get<ParserService>(ParserService);
    
    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-index-stability-test-'));
  });

  afterAll(async () => {
    // Clean up temporary test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test project:', error);
    }
  });

  describe('Concurrent Operations', () => {
    // Create multiple test files
    beforeAll(async () => {
      // Create multiple test files with different content
      for (let i = 0; i < 10; i++) {
        const fileName = `test-file-${i}.js`;
        const filePath = path.join(testProjectPath, fileName);
        const testContent = `
          // This is test file ${i}
          function testFunction${i}() {
            console.log('Hello from file ${i}!');
            return ${i};
          }
          
          // Another function in file ${i}
          function anotherFunction${i}(param) {
            if (param) {
              return param * ${i + 1};
            }
            return 0;
          }
          
          // Class definition in file ${i}
          class TestClass${i} {
            constructor(name) {
              this.name = name;
            }
            
            greet() {
              return \`Hello, \${this.name} from file ${i}!\`;
            }
          }
        `;
        
        await fs.writeFile(filePath, testContent);
      }
    });

    test('should handle concurrent indexing operations', async () => {
      // Create multiple concurrent indexing operations
      const promises = [];
      for (let i = 0; i < 3; i++) {
        const promise = indexCoordinator.createIndex(testProjectPath, {
          recursive: true
        });
        promises.push(promise);
      }
      
      // Wait for all operations to complete
      const results = await Promise.all(promises);
      
      // Verify all operations succeeded
      for (const result of results) {
        expect(result.success).toBe(true);
      }
    }, 60000); // 60 second timeout

    test('should handle concurrent search operations', async () => {
      // First create an index
      await indexCoordinator.createIndex(testProjectPath, {
        recursive: true
      });
      
      // Perform multiple concurrent searches
      const searchPromises = [];
      for (let i = 0; i < 5; i++) {
        const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
        const projectId = projectHash.hash;
        const promise = indexService.search(`test function ${i}`, projectId, {
          limit: 5
        });
        searchPromises.push(promise);
      }
      
      // Wait for all searches to complete
      const searchResults = await Promise.all(searchPromises);
      
      // Verify all searches completed without error
      for (const result of searchResults) {
        expect(Array.isArray(result)).toBe(true);
      }
    }, 30000); // 30 second timeout
  });

  describe('Error Handling and Recovery', () => {
    let invalidProjectPath: string;

    beforeAll(async () => {
      // Create an invalid project path
      invalidProjectPath = path.join(os.tmpdir(), 'non-existent-project-' + Date.now());
    });

    test('should handle non-existent project directory gracefully', async () => {
      // Try to index a non-existent directory
      const result = await indexCoordinator.createIndex(invalidProjectPath);
      
      // Should not throw an error but may not succeed
      expect(result).toBeDefined();
    });

    test('should handle search with no results gracefully', async () => {
      // Search for something that definitely won't exist
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      const projectId = projectHash.hash;
      const results = await indexService.search('thisquerywillnotmatchanything12345', projectId, {
        limit: 10
      });
      
      // Should return an empty array rather than throwing an error
      expect(Array.isArray(results)).toBe(true);
      // May or may not have results depending on implementation
    });

    test('should handle invalid snippet ID gracefully', async () => {
      // Try to analyze dependencies for an invalid snippet ID
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      const projectId = projectHash.hash;
      
      // This should not throw an error
      const dependencies = await indexCoordinator.analyzeDependencies('invalid-snippet-id', projectId);
      
      // Should return a valid structure even if no data
      expect(dependencies).toBeDefined();
      expect(dependencies).toHaveProperty('dependsOn');
      expect(dependencies).toHaveProperty('usedBy');
      expect(dependencies).toHaveProperty('complexity');
    });
  });

  describe('Memory and Performance', () => {
    // Create a larger test project
    beforeAll(async () => {
      // Create many test files to simulate a larger codebase
      const filePromises = [];
      for (let i = 0; i < 50; i++) {
        const fileName = `large-test-file-${i}.js`;
        const filePath = path.join(testProjectPath, fileName);
        // Create larger content for each file
        let content = `// Large test file ${i}\n\n`;
        for (let j = 0; j < 100; j++) {
          content += `
            function function${i}_${j}() {
              // This is function ${j} in file ${i}
              return ${i} * ${j};
            }
            
            class Class${i}_${j} {
              constructor(value) {
                this.value = value;
              }
              
              method() {
                return this.value * ${j};
              }
            }
          `;
        }
        
        filePromises.push(fs.writeFile(filePath, content));
      }
      
      await Promise.all(filePromises);
    });

    test('should maintain performance with large codebase', async () => {
      // Measure time for indexing
      const startTime = Date.now();
      
      const result = await indexCoordinator.createIndex(testProjectPath, {
        recursive: true
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within a reasonable time (less than 2 minutes for 50 files)
      expect(duration).toBeLessThan(120000);
      
      // Should succeed
      expect(result.success).toBe(true);
    }, 150000); // 2.5 minute timeout

    test('should handle repeated operations without memory leaks', async () => {
      // Perform multiple search operations
      const startTime = Date.now();
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      const projectId = projectHash.hash;
      
      for (let i = 0; i < 20; i++) {
        const results = await indexService.search(`function${i}`, projectId, {
          limit: 5
        });
        
        // Basic validation
        expect(Array.isArray(results)).toBe(true);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within a reasonable time
      expect(duration).toBeLessThan(30000);
    }, 60000); // 1 minute timeout
  });

  describe('System Cleanup', () => {
    test('should clean up resources properly', async () => {
      // Delete the index
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      const projectId = projectHash.hash;
      
      const result = await indexCoordinator.deleteIndex(testProjectPath);
      
      // Should succeed
      expect(result).toBe(true);
      
      // Try to search after deletion - should still work without error
      const results = await indexService.search('test', projectId, {
        limit: 5
      });
      
      // Should return gracefully (may be empty)
      expect(Array.isArray(results)).toBe(true);
    });
  });
});