import { Container } from 'inversify';
import { MCPServer } from './MCPServer';
import { SearchCoordinator } from '../services/search/SearchCoordinator';
import { IndexCoordinator } from '../services/indexing/IndexCoordinator';
import { GraphService } from '../services/graph/GraphService';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { LoggerService } from '../core/LoggerService';
import { ConfigService } from '../config/ConfigService';
import { TYPES } from '../core/DIContainer';

describe('MCPServer', () => {
  let container: Container;
  let mcpServer: MCPServer;
  let mockSearchCoordinator: jest.Mocked<SearchCoordinator>;
  let mockIndexCoordinator: jest.Mocked<IndexCoordinator>;
  let mockGraphService: jest.Mocked<GraphService>;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();

    // Create mocks
    mockSearchCoordinator = {
      search: jest.fn(),
      searchWithFilters: jest.fn(),
      searchSimilarCode: jest.fn(),
      searchByContext: jest.fn(),
      getSearchSuggestions: jest.fn(),
    } as any;

    mockIndexCoordinator = {
      indexDirectory: jest.fn(),
      indexFile: jest.fn(),
      updateIndex: jest.fn(),
      deleteFromIndex: jest.fn(),
      rebuildIndex: jest.fn(),
      getIndexingStats: jest.fn(),
      validateIndex: jest.fn(),
    } as any;

    mockGraphService = {
      analyzeCodeStructure: jest.fn(),
      findDependencies: jest.fn(),
      findDependents: jest.fn(),
      getCallChain: jest.fn(),
      analyzeImpact: jest.fn(),
      findCircularDependencies: jest.fn(),
      getComplexityMetrics: jest.fn(),
    } as any;

    mockHealthCheckService = {
      checkOverallHealth: jest.fn(),
      checkQdrantHealth: jest.fn(),
      checkNebulaHealth: jest.fn(),
      performDeepHealthCheck: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
      getMCPConfig: jest.fn().mockReturnValue({
        serverName: 'codebase-index-mcp',
        version: '1.0.0',
        capabilities: ['search', 'index', 'graph', 'monitoring'],
        maxRequestSize: '10MB',
        timeout: 30000,
      }),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.SearchCoordinator).toConstantValue(mockSearchCoordinator);
    container.bind(TYPES.IndexCoordinator).toConstantValue(mockIndexCoordinator);
    container.bind(TYPES.GraphService).toConstantValue(mockGraphService);
    container.bind(TYPES.HealthCheckService).toConstantValue(mockHealthCheckService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.MCPServer).to(MCPServer);

    mcpServer = container.get<MCPServer>(TYPES.MCPServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should initialize MCP server with capabilities', async () => {
      await mcpServer.initialize();

      expect(mockLoggerService.info).toHaveBeenCalledWith('MCP Server initialized', {
        serverName: 'codebase-index-mcp',
        version: '1.0.0',
        capabilities: ['search', 'index', 'graph', 'monitoring'],
      });
    });

    it('should register all available tools', async () => {
      await mcpServer.initialize();

      const tools = mcpServer.getAvailableTools();

      expect(tools).toContain('search_code');
      expect(tools).toContain('index_directory');
      expect(tools).toContain('analyze_dependencies');
      expect(tools).toContain('check_health');
    });
  });

  describe('Search Tools', () => {
    it('should handle search_code tool requests', async () => {
      const searchRequest = {
        tool: 'search_code',
        arguments: {
          query: 'authentication function',
          maxResults: 10,
          includeContext: true,
        },
      };

      const searchResults = {
        results: [
          {
            id: '1',
            score: 0.95,
            content: 'function authenticate(user, password) { return bcrypt.compare(password, user.hash); }',
            metadata: { filePath: '/src/auth.ts', language: 'typescript' },
          },
        ],
        totalCount: 1,
        searchTime: 45,
      };

      mockSearchCoordinator.search.mockResolvedValue(searchResults);

      const response = await mcpServer.handleToolRequest(searchRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(searchResults);
      expect(mockSearchCoordinator.search).toHaveBeenCalledWith(
        'authentication function',
        { maxResults: 10, includeContext: true }
      );
    });

    it('should handle search_similar_code tool requests', async () => {
      const searchRequest = {
        tool: 'search_similar_code',
        arguments: {
          codeSnippet: 'function login(user, pass) { return auth.verify(user, pass); }',
          maxResults: 5,
        },
      };

      const similarResults = {
        results: [
          {
            id: '2',
            score: 0.88,
            content: 'function authenticate(username, password) { return bcrypt.compare(password, user.hash); }',
            metadata: { filePath: '/src/auth.ts', similarity: 0.88 },
          },
        ],
        totalCount: 1,
        searchTime: 32,
      };

      mockSearchCoordinator.searchSimilarCode.mockResolvedValue(similarResults);

      const response = await mcpServer.handleToolRequest(searchRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(similarResults);
    });

    it('should provide search suggestions', async () => {
      const suggestionRequest = {
        tool: 'get_search_suggestions',
        arguments: {
          partialQuery: 'auth',
        },
      };

      const suggestions = ['authentication', 'authorization', 'authenticate user'];

      mockSearchCoordinator.getSearchSuggestions.mockResolvedValue(suggestions);

      const response = await mcpServer.handleToolRequest(suggestionRequest);

      expect(response.success).toBe(true);
      expect(response.data.suggestions).toEqual(suggestions);
    });
  });

  describe('Indexing Tools', () => {
    it('should handle index_directory tool requests', async () => {
      const indexRequest = {
        tool: 'index_directory',
        arguments: {
          directoryPath: '/src/project',
          recursive: true,
        },
      };

      const indexResult = {
        totalFiles: 50,
        successCount: 48,
        errorCount: 2,
        indexingTime: 5000,
        entitiesIndexed: 250,
      };

      mockIndexCoordinator.indexDirectory.mockResolvedValue(indexResult);

      const response = await mcpServer.handleToolRequest(indexRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(indexResult);
      expect(mockIndexCoordinator.indexDirectory).toHaveBeenCalledWith('/src/project', { recursive: true });
    });

    it('should handle index_file tool requests', async () => {
      const indexRequest = {
        tool: 'index_file',
        arguments: {
          filePath: '/src/auth.ts',
        },
      };

      const indexResult = {
        success: true,
        filePath: '/src/auth.ts',
        entitiesIndexed: 5,
        indexingTime: 200,
      };

      mockIndexCoordinator.indexFile.mockResolvedValue(indexResult);

      const response = await mcpServer.handleToolRequest(indexRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(indexResult);
    });

    it('should handle get_indexing_stats tool requests', async () => {
      const statsRequest = {
        tool: 'get_indexing_stats',
        arguments: {},
      };

      const stats = {
        totalFilesIndexed: 150,
        totalEntitiesIndexed: 800,
        indexingErrors: 5,
        lastIndexingTime: new Date().toISOString(),
        averageIndexingTime: 150,
      };

      mockIndexCoordinator.getIndexingStats.mockResolvedValue(stats);

      const response = await mcpServer.handleToolRequest(statsRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(stats);
    });
  });

  describe('Graph Analysis Tools', () => {
    it('should handle analyze_dependencies tool requests', async () => {
      const analysisRequest = {
        tool: 'analyze_dependencies',
        arguments: {
          entityId: 'func_authenticate',
        },
      };

      const dependencies = [
        {
          name: 'validateUser',
          dependencyType: 'CALLS',
          filePath: '/src/validation.ts',
        },
        {
          name: 'User',
          dependencyType: 'USES',
          filePath: '/src/models/User.ts',
        },
      ];

      mockGraphService.findDependencies.mockResolvedValue(dependencies);

      const response = await mcpServer.handleToolRequest(analysisRequest);

      expect(response.success).toBe(true);
      expect(response.data.dependencies).toEqual(dependencies);
    });

    it('should handle analyze_impact tool requests', async () => {
      const impactRequest = {
        tool: 'analyze_impact',
        arguments: {
          entityId: 'func_authenticate',
        },
      };

      const impactAnalysis = {
        targetEntity: 'func_authenticate',
        directImpact: [
          { name: 'login', filePath: '/src/auth.ts' },
          { name: 'middleware', filePath: '/src/middleware.ts' },
        ],
        riskLevel: 'high',
        affectedFiles: ['/src/auth.ts', '/src/middleware.ts'],
        impactScore: 8.5,
      };

      mockGraphService.analyzeImpact.mockResolvedValue(impactAnalysis);

      const response = await mcpServer.handleToolRequest(impactRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(impactAnalysis);
    });

    it('should handle get_call_chain tool requests', async () => {
      const callChainRequest = {
        tool: 'get_call_chain',
        arguments: {
          fromFunction: 'func_main',
          toFunction: 'func_helper',
        },
      };

      const callChain = {
        path: [
          { id: 'func_main', name: 'main' },
          { id: 'func_process', name: 'process' },
          { id: 'func_helper', name: 'helper' },
        ],
        depth: 2,
        connected: true,
      };

      mockGraphService.getCallChain.mockResolvedValue(callChain);

      const response = await mcpServer.handleToolRequest(callChainRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(callChain);
    });
  });

  describe('Monitoring Tools', () => {
    it('should handle check_health tool requests', async () => {
      const healthRequest = {
        tool: 'check_health',
        arguments: {},
      };

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          qdrant: { status: 'healthy', responseTime: 25 },
          nebula: { status: 'healthy', responseTime: 30 },
        },
      };

      mockHealthCheckService.checkOverallHealth.mockResolvedValue(healthStatus);

      const response = await mcpServer.handleToolRequest(healthRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(healthStatus);
    });

    it('should handle deep_health_check tool requests', async () => {
      const deepHealthRequest = {
        tool: 'deep_health_check',
        arguments: {},
      };

      const deepHealth = {
        overall: { status: 'healthy' },
        services: {
          qdrant: { status: 'healthy', details: { vectorCount: 1000 } },
          nebula: { status: 'healthy', details: { nodeCount: 500 } },
        },
        consistency: { status: 'consistent', discrepancy: 0 },
        performance: { avgResponseTime: 45, throughput: 100 },
        recommendations: [],
      };

      mockHealthCheckService.performDeepHealthCheck.mockResolvedValue(deepHealth);

      const response = await mcpServer.handleToolRequest(deepHealthRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(deepHealth);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool requests', async () => {
      const unknownRequest = {
        tool: 'unknown_tool',
        arguments: {},
      };

      const response = await mcpServer.handleToolRequest(unknownRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown tool');
    });

    it('should handle tool execution errors', async () => {
      const searchRequest = {
        tool: 'search_code',
        arguments: {
          query: 'test query',
        },
      };

      mockSearchCoordinator.search.mockRejectedValue(new Error('Search service unavailable'));

      const response = await mcpServer.handleToolRequest(searchRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Search service unavailable');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should validate tool arguments', async () => {
      const invalidRequest = {
        tool: 'search_code',
        arguments: {
          // Missing required query parameter
          maxResults: 10,
        },
      };

      const response = await mcpServer.handleToolRequest(invalidRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Missing required argument');
    });
  });

  describe('Resource Management', () => {
    it('should list available resources', async () => {
      const resources = mcpServer.getAvailableResources();

      expect(resources).toContain('codebase://search');
      expect(resources).toContain('codebase://index');
      expect(resources).toContain('codebase://graph');
      expect(resources).toContain('codebase://health');
    });

    it('should handle resource read requests', async () => {
      const resourceRequest = {
        uri: 'codebase://search?query=authentication',
      };

      const searchResults = {
        results: [
          { id: '1', content: 'auth function', score: 0.9 },
        ],
        totalCount: 1,
      };

      mockSearchCoordinator.search.mockResolvedValue(searchResults);

      const response = await mcpServer.handleResourceRead(resourceRequest);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(searchResults);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start MCP server', async () => {
      await mcpServer.start();

      expect(mockLoggerService.info).toHaveBeenCalledWith('MCP Server started');
    });

    it('should stop MCP server gracefully', async () => {
      await mcpServer.start();
      await mcpServer.stop();

      expect(mockLoggerService.info).toHaveBeenCalledWith('MCP Server stopped');
    });

    it('should handle shutdown signals', async () => {
      await mcpServer.start();

      // Simulate shutdown signal
      process.emit('SIGTERM');

      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLoggerService.info).toHaveBeenCalledWith('Received shutdown signal, stopping MCP server');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track tool execution metrics', async () => {
      const searchRequest = {
        tool: 'search_code',
        arguments: {
          query: 'test query',
        },
      };

      mockSearchCoordinator.search.mockResolvedValue({
        results: [],
        totalCount: 0,
        searchTime: 50,
      });

      await mcpServer.handleToolRequest(searchRequest);

      const metrics = mcpServer.getPerformanceMetrics();

      expect(metrics.toolExecutions.search_code).toBeDefined();
      expect(metrics.toolExecutions.search_code.count).toBe(1);
      expect(metrics.toolExecutions.search_code.avgExecutionTime).toBeGreaterThan(0);
    });
  });
});