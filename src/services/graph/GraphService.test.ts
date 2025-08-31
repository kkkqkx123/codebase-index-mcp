import { Container } from 'inversify';
import { GraphService } from './GraphService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('GraphService', () => {
  let container: Container;
  let graphService: GraphService;
  let mockNebulaService: jest.Mocked<NebulaService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();
    
    // Create mocks
    mockNebulaService = {
      executeQuery: jest.fn(),
      createNode: jest.fn(),
      createEdge: jest.fn(),
      findRelatedNodes: jest.fn(),
      getNodeById: jest.fn(),
      updateNode: jest.fn(),
      deleteNode: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getGraphConfig: jest.fn().mockReturnValue({
        spaceName: 'codebase_graph',
        maxTraversalDepth: 5,
        queryTimeout: 30000,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.GraphService).to(GraphService);

    graphService = container.get<GraphService>(TYPES.GraphService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCodeStructure', () => {
    it('should analyze code structure and return hierarchy', async () => {
      const filePath = '/src/auth/AuthService.ts';
      const structureData = [
        {
          id: 'class_AuthService',
          properties: {
            name: 'AuthService',
            type: 'class',
            filePath: '/src/auth/AuthService.ts',
            methods: ['login', 'logout', 'refresh'],
          }
        },
        {
          id: 'func_login',
          properties: {
            name: 'login',
            type: 'function',
            parentClass: 'AuthService',
            signature: 'login(credentials: LoginCredentials): Promise<User>',
          }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: structureData });

      const result = await graphService.analyzeCodeStructure(filePath);

      expect(result.classes).toHaveLength(1);
      expect(result.functions).toHaveLength(1);
      expect(result.classes[0].name).toBe('AuthService');
      expect(result.functions[0].name).toBe('login');
    });
  });

  describe('findDependencies', () => {
    it('should find all dependencies for a given entity', async () => {
      const entityId = 'func_authenticate';
      const dependencies = [
        {
          id: 'func_validateUser',
          properties: { name: 'validateUser', filePath: '/src/validation.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 3 } }
        },
        {
          id: 'class_User',
          properties: { name: 'User', filePath: '/src/models/User.ts' },
          relationship: { type: 'USES', properties: { usageType: 'parameter' } }
        },
      ];

      mockNebulaService.findRelatedNodes.mockResolvedValue(dependencies);

      const result = await graphService.findDependencies(entityId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('validateUser');
      expect(result[0].dependencyType).toBe('CALLS');
      expect(result[1].name).toBe('User');
      expect(result[1].dependencyType).toBe('USES');
    });
  });

  describe('findDependents', () => {
    it('should find all entities that depend on a given entity', async () => {
      const entityId = 'func_validateUser';
      const dependents = [
        {
          id: 'func_authenticate',
          properties: { name: 'authenticate', filePath: '/src/auth.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 3 } }
        },
        {
          id: 'func_register',
          properties: { name: 'register', filePath: '/src/registration.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 1 } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: dependents });

      const result = await graphService.findDependents(entityId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('authenticate');
      expect(result[1].name).toBe('register');
    });
  });

  describe('getCallChain', () => {
    it('should trace call chain between two functions', async () => {
      const fromFunction = 'func_main';
      const toFunction = 'func_helper';
      const callChain = [
        {
          id: 'func_main',
          properties: { name: 'main' },
          path: [
            { id: 'func_main', name: 'main' },
            { id: 'func_process', name: 'process' },
            { id: 'func_helper', name: 'helper' },
          ]
        }
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: callChain });

      const result = await graphService.getCallChain(fromFunction, toFunction);

      expect(result.path).toHaveLength(3);
      expect(result.path[0].name).toBe('main');
      expect(result.path[2].name).toBe('helper');
      expect(result.depth).toBe(2);
    });

    it('should return empty path when no connection exists', async () => {
      const fromFunction = 'func_isolated1';
      const toFunction = 'func_isolated2';

      mockNebulaService.executeQuery.mockResolvedValue({ data: [] });

      const result = await graphService.getCallChain(fromFunction, toFunction);

      expect(result.path).toHaveLength(0);
      expect(result.connected).toBe(false);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of changes to a function', async () => {
      const functionId = 'func_authenticate';
      const impactData = [
        {
          id: 'func_login',
          properties: { name: 'login', filePath: '/src/auth.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 10 } }
        },
        {
          id: 'func_middleware',
          properties: { name: 'authMiddleware', filePath: '/src/middleware.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 50 } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: impactData });

      const result = await graphService.analyzeImpact(functionId);

      expect(result.directImpact).toHaveLength(2);
      expect(result.riskLevel).toBe('high'); // Due to high call count
      expect(result.affectedFiles).toContain('/src/auth.ts');
      expect(result.affectedFiles).toContain('/src/middleware.ts');
    });

    it('should calculate low risk for functions with minimal usage', async () => {
      const functionId = 'func_utility';
      const impactData = [
        {
          id: 'func_helper',
          properties: { name: 'helper', filePath: '/src/utils.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 1 } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: impactData });

      const result = await graphService.analyzeImpact(functionId);

      expect(result.riskLevel).toBe('low');
      expect(result.directImpact).toHaveLength(1);
    });
  });

  describe('findCircularDependencies', () => {
    it('should detect circular dependencies in the codebase', async () => {
      const circularDeps = [
        {
          cycle: [
            { id: 'func_a', name: 'functionA', filePath: '/src/a.ts' },
            { id: 'func_b', name: 'functionB', filePath: '/src/b.ts' },
            { id: 'func_c', name: 'functionC', filePath: '/src/c.ts' },
            { id: 'func_a', name: 'functionA', filePath: '/src/a.ts' }, // Back to start
          ]
        }
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: circularDeps });

      const result = await graphService.findCircularDependencies();

      expect(result).toHaveLength(1);
      expect(result[0].cycle).toHaveLength(4);
      expect(result[0].severity).toBe('medium');
    });
  });

  describe('getModuleStructure', () => {
    it('should analyze module structure and relationships', async () => {
      const moduleData = [
        {
          id: 'module_auth',
          properties: {
            name: 'auth',
            path: '/src/auth',
            files: ['/src/auth/index.ts', '/src/auth/service.ts'],
            exports: ['AuthService', 'authenticate'],
          }
        },
        {
          id: 'module_user',
          properties: {
            name: 'user',
            path: '/src/user',
            files: ['/src/user/index.ts', '/src/user/model.ts'],
            exports: ['User', 'UserService'],
          }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: moduleData });

      const result = await graphService.getModuleStructure();

      expect(result.modules).toHaveLength(2);
      expect(result.modules[0].name).toBe('auth');
      expect(result.modules[0].exports).toContain('AuthService');
    });
  });

  describe('findUnusedCode', () => {
    it('should identify unused functions and classes', async () => {
      const unusedCode = [
        {
          id: 'func_unused1',
          properties: {
            name: 'unusedFunction',
            filePath: '/src/utils.ts',
            type: 'function',
            lastModified: '2023-01-01',
          }
        },
        {
          id: 'class_unused1',
          properties: {
            name: 'UnusedClass',
            filePath: '/src/legacy.ts',
            type: 'class',
            lastModified: '2022-12-01',
          }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: unusedCode });

      const result = await graphService.findUnusedCode();

      expect(result.unusedFunctions).toHaveLength(1);
      expect(result.unusedClasses).toHaveLength(1);
      expect(result.unusedFunctions[0].name).toBe('unusedFunction');
      expect(result.unusedClasses[0].name).toBe('UnusedClass');
    });
  });

  describe('getComplexityMetrics', () => {
    it('should calculate complexity metrics for the codebase', async () => {
      const complexityData = [
        {
          id: 'func_complex',
          properties: {
            name: 'complexFunction',
            cyclomaticComplexity: 15,
            cognitiveComplexity: 20,
            linesOfCode: 150,
          }
        },
        {
          id: 'func_simple',
          properties: {
            name: 'simpleFunction',
            cyclomaticComplexity: 2,
            cognitiveComplexity: 3,
            linesOfCode: 10,
          }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: complexityData });

      const result = await graphService.getComplexityMetrics();

      expect(result.averageCyclomaticComplexity).toBe(8.5);
      expect(result.averageCognitiveComplexity).toBe(11.5);
      expect(result.highComplexityFunctions).toHaveLength(1);
      expect(result.highComplexityFunctions[0].name).toBe('complexFunction');
    });
  });

  describe('visualizeGraph', () => {
    it('should generate graph visualization data', async () => {
      const graphData = [
        {
          nodes: [
            { id: 'func_1', label: 'authenticate', type: 'function' },
            { id: 'func_2', label: 'validate', type: 'function' },
          ],
          edges: [
            { from: 'func_1', to: 'func_2', type: 'CALLS', weight: 5 },
          ]
        }
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: graphData });

      const result = await graphService.visualizeGraph({ maxNodes: 100 });

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.layout).toBeDefined();
    });
  });

  describe('searchByPattern', () => {
    it('should search for code patterns in the graph', async () => {
      const pattern = 'function -> calls -> function';
      const matches = [
        {
          pattern: [
            { id: 'func_main', name: 'main', type: 'function' },
            { id: 'func_helper', name: 'helper', type: 'function' },
          ],
          confidence: 0.95,
        }
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: matches });

      const result = await graphService.searchByPattern(pattern);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.95);
      expect(result[0].pattern).toHaveLength(2);
    });
  });
});