import { Container } from 'inversify';
import { GraphPersistenceService } from './GraphPersistenceService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../core/DIContainer';

describe('GraphPersistenceService', () => {
  let container: Container;
  let graphPersistenceService: GraphPersistenceService;
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
      updateNode: jest.fn(),
      deleteNode: jest.fn(),
      findRelatedNodes: jest.fn(),
      getNodeById: jest.fn(),
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
        batchSize: 100,
        maxRetries: 3,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.GraphPersistenceService).to(GraphPersistenceService);

    graphPersistenceService = container.get<GraphPersistenceService>(TYPES.GraphPersistenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeCodeEntity', () => {
    it('should store a function entity', async () => {
      const entity = {
        id: 'func_123',
        type: 'function',
        name: 'authenticateUser',
        filePath: '/src/auth.ts',
        startLine: 10,
        endLine: 25,
        signature: 'authenticateUser(username: string, password: string): Promise<User>',
        complexity: 5,
        parameters: ['username', 'password'],
        returnType: 'Promise<User>',
      };

      mockNebulaService.createNode.mockResolvedValue({ success: true, id: entity.id });

      await graphPersistenceService.storeCodeEntity(entity);

      expect(mockNebulaService.createNode).toHaveBeenCalledWith(
        'Function',
        entity.id,
        {
          name: entity.name,
          filePath: entity.filePath,
          startLine: entity.startLine,
          endLine: entity.endLine,
          signature: entity.signature,
          complexity: entity.complexity,
          parameters: JSON.stringify(entity.parameters),
          returnType: entity.returnType,
        }
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Stored code entity', { id: entity.id, type: entity.type });
    });

    it('should store a class entity', async () => {
      const entity = {
        id: 'class_456',
        type: 'class',
        name: 'UserService',
        filePath: '/src/services/UserService.ts',
        startLine: 5,
        endLine: 150,
        methods: ['getUser', 'createUser', 'updateUser'],
        properties: ['users', 'config'],
        extends: 'BaseService',
        implements: ['IUserService'],
      };

      mockNebulaService.createNode.mockResolvedValue({ success: true, id: entity.id });

      await graphPersistenceService.storeCodeEntity(entity);

      expect(mockNebulaService.createNode).toHaveBeenCalledWith(
        'Class',
        entity.id,
        expect.objectContaining({
          name: entity.name,
          filePath: entity.filePath,
          methods: JSON.stringify(entity.methods),
          properties: JSON.stringify(entity.properties),
          extends: entity.extends,
          implements: JSON.stringify(entity.implements),
        })
      );
    });
  });

  describe('storeRelationship', () => {
    it('should store a function call relationship', async () => {
      const relationship = {
        fromId: 'func_123',
        toId: 'func_456',
        type: 'CALLS',
        properties: {
          callCount: 3,
          isConditional: false,
          lineNumber: 15,
        }
      };

      mockNebulaService.createEdge.mockResolvedValue({ success: true });

      await graphPersistenceService.storeRelationship(relationship);

      expect(mockNebulaService.createEdge).toHaveBeenCalledWith(
        relationship.fromId,
        relationship.toId,
        relationship.type,
        relationship.properties
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Stored relationship', {
        from: relationship.fromId,
        to: relationship.toId,
        type: relationship.type,
      });
    });

    it('should store an inheritance relationship', async () => {
      const relationship = {
        fromId: 'class_123',
        toId: 'class_456',
        type: 'EXTENDS',
        properties: {
          isAbstract: false,
        }
      };

      mockNebulaService.createEdge.mockResolvedValue({ success: true });

      await graphPersistenceService.storeRelationship(relationship);

      expect(mockNebulaService.createEdge).toHaveBeenCalledWith(
        relationship.fromId,
        relationship.toId,
        relationship.type,
        relationship.properties
      );
    });
  });

  describe('updateEntity', () => {
    it('should update an existing entity', async () => {
      const entityId = 'func_123';
      const updates = {
        complexity: 7,
        lastModified: new Date().toISOString(),
        signature: 'authenticateUser(username: string, password: string, options?: AuthOptions): Promise<User>',
      };

      mockNebulaService.updateNode.mockResolvedValue({ success: true });

      await graphPersistenceService.updateEntity(entityId, updates);

      expect(mockNebulaService.updateNode).toHaveBeenCalledWith(entityId, updates);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Updated entity', { id: entityId });
    });
  });

  describe('deleteEntity', () => {
    it('should delete an entity and its relationships', async () => {
      const entityId = 'func_123';

      mockNebulaService.deleteNode.mockResolvedValue({ success: true });

      await graphPersistenceService.deleteEntity(entityId);

      expect(mockNebulaService.deleteNode).toHaveBeenCalledWith(entityId);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Deleted entity', { id: entityId });
    });
  });

  describe('getEntityById', () => {
    it('should retrieve an entity by ID', async () => {
      const entityId = 'func_123';
      const entityData = {
        id: entityId,
        properties: {
          name: 'authenticateUser',
          filePath: '/src/auth.ts',
          signature: 'authenticateUser(username: string, password: string): Promise<User>',
        }
      };

      mockNebulaService.getNodeById.mockResolvedValue(entityData);

      const result = await graphPersistenceService.getEntityById(entityId);

      expect(result).toEqual({
        id: entityId,
        ...entityData.properties,
      });
      expect(mockNebulaService.getNodeById).toHaveBeenCalledWith(entityId);
    });

    it('should return null for non-existent entity', async () => {
      const entityId = 'non_existent';

      mockNebulaService.getNodeById.mockResolvedValue(null);

      const result = await graphPersistenceService.getEntityById(entityId);

      expect(result).toBeNull();
    });
  });

  describe('findRelatedEntities', () => {
    it('should find entities related by specific relationship type', async () => {
      const entityId = 'func_123';
      const relationshipType = 'CALLS';
      const options = { maxDepth: 2, direction: 'outgoing' };

      const relatedEntities = [
        {
          id: 'func_456',
          properties: { name: 'validateUser', filePath: '/src/validation.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 2 } }
        },
        {
          id: 'func_789',
          properties: { name: 'logActivity', filePath: '/src/logging.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 1 } }
        },
      ];

      mockNebulaService.findRelatedNodes.mockResolvedValue(relatedEntities);

      const result = await graphPersistenceService.findRelatedEntities(entityId, relationshipType, options);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('func_456');
      expect(result[0].relationshipType).toBe('CALLS');
      expect(mockNebulaService.findRelatedNodes).toHaveBeenCalledWith(entityId, relationshipType, options);
    });
  });

  describe('getCallGraph', () => {
    it('should build a call graph for a function', async () => {
      const functionId = 'func_123';
      const maxDepth = 3;

      const callGraphData = [
        {
          id: 'func_456',
          properties: { name: 'helper1' },
          relationship: { type: 'CALLS', properties: { depth: 1 } }
        },
        {
          id: 'func_789',
          properties: { name: 'helper2' },
          relationship: { type: 'CALLS', properties: { depth: 2 } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: callGraphData });

      const result = await graphPersistenceService.getCallGraph(functionId, maxDepth);

      expect(result.rootFunction).toBe(functionId);
      expect(result.calls).toHaveLength(2);
      expect(result.maxDepth).toBe(maxDepth);
    });
  });

  describe('getDependencyGraph', () => {
    it('should build a dependency graph for a file', async () => {
      const filePath = '/src/auth.ts';

      const dependencies = [
        {
          id: 'file_456',
          properties: { filePath: '/src/utils/crypto.ts' },
          relationship: { type: 'IMPORTS', properties: { importType: 'named' } }
        },
        {
          id: 'file_789',
          properties: { filePath: '/src/models/User.ts' },
          relationship: { type: 'IMPORTS', properties: { importType: 'default' } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: dependencies });

      const result = await graphPersistenceService.getDependencyGraph(filePath);

      expect(result.file).toBe(filePath);
      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0].filePath).toBe('/src/utils/crypto.ts');
    });
  });

  describe('getImpactAnalysis', () => {
    it('should analyze impact of changes to an entity', async () => {
      const entityId = 'func_123';

      const impactData = [
        {
          id: 'func_456',
          properties: { name: 'caller1', filePath: '/src/service1.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 5 } }
        },
        {
          id: 'func_789',
          properties: { name: 'caller2', filePath: '/src/service2.ts' },
          relationship: { type: 'CALLS', properties: { callCount: 2 } }
        },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: impactData });

      const result = await graphPersistenceService.getImpactAnalysis(entityId);

      expect(result.targetEntity).toBe(entityId);
      expect(result.impactedEntities).toHaveLength(2);
      expect(result.riskLevel).toBeDefined();
      expect(result.impactScore).toBeGreaterThan(0);
    });
  });

  describe('storeBatch', () => {
    it('should store multiple entities and relationships in batch', async () => {
      const entities = [
        { id: 'func_1', type: 'function', name: 'test1', filePath: '/src/test1.ts' },
        { id: 'func_2', type: 'function', name: 'test2', filePath: '/src/test2.ts' },
      ];

      const relationships = [
        { fromId: 'func_1', toId: 'func_2', type: 'CALLS', properties: {} },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ success: true });

      await graphPersistenceService.storeBatch(entities, relationships);

      expect(mockNebulaService.executeQuery).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalledWith('Stored batch', {
        entities: entities.length,
        relationships: relationships.length,
      });
    });
  });

  describe('getGraphStatistics', () => {
    it('should return graph statistics', async () => {
      const statsData = [
        { label: 'Function', count: 150 },
        { label: 'Class', count: 25 },
        { label: 'File', count: 50 },
      ];

      mockNebulaService.executeQuery.mockResolvedValue({ data: statsData });

      const stats = await graphPersistenceService.getGraphStatistics();

      expect(stats.totalNodes).toBe(225);
      expect(stats.nodeTypes.Function).toBe(150);
      expect(stats.nodeTypes.Class).toBe(25);
      expect(stats.nodeTypes.File).toBe(50);
    });
  });
});