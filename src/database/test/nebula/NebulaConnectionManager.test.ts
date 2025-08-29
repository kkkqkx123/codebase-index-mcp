import { NebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
// import { NebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';

// Mock the Nebula client
jest.mock('@nebula-contrib/nebula-nodejs', () => ({
  createClient: jest.fn(),
}));

// Mock dependencies
jest.mock('../../../../src/core/LoggerService');
jest.mock('../../../../src/core/ErrorHandlerService');
jest.mock('../../../../src/config/ConfigService');
jest.mock('../../../../src/database/nebula/NebulaQueryBuilder', () => {
  return {
    NebulaQueryBuilder: jest.fn().mockImplementation(() => {
      return {
        insertVertex: jest.fn(),
        insertEdge: jest.fn(),
        match: jest.fn(),
        go: jest.fn(),
        parameterize: jest.fn(),
      };
    }),
  };
});

describe('NebulaConnectionManager', () => {
  let nebulaConnectionManager: NebulaConnectionManager;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockConfigService = {
      getAll: jest.fn().mockReturnValue({
        nebula: {
          host: 'localhost',
          port: 9669,
          username: 'root',
          password: 'nebula',
          space: 'test_space',
        },
      }),
    } as any;

    // Create mock client
    mockClient = {
      on: jest.fn((event, callback) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 1);
        }
        return mockClient;
      }),
      execute: jest.fn(),
      close: jest.fn(),
    };

    // Mock createClient
    const { createClient } = require('@nebula-contrib/nebula-nodejs');
    (createClient as jest.Mock).mockReturnValue(mockClient);

    // Create NebulaConnectionManager instance
    nebulaConnectionManager = new NebulaConnectionManager(
      mockLoggerService,
      mockErrorHandlerService,
      mockConfigService
    );

    // Get the mock query builder instance
    // const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
    // const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;
  });

  describe('connect', () => {
    it('should connect to NebulaGraph successfully', async () => {
      const result = await nebulaConnectionManager.connect();

      expect(result).toBe(true);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Connected to NebulaGraph successfully');
      expect(mockClient.on).toHaveBeenCalledTimes(2); // ready and error events
    });

    it('should handle connection timeout', async () => {
      // Override the mock client to simulate timeout
      mockClient.on = jest.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection timeout')), 1);
        }
        return mockClient;
      });

      const result = await nebulaConnectionManager.connect();

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      // Override the mock client to simulate connection error
      mockClient.on = jest.fn((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 1);
        }
        return mockClient;
      });

      const result = await nebulaConnectionManager.connect();

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from NebulaGraph', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      // Then disconnect
      await nebulaConnectionManager.disconnect();

      expect(mockLoggerService.info).toHaveBeenCalledWith('Disconnected from NebulaGraph successfully');
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(false);
    });
  });

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      const query = 'MATCH (n) RETURN n LIMIT 1';
      const mockResult = { data: [{ id: 1, name: 'test' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.executeQuery(query);

      expect(result).toEqual(mockResult);
      expect(mockClient.execute).toHaveBeenCalledWith(query, false, undefined);
    });

    it('should throw error when not connected', async () => {
      const query = 'MATCH (n) RETURN n LIMIT 1';

      await expect(nebulaConnectionManager.executeQuery(query))
        .rejects.toThrow('Not connected to NebulaGraph');
    });

    it('should handle query execution error', async () => {
      // First connect
      await nebulaConnectionManager.connect();

      const query = 'INVALID QUERY';
      const error = new Error('Syntax error');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.executeQuery(query))
        .rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('isConnectedToDatabase', () => {
    it('should return false when not connected', () => {
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(false);
    });

    it('should return true when connected', async () => {
      await nebulaConnectionManager.connect();
      expect(nebulaConnectionManager.isConnectedToDatabase()).toBe(true);
    });
  });

  describe('getReadSession', () => {
    it('should return client when connected', async () => {
      await nebulaConnectionManager.connect();
      const session = await nebulaConnectionManager.getReadSession();
      expect(session).toBe(mockClient);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getReadSession())
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('getWriteSession', () => {
    it('should return client when connected', async () => {
      await nebulaConnectionManager.connect();
      const session = await nebulaConnectionManager.getWriteSession();
      expect(session).toBe(mockClient);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getWriteSession())
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      await nebulaConnectionManager.connect();

      const queries = [
        { query: 'INSERT VERTEX person(name) VALUES 1:("Alice")' },
        { query: 'INSERT VERTEX person(name) VALUES 2:("Bob")' },
      ];

      const mockResults = [{}, {}];
      mockClient.execute.mockResolvedValueOnce(mockResults[0]);
      mockClient.execute.mockResolvedValueOnce(mockResults[1]);

      const results = await nebulaConnectionManager.executeTransaction(queries);

      expect(results).toEqual(mockResults);
      expect(mockClient.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw error when not connected', async () => {
      const queries = [{ query: 'INSERT VERTEX person(name) VALUES 1:("Alice")' }];

      await expect(nebulaConnectionManager.executeTransaction(queries))
        .rejects.toThrow('Not connected to NebulaGraph');
    });

    it('should handle transaction execution error', async () => {
      await nebulaConnectionManager.connect();

      const queries = [{ query: 'INVALID QUERY' }];
      const error = new Error('Syntax error');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.executeTransaction(queries))
        .rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('createNode', () => {
    it('should create node successfully', async () => {
      await nebulaConnectionManager.connect();

      const node = {
        label: 'person',
        id: '1',
        properties: { name: 'Alice', age: 30 },
      };

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.insertVertex.mockReturnValue({
        query: 'INSERT VERTEX person(name, age) VALUES 1:($param0, $param1)',
        params: { param0: 'Alice', param1: 30 },
      });

      mockClient.execute.mockResolvedValue({});

      const result = await nebulaConnectionManager.createNode(node);

      expect(result).toBe('1');
      expect(mockQueryBuilderInstance.insertVertex).toHaveBeenCalledWith(
        'person',
        '1',
        { name: 'Alice', age: 30 }
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'INSERT VERTEX person(name, age) VALUES 1:($param0, $param1)',
        false,
        { param0: 'Alice', param1: 30 }
      );
    });

    it('should throw error when not connected', async () => {
      const node = {
        label: 'person',
        id: '1',
        properties: { name: 'Alice' },
      };

      await expect(nebulaConnectionManager.createNode(node))
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('createRelationship', () => {
    it('should create relationship successfully', async () => {
      await nebulaConnectionManager.connect();

      const relationship = {
        type: 'knows',
        srcId: '1',
        dstId: '2',
        properties: { since: 2020 },
      };

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.insertEdge.mockReturnValue({
        query: 'INSERT EDGE knows(since) VALUES 1->2:($param0)',
        params: { param0: 2020 },
      });

      mockClient.execute.mockResolvedValue({});

      const result = await nebulaConnectionManager.createRelationship(relationship);

      expect(result).toBe('1->2');
      expect(mockQueryBuilderInstance.insertEdge).toHaveBeenCalledWith(
        'knows',
        '1',
        '2',
        { since: 2020 }
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'INSERT EDGE knows(since) VALUES 1->2:($param0)',
        false,
        { param0: 2020 }
      );
    });

    it('should throw error when not connected', async () => {
      const relationship = {
        type: 'knows',
        srcId: '1',
        dstId: '2',
        properties: {},
      };

      await expect(nebulaConnectionManager.createRelationship(relationship))
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('findNodesByLabel', () => {
    it('should find nodes by label successfully', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n:person) RETURN n');

      const mockResult = { data: [{ id: 1, name: 'Alice' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findNodesByLabel('person');

      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith('(n:person)', 'n', undefined);
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n:person) RETURN n',
        false,
        undefined
      );
    });

    it('should find nodes by label with properties', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n:person) WHERE n.name = $name RETURN n');

      const mockResult = { data: [{ id: 1, name: 'Alice' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findNodesByLabel('person', { name: 'Alice' });

      expect(result).toEqual([{ id: 1, name: 'Alice' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n:person)',
        'n',
        'n.name = $name'
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n:person) WHERE n.name = $name RETURN n',
        false,
        { name: 'Alice' }
      );
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.findNodesByLabel('person'))
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('findRelationships', () => {
    it('should find relationships successfully', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n1)-[r]->(n2) RETURN r, n1, n2');

      const mockResult = { data: [{ src: 1, dst: 2, type: 'knows' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findRelationships();

      expect(result).toEqual([{ src: 1, dst: 2, type: 'knows' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n1)-[r]->(n2)',
        'r, n1, n2',
        undefined
      );
      expect(mockClient.execute).toHaveBeenCalledWith(
        'MATCH (n1)-[r]->(n2) RETURN r, n1, n2',
        false,
        undefined
      );
    });

    it('should find relationships with type filter', async () => {
      await nebulaConnectionManager.connect();

      // Get the mock query builder instance
      const NebulaQueryBuilder = require('../../nebula/NebulaQueryBuilder').NebulaQueryBuilder;
      const mockQueryBuilderInstance = (NebulaQueryBuilder as jest.Mock).mock.results[0].value;

      mockQueryBuilderInstance.match.mockReturnValue('MATCH (n1)-[r:knows]->(n2) RETURN r, n1, n2');

      const mockResult = { data: [{ src: 1, dst: 2, type: 'knows' }] };
      mockClient.execute.mockResolvedValue(mockResult);

      const result = await nebulaConnectionManager.findRelationships('knows');

      expect(result).toEqual([{ src: 1, dst: 2, type: 'knows' }]);
      expect(mockQueryBuilderInstance.match).toHaveBeenCalledWith(
        '(n1)-[r:knows]->(n2)',
        'r, n1, n2',
        undefined
      );
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.findRelationships())
        .rejects.toThrow('Not connected to NebulaGraph');
    });
  });

  describe('getDatabaseStats', () => {
    it('should get database stats successfully', async () => {
      await nebulaConnectionManager.connect();

      const mockSpacesResult = { data: [{ name: 'test_space' }] };
      const mockHostsResult = { data: [{ host: 'localhost', port: 9669 }] };
      const mockPartsResult = { data: [{ part_id: 1, leader: 'localhost:9669' }] };

      mockClient.execute
        .mockResolvedValueOnce(mockSpacesResult)
        .mockResolvedValueOnce(mockHostsResult)
        .mockResolvedValueOnce(mockPartsResult);

      const result = await nebulaConnectionManager.getDatabaseStats();

      expect(result).toEqual({
        spaces: [{ name: 'test_space' }],
        hosts: [{ host: 'localhost', port: 9669 }],
        parts: [{ part_id: 1, leader: 'localhost:9669' }],
      });

      expect(mockClient.execute).toHaveBeenCalledTimes(3);
      expect(mockClient.execute).toHaveBeenNthCalledWith(1, 'SHOW SPACES', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(2, 'SHOW HOSTS', false);
      expect(mockClient.execute).toHaveBeenNthCalledWith(3, 'SHOW PARTS', false);
    });

    it('should throw error when not connected', async () => {
      await expect(nebulaConnectionManager.getDatabaseStats())
        .rejects.toThrow('Not connected to NebulaGraph');
    });

    it('should handle stats retrieval error', async () => {
      await nebulaConnectionManager.connect();

      const error = new Error('Stats retrieval failed');
      mockClient.execute.mockRejectedValue(error);

      await expect(nebulaConnectionManager.getDatabaseStats())
        .rejects.toThrow(error);

      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });
});