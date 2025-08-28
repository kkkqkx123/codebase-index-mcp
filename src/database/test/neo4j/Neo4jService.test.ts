import { Neo4jService } from '../../Neo4jService';
import { Neo4jConnectionManager } from '../../neo4j/Neo4jConnectionManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';

// Mock services
class MockLoggerService {
  error(_message: string, _meta?: any) {}
  info(_message: string, _meta?: any) {}
}

class MockErrorHandlerService {
  handleError(_error: Error, _context?: any) {
    return { id: 'test-error-id' };
  }
}

// Mock Neo4jConnectionManager
class MockNeo4jConnectionManager {
  private _isConnected: boolean = false;
  
  async connect(): Promise<boolean> {
    this._isConnected = true;
    return true;
  }
  
  async close() {
    this._isConnected = false;
  }
  
  isConnectedToDatabase(): boolean {
    return this._isConnected;
  }
  
  async executeQuery(query: any) {
    return { 
      records: [], 
      summary: { 
        query: query.cypher,
        parameters: query.parameters || {},
        resultAvailableAfter: 10,
        resultConsumedAfter: 5
      } 
    };
  }
  
  async executeTransaction(queries: any[]) {
    return queries.map(() => ({ 
      records: [], 
      summary: { 
        query: { text: '', parameters: {} },
        server: { version: 'Neo4j/4.4' },
        counters: { containsUpdates: () => false, updates: () => ({}) },
        plan: undefined,
        profile: undefined,
        notifications: [],
        resultAvailableAfter: 10,
        resultConsumedAfter: 5
      } 
    }));
  }
  
  async createNode(_node: any) {
    return 'node-id';
  }
  
  async createRelationship(_relationship: any) {
    return 'relationship-id';
  }
  
  async findNodesByLabel(_label: string, _properties?: any) {
    return [];
  }
  
  async findRelationships(_type?: string, _properties?: any) {
    return [];
  }
  
  async getDatabaseStats() {
    return { nodeCount: 0, relationshipCount: 0, labels: [], relationshipTypes: [] };
  }
  
  async getReadSession() {
    return {};
  }
  
  async getWriteSession() {
    return {};
  }
  
  getMetrics() {
    return {
      totalSessionsCreated: 0,
      totalSessionsClosed: 0,
      activeSessions: 0,
      avgSessionDuration: 0,
      sessionTimeouts: 0
    };
  }
}

