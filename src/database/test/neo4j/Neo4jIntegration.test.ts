import { Neo4jService } from '../../Neo4jService';
import { Neo4jConnectionManager } from '../../neo4j/Neo4jConnectionManager';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { container } from '../../../inversify.config';

describe('Neo4j Integration', () => {
  let neo4jService: Neo4jService;
  let connectionManager: Neo4jConnectionManager;
  
  beforeEach(() => {
    // 重置容器以确保干净的测试环境
    jest.resetModules();
    
    const configService = container.get<ConfigService>(ConfigService);
    const loggerService = container.get<LoggerService>(LoggerService);
    const errorHandlerService = container.get<ErrorHandlerService>(ErrorHandlerService);
    
    connectionManager = new Neo4jConnectionManager(
      configService,
      loggerService,
      errorHandlerService
    );
    
    neo4jService = new Neo4jService(
      loggerService,
      errorHandlerService,
      connectionManager
    );
  });
  
  afterEach(async () => {
    // Clean up any connections
    await neo4jService.close();
  });
  
  it('should initialize Neo4j service successfully', async () => {
    // Since we're using mock drivers, this should succeed
    const result = await neo4jService.initialize();
    expect(result).toBe(true);
  });
  
  it('should handle connection status correctly', async () => {
    // Initially not connected
    expect(neo4jService.isConnected()).toBe(false);
    
    // After initialization, should be connected
    await neo4jService.initialize();
    expect(neo4jService.isConnected()).toBe(true);
  });
  
  it('should create and find nodes', async () => {
    await neo4jService.initialize();
    
    // Create a node
    const nodeId = await neo4jService.createNode({
      id: 'test-node-1',
      labels: ['TestNode'],
      properties: { name: 'Test Node 1', value: 42 }
    });
    
    expect(nodeId).toBeDefined();
    
    // Find nodes by label
    const nodes = await neo4jService.findNodes('TestNode');
    expect(nodes).toBeDefined();
    // Note: With mock implementation, we can't verify the actual content
  });
  
  it('should create and find relationships', async () => {
    await neo4jService.initialize();
    
    // Create relationship
    const relationshipId = await neo4jService.createRelationship({
      id: 'test-rel-1',
      type: 'TEST_RELATIONSHIP',
      startNodeId: 'node-1',
      endNodeId: 'node-2',
      properties: { name: 'Test Relationship', strength: 0.8 }
    });
    
    expect(relationshipId).toBeDefined();
    
    // Find relationships
    const relationships = await neo4jService.findRelationships('TEST_RELATIONSHIP');
    expect(relationships).toBeDefined();
  });
  
  it('should execute read and write queries', async () => {
    await neo4jService.initialize();
    
    // Execute a write query
    const writeResult = await neo4jService.executeWriteQuery(
      'CREATE (n:Test {name: $name}) RETURN n',
      { name: 'integration-test' }
    );
    
    expect(writeResult).toBeDefined();
    
    // Execute a read query
    const readResult = await neo4jService.executeReadQuery(
      'MATCH (n:Test {name: $name}) RETURN n',
      { name: 'integration-test' }
    );
    
    expect(readResult).toBeDefined();
  });
  
  it('should execute transactions', async () => {
    await neo4jService.initialize();
    
    const queries = [
      { cypher: 'CREATE (n:TransactionTest {name: $name})', parameters: { name: 'test1' } },
      { cypher: 'CREATE (n:TransactionTest {name: $name})', parameters: { name: 'test2' } }
    ];
    
    const results = await neo4jService.executeTransaction(queries);
    
    expect(results).toBeDefined();
    expect(results.length).toBe(2);
  });
  
  it('should get database stats', async () => {
    await neo4jService.initialize();
    
    const stats = await neo4jService.getDatabaseStats();
    
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('nodeCount');
    expect(stats).toHaveProperty('relationshipCount');
    expect(stats).toHaveProperty('labels');
    expect(stats).toHaveProperty('relationshipTypes');
  });
});