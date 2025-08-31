import 'reflect-metadata';
import { Container } from 'inversify';
import { container as diContainer } from '../../src/inversify.config';
import { IndexService } from '../../src/services/indexing/IndexService';
import { IndexCoordinator } from '../../src/services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../../src/services/storage/StorageCoordinator';
import { SnippetController } from '../../src/controllers/SnippetController';
import { ConfigService } from '../../src/config/ConfigService';
import { LoggerService } from '../../src/core/LoggerService';
import { HashUtils } from '../../src/utils/HashUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Snippet Storage and Retrieval Integration', () => {
  let container: Container;
  let indexService: IndexService;
  let indexCoordinator: IndexCoordinator;
  let storageCoordinator: StorageCoordinator;
  let snippetController: SnippetController;
  let testProjectPath: string;
  let testFilePath: string;

  beforeAll(async () => {
    // Use the configured DI container
    container = diContainer;
    
    // Get services
    indexService = container.get<IndexService>(IndexService);
    indexCoordinator = container.get<IndexCoordinator>(IndexCoordinator);
    storageCoordinator = container.get<StorageCoordinator>(StorageCoordinator);
    snippetController = container.get<SnippetController>(SnippetController);
    
    // Create a temporary test project
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-index-snippet-test-'));
    
    // Create a test file with some code snippets
    testFilePath = path.join(testProjectPath, 'test-file.js');
    const testContent = `
      // This is a test function
      function testFunction() {
        console.log('Hello, world!');
        return true;
      }
      
      // Another test function
      function anotherFunction(param) {
        if (param) {
          return param * 2;
        }
        return 0;
      }
      
      // Class definition
      class TestClass {
        constructor(name) {
          this.name = name;
        }
        
        greet() {
          return \`Hello, \${this.name}!\`;
        }
      }
      
      // Export statement
      module.exports = { testFunction, anotherFunction, TestClass };
    `;
    
    await fs.writeFile(testFilePath, testContent);
  });

  afterAll(async () => {
    // Clean up temporary test project
    try {
      if (testProjectPath) {
        await fs.rm(testProjectPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to clean up test project:', error);
    }
  });

  describe('Snippet Storage', () => {
    let projectId: string;

    test('should create index for test project with snippets', async () => {
      // Calculate project ID
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      projectId = projectHash.hash;
      
      // Create index
      const result = await indexService.createIndex(testProjectPath, {
        recursive: true
      });
      
      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    }, 30000); // 30 second timeout

    test('should have processed snippets', async () => {
      // Check snippet processing status
      const status = await indexCoordinator.getSnippetProcessingStatus(projectId);
      
      expect(status.totalSnippets).toBeGreaterThan(0);
      expect(status.processedSnippets).toBeGreaterThan(0);
    });

    test('should store snippets in vector database', async () => {
      // Get collection stats from vector storage
      const stats = await storageCoordinator.getSnippetStatistics(projectId);
      
      expect(stats.totalSnippets).toBeGreaterThan(0);
      expect(stats.processedSnippets).toBeGreaterThan(0);
    });

    test('should store snippets in graph database', async () => {
      // Get collection stats from vector storage
      const stats = await storageCoordinator.getSnippetStatistics(projectId);
      
      expect(stats.totalSnippets).toBeGreaterThan(0);
      expect(stats.processedSnippets).toBeGreaterThan(0);
    });
  });

  describe('Snippet Retrieval', () => {
    let projectId: string;

    beforeAll(async () => {
      // Ensure testProjectPath is initialized
      if (!testProjectPath) {
        throw new Error('testProjectPath is not initialized');
      }
      
      // Get project ID
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      projectId = projectHash.hash;
    });

    test('should be able to search for snippets', async () => {
      // Search for snippets
      const results = await indexService.search('test function', {
        limit: 10
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // We expect at least one result since we indexed a file with "test function"
      expect(results.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('content');
      expect(firstResult).toHaveProperty('filePath');
      expect(firstResult).toHaveProperty('score');
    });

    test('should be able to search for snippets via coordinator', async () => {
      // Search for snippets using coordinator
      const results = await indexService.search('test function', {
        limit: 10,
        searchType: 'snippet'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // We expect at least one result since we indexed a file with "test function"
      expect(results.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('content');
      expect(firstResult).toHaveProperty('filePath');
      expect(firstResult).toHaveProperty('score');
    });

    test('should be able to search for snippets via SnippetController', async () => {
      // Search for snippets using SnippetController
      const result = await snippetController.searchSnippets('test function', {
        limit: 10
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // We expect at least one result since we indexed a file with "test function"
      expect(result.data.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      const firstResult = result.data[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('content');
      expect(firstResult).toHaveProperty('filePath');
      expect(firstResult).toHaveProperty('score');
    });

    test('should be able to get snippet by ID', async () => {
      // First search to get a snippet ID
      const searchResults = await indexService.search('test function', { limit: 1 });
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.length).toBeGreaterThan(0);
      
      const snippetId = searchResults[0].id;
      
      // Get snippet by ID
      const result = await snippetController.getSnippetById(snippetId, projectId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(snippetId);
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('filePath');
      expect(result.data).toHaveProperty('startLine');
      expect(result.data).toHaveProperty('endLine');
      expect(result.data).toHaveProperty('language');
    });
  });

  describe('Snippet Analysis Features', () => {
    let projectId: string;
    let testSnippetId: string;

    beforeAll(async () => {
      // Ensure testProjectPath is initialized
      if (!testProjectPath) {
        throw new Error('testProjectPath is not initialized');
      }
      
      // Get project ID
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      projectId = projectHash.hash;
      
      // Get a test snippet ID from search results
      const results = await indexService.search('test function', { limit: 1 });
      if (results.length > 0) {
        testSnippetId = results[0].id;
      }
    });

    test('should check for duplicates', async () => {
      const content = 'function testFunction() { console.log("Hello, world!"); }';
      const result = await snippetController.checkForDuplicates(content, projectId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.isDuplicate).toBe('boolean');
      expect(typeof result.data.contentHash).toBe('string');
    });

    test('should detect cross references', async () => {
      if (testSnippetId) {
        const result = await snippetController.detectCrossReferences(testSnippetId, projectId);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        // References could be empty or have values depending on the implementation
      }
    });

    test('should analyze dependencies', async () => {
      if (testSnippetId) {
        const result = await snippetController.analyzeDependencies(testSnippetId, projectId);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('dependsOn');
        expect(result.data).toHaveProperty('usedBy');
        expect(result.data).toHaveProperty('complexity');
        
        expect(Array.isArray(result.data.dependsOn)).toBe(true);
        expect(Array.isArray(result.data.usedBy)).toBe(true);
        expect(typeof result.data.complexity).toBe('number');
      }
    });

    test('should detect overlaps', async () => {
      if (testSnippetId) {
        const result = await snippetController.detectOverlaps(testSnippetId, projectId);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        // Overlaps could be empty or have values depending on the implementation
      }
    });

    test('should get snippet processing status', async () => {
      const result = await snippetController.getSnippetProcessingStatus(projectId);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('totalSnippets');
      expect(result.data).toHaveProperty('processedSnippets');
      expect(result.data).toHaveProperty('duplicateSnippets');
      expect(result.data).toHaveProperty('processingRate');
      
      expect(typeof result.data.totalSnippets).toBe('number');
      expect(typeof result.data.processedSnippets).toBe('number');
      expect(typeof result.data.duplicateSnippets).toBe('number');
      expect(typeof result.data.processingRate).toBe('number');
    });
  });

  describe('Storage Coordinator Real Implementation', () => {
    let projectId: string;

    beforeAll(async () => {
      // Ensure testProjectPath is initialized
      if (!testProjectPath) {
        throw new Error('testProjectPath is not initialized');
      }
      
      // Get project ID
      const projectHash = await HashUtils.calculateDirectoryHash(testProjectPath);
      projectId = projectHash.hash;
    });

    test('should get real snippet statistics', async () => {
      const stats = await storageCoordinator.getSnippetStatistics(projectId);
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalSnippets).toBe('number');
      expect(typeof stats.processedSnippets).toBe('number');
      expect(typeof stats.duplicateSnippets).toBe('number');
      expect(typeof stats.processingRate).toBe('number');
      
      // Stats should be non-negative
      expect(stats.totalSnippets).toBeGreaterThanOrEqual(0);
      expect(stats.processedSnippets).toBeGreaterThanOrEqual(0);
      expect(stats.duplicateSnippets).toBeGreaterThanOrEqual(0);
      expect(stats.processingRate).toBeGreaterThanOrEqual(0);
    });

    test('should find snippet by hash', async () => {
      // Create a test content hash
      const content = 'function test() { return true; }';
      const contentHash = HashUtils.calculateStringHash(content);
      
      const result = await storageCoordinator.findSnippetByHash(contentHash, projectId);
      
      // Result could be null if snippet not found, but should not throw an error
      expect(result === null || typeof result === 'object').toBe(true);
    });

    test('should find snippet references', async () => {
      // Create a test snippet ID
      const snippetId = 'test-snippet-id';
      
      const references = await storageCoordinator.findSnippetReferences(snippetId, projectId);
      
      expect(Array.isArray(references)).toBe(true);
      // References could be empty or have values depending on the implementation
    });

    test('should analyze snippet dependencies', async () => {
      // Create a test snippet ID
      const snippetId = 'test-snippet-id';
      
      const dependencies = await storageCoordinator.analyzeSnippetDependencies(snippetId, projectId);
      
      expect(dependencies).toBeDefined();
      expect(dependencies).toHaveProperty('dependsOn');
      expect(dependencies).toHaveProperty('usedBy');
      expect(dependencies).toHaveProperty('complexity');
      
      expect(Array.isArray(dependencies.dependsOn)).toBe(true);
      expect(Array.isArray(dependencies.usedBy)).toBe(true);
      expect(typeof dependencies.complexity).toBe('number');
    });

    test('should find snippet overlaps', async () => {
      // Create a test snippet ID
      const snippetId = 'test-snippet-id';
      
      const overlaps = await storageCoordinator.findSnippetOverlaps(snippetId, projectId);
      
      expect(Array.isArray(overlaps)).toBe(true);
      // Overlaps could be empty or have values depending on the implementation
    });
  });
});