import { Container } from 'inversify';
import { IndexCoordinator } from './IndexCoordinator';
import { VectorStorageService } from '../storage/VectorStorageService';
import { GraphPersistenceService } from '../storage/GraphPersistenceService';
import { SmartCodeParser } from '../parser/SmartCodeParser';
import { BaseEmbedder } from '../../embedders/BaseEmbedder';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { FileSystemTraversal } from '../filesystem/FileSystemTraversal';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('IndexCoordinator', () => {
  let container: Container;
  let indexCoordinator: IndexCoordinator;
  let mockVectorStorageService: jest.Mocked<VectorStorageService>;
  let mockGraphPersistenceService: jest.Mocked<GraphPersistenceService>;
  let mockSmartCodeParser: jest.Mocked<SmartCodeParser>;
  let mockEmbedder: jest.Mocked<BaseEmbedder>;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockFileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();

    // Create mocks
    mockVectorStorageService = {
      storeVector: jest.fn(),
      storeBatch: jest.fn(),
      updateVector: jest.fn(),
      deleteVector: jest.fn(),
      getStorageStats: jest.fn(),
    } as any;

    mockGraphPersistenceService = {
      storeCodeEntity: jest.fn(),
      storeRelationship: jest.fn(),
      storeBatch: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn(),
    } as any;

    mockSmartCodeParser = {
      parseFile: jest.fn(),
      extractFunctions: jest.fn(),
      extractClasses: jest.fn(),
      extractImports: jest.fn(),
      analyzeCodeStructure: jest.fn(),
    } as any;

    mockEmbedder = {
      embed: jest.fn(),
      embedBatch: jest.fn(),
      getDimensions: jest.fn().mockReturnValue(384),
      getModelName: jest.fn().mockReturnValue('test-model'),
    } as any;

    mockEmbedderFactory = {
      createEmbedder: jest.fn().mockReturnValue(mockEmbedder),
      getAvailableEmbedders: jest.fn(),
    } as any;

    mockFileSystemTraversal = {
      traverseDirectory: jest.fn(),
      getFileList: jest.fn(),
      watchDirectory: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getIndexingConfig: jest.fn().mockReturnValue({
        batchSize: 100,
        maxConcurrency: 5,
        supportedExtensions: ['.ts', '.js', '.py'],
        excludePatterns: ['node_modules', '.git'],
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.VectorStorageService).toConstantValue(mockVectorStorageService);
    container.bind(TYPES.GraphPersistenceService).toConstantValue(mockGraphPersistenceService);
    container.bind(TYPES.SmartCodeParser).toConstantValue(mockSmartCodeParser);
    container.bind(TYPES.EmbedderFactory).toConstantValue(mockEmbedderFactory);
    container.bind(TYPES.FileSystemTraversal).toConstantValue(mockFileSystemTraversal);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.IndexCoordinator).to(IndexCoordinator);

    indexCoordinator = container.get<IndexCoordinator>(TYPES.IndexCoordinator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('indexDirectory', () => {
    it('should index all files in a directory', async () => {
      const directoryPath = '/src/project';
      const files = [
        '/src/project/auth.ts',
        '/src/project/user.ts',
        '/src/project/utils.js',
      ];

      const parsedFile = {
        filePath: '/src/project/auth.ts',
        functions: [
          {
            name: 'authenticate',
            signature: 'authenticate(user: string, password: string): Promise<boolean>',
            startLine: 10,
            endLine: 25,
            content: 'function authenticate(user, password) { return bcrypt.compare(password, user.hash); }',
          }
        ],
        classes: [],
        imports: ['bcrypt'],
        exports: ['authenticate'],
      };

      const embedding = [0.1, 0.2, 0.3, 0.4];

      mockFileSystemTraversal.getFileList.mockResolvedValue(files);
      mockSmartCodeParser.parseFile.mockResolvedValue(parsedFile);
      mockEmbedder.embed.mockResolvedValue(embedding);
      mockVectorStorageService.storeVector.mockResolvedValue(undefined);
      mockGraphPersistenceService.storeCodeEntity.mockResolvedValue(undefined);

      const result = await indexCoordinator.indexDirectory(directoryPath);

      expect(result.totalFiles).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(mockFileSystemTraversal.getFileList).toHaveBeenCalledWith(directoryPath);
      expect(mockSmartCodeParser.parseFile).toHaveBeenCalledTimes(3);
      expect(mockVectorStorageService.storeVector).toHaveBeenCalled();
      expect(mockGraphPersistenceService.storeCodeEntity).toHaveBeenCalled();
    });

    it('should handle parsing errors gracefully', async () => {
      const directoryPath = '/src/project';
      const files = ['/src/project/broken.ts', '/src/project/good.ts'];

      mockFileSystemTraversal.getFileList.mockResolvedValue(files);
      mockSmartCodeParser.parseFile
        .mockRejectedValueOnce(new Error('Parse error'))
        .mockResolvedValueOnce({
          filePath: '/src/project/good.ts',
          functions: [],
          classes: [],
          imports: [],
          exports: [],
        });

      const result = await indexCoordinator.indexDirectory(directoryPath);

      expect(result.totalFiles).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to index file', expect.any(Object));
    });

    it('should filter files by supported extensions', async () => {
      const directoryPath = '/src/project';
      const files = [
        '/src/project/code.ts',
        '/src/project/readme.md',
        '/src/project/config.json',
        '/src/project/script.js',
      ];

      mockFileSystemTraversal.getFileList.mockResolvedValue(files);
      mockSmartCodeParser.parseFile.mockResolvedValue({
        filePath: '',
        functions: [],
        classes: [],
        imports: [],
        exports: [],
      });

      await indexCoordinator.indexDirectory(directoryPath);

      expect(mockSmartCodeParser.parseFile).toHaveBeenCalledTimes(2); // Only .ts and .js files
    });
  });

  describe('indexFile', () => {
    it('should index a single file completely', async () => {
      const filePath = '/src/auth.ts';
      const parsedFile = {
        filePath,
        functions: [
          {
            name: 'login',
            signature: 'login(credentials: LoginCredentials): Promise<User>',
            startLine: 5,
            endLine: 20,
            content: 'async function login(credentials) { const user = await authenticate(credentials); return user; }',
          }
        ],
        classes: [
          {
            name: 'AuthService',
            startLine: 25,
            endLine: 100,
            methods: ['login', 'logout', 'refresh'],
            properties: ['users', 'tokens'],
          }
        ],
        imports: ['User', 'LoginCredentials'],
        exports: ['AuthService', 'login'],
      };

      const functionEmbedding = [0.1, 0.2, 0.3, 0.4];
      const classEmbedding = [0.5, 0.6, 0.7, 0.8];

      mockSmartCodeParser.parseFile.mockResolvedValue(parsedFile);
      mockEmbedder.embed
        .mockResolvedValueOnce(functionEmbedding)
        .mockResolvedValueOnce(classEmbedding);

      const result = await indexCoordinator.indexFile(filePath);

      expect(result.success).toBe(true);
      expect(result.entitiesIndexed).toBe(2); // 1 function + 1 class
      expect(mockVectorStorageService.storeVector).toHaveBeenCalledTimes(2);
      expect(mockGraphPersistenceService.storeCodeEntity).toHaveBeenCalledTimes(2);
    });

    it('should handle unsupported file types', async () => {
      const filePath = '/src/readme.md';

      const result = await indexCoordinator.indexFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
      expect(mockSmartCodeParser.parseFile).not.toHaveBeenCalled();
    });
  });

  describe('updateIndex', () => {
    it('should update index for modified files', async () => {
      const filePath = '/src/auth.ts';
      const updatedContent = {
        filePath,
        functions: [
          {
            name: 'authenticate',
            signature: 'authenticate(user: string, password: string, options?: AuthOptions): Promise<boolean>',
            startLine: 10,
            endLine: 30,
            content: 'function authenticate(user, password, options = {}) { return bcrypt.compare(password, user.hash); }',
          }
        ],
        classes: [],
        imports: ['bcrypt', 'AuthOptions'],
        exports: ['authenticate'],
      };

      const newEmbedding = [0.9, 0.8, 0.7, 0.6];

      mockSmartCodeParser.parseFile.mockResolvedValue(updatedContent);
      mockEmbedder.embed.mockResolvedValue(newEmbedding);

      const result = await indexCoordinator.updateIndex(filePath);

      expect(result.success).toBe(true);
      expect(result.entitiesUpdated).toBe(1);
      expect(mockVectorStorageService.updateVector).toHaveBeenCalled();
      expect(mockGraphPersistenceService.updateEntity).toHaveBeenCalled();
    });
  });

  describe('deleteFromIndex', () => {
    it('should remove file from index', async () => {
      const filePath = '/src/deleted.ts';

      const result = await indexCoordinator.deleteFromIndex(filePath);

      expect(result.success).toBe(true);
      expect(mockVectorStorageService.deleteVector).toHaveBeenCalled();
      expect(mockGraphPersistenceService.deleteEntity).toHaveBeenCalled();
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild entire index from scratch', async () => {
      const directoryPath = '/src/project';
      const files = ['/src/project/file1.ts', '/src/project/file2.ts'];

      mockFileSystemTraversal.getFileList.mockResolvedValue(files);
      mockSmartCodeParser.parseFile.mockResolvedValue({
        filePath: '',
        functions: [],
        classes: [],
        imports: [],
        exports: [],
      });

      const result = await indexCoordinator.rebuildIndex(directoryPath);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Starting index rebuild', { directory: directoryPath });
    });
  });

  describe('getIndexingStats', () => {
    it('should return indexing statistics', async () => {
      const stats = await indexCoordinator.getIndexingStats();

      expect(stats.totalFilesIndexed).toBeDefined();
      expect(stats.totalEntitiesIndexed).toBeDefined();
      expect(stats.indexingErrors).toBeDefined();
      expect(stats.lastIndexingTime).toBeDefined();
      expect(stats.averageIndexingTime).toBeDefined();
    });
  });

  describe('validateIndex', () => {
    it('should validate index consistency', async () => {
      mockVectorStorageService.getStorageStats.mockResolvedValue({
        totalVectors: 100,
        indexedVectors: 100,
        vectorDimensions: 384,
        distanceMetric: 'Cosine',
        segmentCount: 2,
        status: 'green',
      });

      const validation = await indexCoordinator.validateIndex();

      expect(validation.isValid).toBe(true);
      expect(validation.vectorCount).toBe(100);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect index inconsistencies', async () => {
      mockVectorStorageService.getStorageStats.mockResolvedValue({
        totalVectors: 100,
        indexedVectors: 95, // Missing 5 vectors
        vectorDimensions: 384,
        distanceMetric: 'Cosine',
        segmentCount: 2,
        status: 'yellow',
      });

      const validation = await indexCoordinator.validateIndex();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Missing vectors');
    });
  });

  describe('optimizeIndex', () => {
    it('should optimize index performance', async () => {
      const result = await indexCoordinator.optimizeIndex();

      expect(result.success).toBe(true);
      expect(result.optimizationsApplied).toBeInstanceOf(Array);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Index optimization completed');
    });
  });
});