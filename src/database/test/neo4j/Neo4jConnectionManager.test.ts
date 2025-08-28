import { Neo4jConnectionManager } from '../../neo4j/Neo4jConnectionManager';
import { Driver, Session } from 'neo4j-driver';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { spawn } from 'child_process';
import { join } from 'path';

// Function to run PowerShell script
async function runPowerShellScript(scriptName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, scriptName);
    const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      cwd: __dirname
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}

// Create database before running tests
beforeAll(async () => {
  const result = await runPowerShellScript('setup-test-database.ps1');
  if (!result) {
    throw new Error('Failed to create test database');
  }
});

// Drop database after running tests
afterAll(async () => {
  // We don't fail the test if we can't drop the database
  await runPowerShellScript('drop-test-database.ps1');
});

// Mock services
class MockConfigService {
  get(key: string) {
    if (key === 'neo4j') {
      return {
        uri: 'bolt://localhost:7687',
        username: 'neo4j',
        password: 'password',
        database: 'neo4j'
      };
    }
    return {};
  }
}

class MockLoggerService {
  error(_message: string, _meta?: any) {}
  info(_message: string, _meta?: any) {}
}

class MockErrorHandlerService {
  handleError(_error: Error, _context?: any) {
    return { id: 'test-error-id' };
  }
}

// Mock Neo4j Driver and Session
class MockResult {
  constructor(public records: any[], public summary: any) {}
}

class MockSession {
  private _isOpen: boolean = true;
  
  async close() {
    this._isOpen = false;
  }
  
  get isOpen() {
    return this._isOpen;
  }
  
  async run(cypher: string, parameters?: any) {
    if (!this._isOpen) {
      throw new Error('Session is closed');
    }
    return new MockResult([], {
      query: cypher,
      parameters: parameters || {},
      resultAvailableAfter: 10,
      resultConsumedAfter: 5
    });
  }
  
  async writeTransaction(callback: any) {
    if (!this._isOpen) {
      throw new Error('Session is closed');
    }
    return callback({ run: this.run.bind(this) });
  }
}

class MockDriver {
  session(_options?: any) {
    return new MockSession() as unknown as Session;
  }
  
  async close() {}
}

// Mock SessionPool
class MockSessionPool {
  private mockSession: Session;
  
  constructor(_driver: Driver) {
    this.mockSession = new MockSession() as unknown as Session;
  }
  
  async getSession(_accessMode: 'READ' | 'WRITE' = 'WRITE') {
    return this.mockSession;
  }
  
  async releaseSession(_session: Session) {}
  
  async close() {}
  
  getMetrics() {
    return {
      totalSessionsCreated: 0,
      totalSessionsClosed: 0,
      activeSessions: 0,
      avgSessionDuration: 0,
      sessionTimeouts: 0
    };
  }
  
  async getReadSession() {
    return this.mockSession;
  }
  
  async getWriteSession() {
    return this.mockSession;
  }
}

// Mock the SessionPool import
describe('Neo4jConnectionManager', () => {
  let connectionManager: Neo4jConnectionManager;
  
  beforeEach(() => {
    // Mock the neo4j-driver import
    jest.mock('neo4j-driver', () => ({
      driver: () => new MockDriver(),
      auth: {
        basic: () => {}
      },
      integer: {
        inSafeRange: () => true,
        toNumber: (val: any) => val
      }
    }));
    
    // 确保模块被正确重置
    jest.resetModules();
    
    // Mock the SessionPool import
    jest.mock('../neo4j/SessionPool', () => ({
      SessionPool: MockSessionPool
    }));
    
    const configService = new MockConfigService() as unknown as ConfigService;
    const loggerService = new MockLoggerService() as unknown as LoggerService;
    const errorHandlerService = new MockErrorHandlerService() as unknown as ErrorHandlerService;
    
    connectionManager = new Neo4jConnectionManager(
      configService,
      loggerService,
      errorHandlerService
    );
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('connect', () => {
    it('should connect successfully', async () => {
      console.log('Before calling connect');
      const result = await connectionManager.connect();
      console.log('After calling connect, result:', result);
      expect(result).toBe(true);
      // 验证连接状态
      console.log('Before calling isConnectedToDatabase');
      const isConnected = connectionManager.isConnectedToDatabase();
      console.log('After calling isConnectedToDatabase, result:', isConnected);
      expect(isConnected).toBe(true);
    });
  });
  
  describe('executeQuery', () => {
    it('should execute a query successfully', async () => {
      // First connect
      await connectionManager.connect();
      
      const query = { cypher: 'MATCH (n) RETURN n' };
      const result = await connectionManager.executeQuery(query);
      
      expect(result).toBeDefined();
      expect(result.records).toEqual([]);
      expect(result.summary.query).toBe(query.cypher);
    });
  });
  
  describe('executeTransaction', () => {
    it('should execute a transaction successfully', async () => {
      // First connect
      await connectionManager.connect();
      
      const queries = [{ cypher: 'CREATE (n:TestNode {name: $name})', parameters: { name: 'test' } }];
      const results = await connectionManager.executeTransaction(queries);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
    });
  });
  
  describe('createNode', () => {
    it('should create a node successfully', async () => {
      // First connect
      await connectionManager.connect();
      
      const node = {
        id: 'test-id',
        labels: ['TestLabel'],
        properties: { name: 'test' }
      };
      
      const result = await connectionManager.createNode(node);
      expect(result).toBe('test-id');
    });
  });
  
  describe('createRelationship', () => {
    it('should create a relationship successfully', async () => {
      // First connect
      await connectionManager.connect();
      
      const relationship = {
        id: 'rel-id',
        type: 'TEST_RELATIONSHIP',
        startNodeId: 'start-id',
        endNodeId: 'end-id',
        properties: { name: 'test' }
      };
      
      const result = await connectionManager.createRelationship(relationship);
      expect(result).toBe('rel-id');
    });
  });
  
  describe('isConnectedToDatabase', () => {
    it('should return false when not connected', () => {
      expect(connectionManager.isConnectedToDatabase()).toBe(false);
    });
    
    it('should return true when connected', async () => {
      await connectionManager.connect();
      expect(connectionManager.isConnectedToDatabase()).toBe(true);
    });
  });
  
  describe('getSessionMetrics', () => {
    it('should throw error when session pool not initialized', () => {
      expect(() => connectionManager.getSessionMetrics()).toThrow('Session pool not initialized');
    });
    
    it('should return metrics when session pool is initialized', async () => {
      await connectionManager.connect();
      const metrics = connectionManager.getSessionMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalSessionsCreated).toBe(0);
    });
  });
});