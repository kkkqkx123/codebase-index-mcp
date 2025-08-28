import { SessionPool, SessionMonitor } from '../../neo4j/SessionPool';
import { Driver, Session } from 'neo4j-driver';
import { LoggerService } from '../../../core/LoggerService';
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

// Mock LoggerService
class MockLoggerService extends LoggerService {
  error(_message: string, _meta?: any) { /* Mock implementation */ }
  info(_message: string, _meta?: any) { /* Mock implementation */ }
  warn(_message: string, _meta?: any) { /* Mock implementation */ }
  debug(_message: string, _meta?: any) { /* Mock implementation */ }
  verbose(_message: string, _meta?: any) { /* Mock implementation */ }
}

// Mock Neo4j Driver and Session
class MockSession {
  private _isOpen: boolean = true;
  
  async close() {
    this._isOpen = false;
  }
  
  get isOpen() {
    return this._isOpen;
  }
  
  async run(_query: string) {
    if (!this._isOpen) {
      throw new Error('Session is closed');
    }
    return { records: [] };
  }
}

class MockDriver {
  session(_options?: any) {
    return new MockSession() as unknown as Session;
  }
}

describe('SessionPool', () => {
  let mockDriver: Driver;
  let sessionPool: SessionPool;
  
  beforeEach(() => {
    mockDriver = new MockDriver() as unknown as Driver;
    sessionPool = new SessionPool(mockDriver, 5, 1000, new MockLoggerService());
  });
  
  afterEach(async () => {
    await sessionPool.close();
  });
  
  describe('getSession', () => {
    it('should create a new session when pool is empty', async () => {
      const session = await sessionPool.getSession('READ');
      expect(session).toBeDefined();
      // Release session back to pool
      await sessionPool.releaseSession(session);
    });
    
    it('should reuse available sessions', async () => {
      const session1 = await sessionPool.getSession('READ');
      await sessionPool.releaseSession(session1);
      
      const session2 = await sessionPool.getSession('READ');
      expect(session2).toBe(session1);
      await sessionPool.releaseSession(session2);
    });
    
    it('should create new session when pool is full but not at max size', async () => {
      const sessions = [];
      // Create 3 sessions (less than max size of 5)
      for (let i = 0; i < 3; i++) {
        const session = await sessionPool.getSession('WRITE');
        sessions.push(session);
      }
      
      // Release all sessions
      for (const session of sessions) {
        await sessionPool.releaseSession(session);
      }
      
      // Get a session again - should be one of the existing ones
      const session = await sessionPool.getSession('WRITE');
      expect(sessions).toContain(session);
      await sessionPool.releaseSession(session);
    });
  });
  
  describe('releaseSession', () => {
    it('should add healthy session back to available pool', async () => {
      const session = await sessionPool.getSession('WRITE');
      await sessionPool.releaseSession(session);
      
      const session2 = await sessionPool.getSession('WRITE');
      expect(session2).toBe(session);
      await sessionPool.releaseSession(session2);
    });
    
    it('should close unhealthy session', async () => {
      const session = await sessionPool.getSession('WRITE');
      // Close the session manually to make it unhealthy
      await session.close();
      
      await sessionPool.releaseSession(session);
      
      // Should create a new session since the previous one was unhealthy
      const session2 = await sessionPool.getSession('WRITE');
      expect(session2).not.toBe(session);
      await sessionPool.releaseSession(session2);
    });
  });
  
  describe('getMetrics', () => {
    it('should return correct metrics', async () => {
      const metrics1 = sessionPool.getMetrics();
      expect(metrics1.totalSessionsCreated).toBe(0);
      expect(metrics1.activeSessions).toBe(0);
      
      const session = await sessionPool.getSession('WRITE');
      const metrics2 = sessionPool.getMetrics();
      expect(metrics2.totalSessionsCreated).toBe(1);
      expect(metrics2.activeSessions).toBe(1);
      
      await sessionPool.releaseSession(session);
      const metrics3 = sessionPool.getMetrics();
      expect(metrics3.activeSessions).toBe(0);
    });
  });
  
  describe('getReadSession and getWriteSession', () => {
    it('should provide read session', async () => {
      const session = await sessionPool.getReadSession();
      expect(session).toBeDefined();
      await sessionPool.releaseSession(session);
    });
    
    it('should provide write session', async () => {
      const session = await sessionPool.getWriteSession();
      expect(session).toBeDefined();
      await sessionPool.releaseSession(session);
    });
  });
});

describe('SessionMonitor', () => {
  let monitor: SessionMonitor;
  
  beforeEach(() => {
    monitor = new SessionMonitor();
  });
  
  it('should record session creation', () => {
    monitor.recordSessionCreated();
    const metrics = monitor.getMetrics();
    expect(metrics.totalSessionsCreated).toBe(1);
    expect(metrics.activeSessions).toBe(1);
  });
  
  it('should record session closure', () => {
    monitor.recordSessionCreated();
    monitor.recordSessionClosed(100);
    const metrics = monitor.getMetrics();
    expect(metrics.totalSessionsClosed).toBe(1);
    expect(metrics.activeSessions).toBe(0);
    expect(metrics.avgSessionDuration).toBe(100);
  });
  
  it('should calculate average session duration correctly', () => {
    monitor.recordSessionCreated();
    monitor.recordSessionClosed(100);
    
    monitor.recordSessionCreated();
    monitor.recordSessionClosed(200);
    
    const metrics = monitor.getMetrics();
    expect(metrics.avgSessionDuration).toBe(150);
  });
  
  it('should record session timeouts', () => {
    monitor.recordSessionTimeout();
    const metrics = monitor.getMetrics();
    expect(metrics.sessionTimeouts).toBe(1);
  });
});