describe('Neo4jService', () => {
  let neo4jService: Neo4jService;
  let mockConnectionManager: Neo4jConnectionManager;
  
  beforeEach(() => {
    const loggerService = new MockLoggerService() as unknown as LoggerService;
    const errorHandlerService = new MockErrorHandlerService() as unknown as ErrorHandlerService;
    mockConnectionManager = new MockNeo4jConnectionManager() as unknown as Neo4jConnectionManager;
    
    neo4jService = new Neo4jService(
      loggerService,
      errorHandlerService,
      mockConnectionManager
    );
  });
  
  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await neo4jService.initialize();
      expect(result).toBe(true);
    });
  });
  
  describe('executeReadQuery', () => {
    it('should execute a read query', async () => {
      // Mock session
      const mockSession = {
        run: jest.fn().mockResolvedValue({ 
          records: [],
          summary: { 
            query: { text: 'MATCH (n) RETURN n', parameters: {} },
            server: { version: 'Neo4j/4.4' },
            counters: { containsUpdates: () => false, updates: () => ({}) },
            plan: undefined,
            profile: undefined,
            notifications: [],
            resultAvailableAfter: 10,
            resultConsumedAfter: 5
          } 
        }),
        close: jest.fn()
      };
      
      // Mock getReadSession to return our mock session
      jest.spyOn(mockConnectionManager, 'getReadSession').mockResolvedValue(mockSession as any);
      
      const result = await neo4jService.executeReadQuery('MATCH (n) RETURN n');
      
      expect(mockSession.run).toHaveBeenCalledWith('MATCH (n) RETURN n', undefined);
      expect(mockSession.close).toHaveBeenCalled();
      expect(result.records).toEqual([]);
      expect(result.summary.query.text).toBe('MATCH (n) RETURN n');
      expect(result.summary.query.parameters).toEqual({});
      expect(result.summary.resultAvailableAfter).toBe(10);
      expect(result.summary.resultConsumedAfter).toBe(5);
    });
  });
  
  describe('executeWriteQuery', () => {
    it('should execute a write query', async () => {
      // Mock session
      const mockSession = {
        run: jest.fn().mockResolvedValue({ 
          records: [],
          summary: { 
            query: { text: 'CREATE (n:Test {name: $name})', parameters: { name: 'test' } },
            server: { version: 'Neo4j/4.4' },
            counters: { containsUpdates: () => true, updates: () => ({ nodesCreated: 1 }) },
            plan: undefined,
            profile: undefined,
            notifications: [],
            resultAvailableAfter: 15,
            resultConsumedAfter: 8
          } 
        }),
        close: jest.fn()
      };
      
      // Mock getWriteSession to return our mock session
      jest.spyOn(mockConnectionManager, 'getWriteSession').mockResolvedValue(mockSession as any);
      
      const result = await neo4jService.executeWriteQuery('CREATE (n:Test {name: $name})', { name: 'test' });
      
      expect(mockSession.run).toHaveBeenCalledWith('CREATE (n:Test {name: $name})', { name: 'test' });
      expect(mockSession.close).toHaveBeenCalled();
      expect(result.records).toEqual([]);
      expect(result.summary.query.text).toBe('CREATE (n:Test {name: $name})');
      expect(result.summary.query.parameters).toEqual({ name: 'test' });
      expect(result.summary.resultAvailableAfter).toBe(15);
      expect(result.summary.resultConsumedAfter).toBe(8);
    });
  });
  
  describe('executeTransaction', () => {
    it('should execute a transaction', async () => {
      const queries = [
        { cypher: 'CREATE (n:Test {name: $name})', parameters: { name: 'test1' } },
        { cypher: 'CREATE (n:Test {name: $name})', parameters: { name: 'test2' } }
      ];
      
      const spy = jest.spyOn(mockConnectionManager, 'executeTransaction').mockResolvedValue([
        { 
          records: [], 
          summary: { 
            query: 'CREATE (n:Test {name: $name})',
            parameters: { name: 'test1' },
            resultAvailableAfter: 15,
            resultConsumedAfter: 8
          } 
        },
        { 
          records: [], 
          summary: { 
            query: 'CREATE (n:Test {name: $name})',
            parameters: { name: 'test2' },
            resultAvailableAfter: 15,
            resultConsumedAfter: 8
          } 
        }
      ]);
      
      const result = await neo4jService.executeTransaction(queries);
      
      expect(spy).toHaveBeenCalledWith([
        { cypher: 'CREATE (n:Test {name: $name})', parameters: { name: 'test1' } },
        { cypher: 'CREATE (n:Test {name: $name})', parameters: { name: 'test2' } }
      ]);
      expect(result).toEqual([
        { 
          records: [], 
          summary: { 
            query: 'CREATE (n:Test {name: $name})',
            parameters: { name: 'test1' },
            resultAvailableAfter: 15,
            resultConsumedAfter: 8
          } 
        },
        { 
          records: [], 
          summary: { 
            query: 'CREATE (n:Test {name: $name})',
            parameters: { name: 'test2' },
            resultAvailableAfter: 15,
            resultConsumedAfter: 8
          } 
        }
      ]);
    });
  });
  
  describe('createNode', () => {
    it('should create a node', async () => {
      const node = { id: 'test-id', labels: ['Test'], properties: { name: 'test' } };
      const spy = jest.spyOn(mockConnectionManager, 'createNode').mockResolvedValue('node-id');
      
      const result = await neo4jService.createNode(node);
      
      expect(spy).toHaveBeenCalledWith(node);
      expect(result).toBe('node-id');
    });
  });
  
  describe('createRelationship', () => {
    it('should create a relationship', async () => {
      const relationship = { 
        id: 'rel-id', 
        type: 'TEST_REL', 
        startNodeId: 'start-id', 
        endNodeId: 'end-id', 
        properties: { name: 'test' } 
      };
      const spy = jest.spyOn(mockConnectionManager, 'createRelationship').mockResolvedValue('rel-id');
      
      const result = await neo4jService.createRelationship(relationship);
      
      expect(spy).toHaveBeenCalledWith(relationship);
      expect(result).toBe('rel-id');
    });
  });
  
  describe('findNodes', () => {
    it('should find nodes by label', async () => {
      const spy = jest.spyOn(mockConnectionManager, 'findNodesByLabel').mockResolvedValue([]);
      
      const result = await neo4jService.findNodes('TestLabel');
      
      expect(spy).toHaveBeenCalledWith('TestLabel', undefined);
      expect(result).toEqual([]);
    });
  });
  
  describe('findRelationships', () => {
    it('should find relationships', async () => {
      const spy = jest.spyOn(mockConnectionManager, 'findRelationships').mockResolvedValue([]);
      
      const result = await neo4jService.findRelationships('TEST_REL');
      
      expect(spy).toHaveBeenCalledWith('TEST_REL', undefined);
      expect(result).toEqual([]);
    });
  });
  
  describe('getDatabaseStats', () => {
    it('should get database stats', async () => {
      const stats = { nodeCount: 10, relationshipCount: 5, labels: ['Test'], relationshipTypes: ['TEST_REL'] };
      const spy = jest.spyOn(mockConnectionManager, 'getDatabaseStats').mockResolvedValue(stats);
      
      const result = await neo4jService.getDatabaseStats();
      
      expect(spy).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });
  
  describe('isConnected', () => {
    it('should return connection status', () => {
      const spy = jest.spyOn(mockConnectionManager, 'isConnectedToDatabase').mockReturnValue(false);
      
      const result = neo4jService.isConnected();
      
      expect(spy).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
  
  describe('close', () => {
    it('should close the connection', async () => {
      const spy = jest.spyOn(mockConnectionManager, 'close').mockResolvedValue();
      
      await neo4jService.close();
      
      expect(spy).toHaveBeenCalled();
    });
  });
});