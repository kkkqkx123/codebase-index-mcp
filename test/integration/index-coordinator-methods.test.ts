import 'reflect-metadata';
import { Container } from 'inversify';
import { DIContainer, TYPES } from '../../src/core/DIContainer';
import { IndexService } from '../../src/services/indexing/IndexService';
import { IndexCoordinator } from '../../src/services/indexing/IndexCoordinator';
import { HashUtils } from '../../src/utils/HashUtils';

describe('Index Coordinator Methods', () => {
  let container: Container;
  let indexService: IndexService;
  let indexCoordinator: IndexCoordinator;

  beforeAll(() => {
    // Initialize DI container
    container = DIContainer.getInstance();
    
    // Get services
    indexService = container.get<IndexService>(TYPES.IndexService);
    indexCoordinator = container.get<IndexCoordinator>(TYPES.IndexCoordinator);
  });

  describe('Snippet Analysis Features', () => {
    // We'll use a mock project ID for these tests
    const mockProjectId = 'test-project-id';

    test('should have getSnippetProcessingStatus method', async () => {
      // This test just verifies the method exists and can be called
      // In a real test, we would need a real project ID and indexed data
      expect(typeof indexCoordinator.getSnippetProcessingStatus).toBe('function');
    });

    test('should have checkForDuplicates method', async () => {
      // This test just verifies the method exists and can be called
      expect(typeof indexCoordinator.checkForDuplicates).toBe('function');
    });

    test('should have detectCrossReferences method', async () => {
      // This test just verifies the method exists and can be called
      expect(typeof indexCoordinator.detectCrossReferences).toBe('function');
    });

    test('should have analyzeDependencies method', async () => {
      // This test just verifies the method exists and can be called
      expect(typeof indexCoordinator.analyzeDependencies).toBe('function');
    });

    test('should have detectOverlaps method', async () => {
      // This test just verifies the method exists and can be called
      expect(typeof indexCoordinator.detectOverlaps).toBe('function');
    });
  });
});