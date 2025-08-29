import { NebulaConnectionManager } from '../../src/database/nebula/NebulaConnectionManager';
import { LoggerService } from '../../src/core/LoggerService';
import { ErrorHandlerService } from '../../src/core/ErrorHandlerService';
import { ConfigService } from '../../src/config/ConfigService';

// Mock services
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockErrorHandler = {
  handleError: jest.fn()
};

const mockConfigService = {
  getAll: jest.fn().mockReturnValue({
    nebula: {
      host: 'localhost',
      port: 9669,
      username: 'root',
      password: 'nebula',
      space: 'test_space'
    }
  })
};

// Mock Nebula client
const mockClient = {
  on: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  execute: jest.fn(),
  close: jest.fn()
};

// Mock createClient function
jest.mock('@nebula-contrib/nebula-nodejs', () => ({
  createClient: jest.fn(() => mockClient)
}));

describe('NebulaConnectionManager', () => {
  let connectionManager: NebulaConnectionManager;
  
  beforeEach(() => {
    connectionManager = new NebulaConnectionManager(
      mockLogger as unknown as LoggerService,
      mockErrorHandler as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService
    );
  });
  
  afterEach(async () => {
    jest.clearAllMocks();
    // 确保连接管理器断开连接
    if (connectionManager && connectionManager.isConnectedToDatabase()) {
      await connectionManager.disconnect();
    }
  });
  
  describe('connect', () => {
    it('should connect successfully', async () => {
      // Setup mock client to emit 'ready' event
      mockClient.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
        return mockClient;
      });
      
      const result = await connectionManager.connect();
      
      expect(result).toBe(true);
      expect(connectionManager.isConnectedToDatabase()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Connected to NebulaGraph successfully');
    });
    
    it('should handle connection error', async () => {
      // Setup mock client to emit 'error' event
      mockClient.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('Connection failed')), 10);
        }
        return mockClient;
      });
      
      const result = await connectionManager.connect();
      
      expect(result).toBe(false);
      expect(connectionManager.isConnectedToDatabase()).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
    
    it('should handle connection timeout', async () => {
      // Setup mock client to not emit any events
      mockClient.on.mockReturnThis();
      
      const result = await connectionManager.connect();
      
      expect(result).toBe(false);
      expect(connectionManager.isConnectedToDatabase()).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    }, 15000);
  });
  
  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      // First connect
      mockClient.on.mockImplementation((event, handler) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
        return mockClient;
      });
      
      await connectionManager.connect();
      
      // Then disconnect
      await connectionManager.disconnect();
      
      expect(mockClient.close).toHaveBeenCalled();
      expect(connectionManager.isConnectedToDatabase()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from NebulaGraph successfully');
    });
  });
});