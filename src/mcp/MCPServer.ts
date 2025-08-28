import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerConfig } from '@modelcontextprotocol/sdk/server/index.js';
import { DIContainer, TYPES } from '../core/DIContainer';
import { LoggerService } from '../core/LoggerService';
import { IndexService } from '../services/index/IndexService';
import { GraphService } from '../services/graph/GraphService';

export class MCPServer {
  private server: Server;
  private logger: LoggerService;
  private indexService: IndexService;
  private graphService: GraphService;

  constructor() {
    const container = DIContainer.getInstance();
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.indexService = container.get<IndexService>(TYPES.IndexService);
    this.graphService = container.get<GraphService>(TYPES.GraphService);

    const config: ServerConfig = {
      name: 'codebase-index-mcp',
      version: '1.0.0',
      description: 'Intelligent codebase indexing and analysis service',
      capabilities: {
        tools: {
          'codebase.index.create': {
            description: 'Create a new codebase index',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory'
                },
                options: {
                  type: 'object',
                  properties: {
                    recursive: { type: 'boolean', default: true },
                    includePatterns: { type: 'array', items: { type: 'string' } },
                    excludePatterns: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              required: ['projectPath']
            }
          },
          'codebase.index.search': {
            description: 'Search the codebase index',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                options: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number', default: 10 },
                    threshold: { type: 'number', default: 0.7 },
                    includeGraph: { type: 'boolean', default: false }
                  }
                }
              },
              required: ['query']
            }
          },
          'codebase.graph.analyze': {
            description: 'Analyze codebase structure and relationships',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory'
                },
                options: {
                  type: 'object',
                  properties: {
                    depth: { type: 'number', default: 3 },
                    focus: { type: 'string', enum: ['dependencies', 'imports', 'classes', 'functions'] }
                  }
                }
              },
              required: ['projectPath']
            }
          },
          'codebase.status.get': {
            description: 'Get current indexing status',
            inputSchema: {
              type: 'object',
              properties: {
                projectPath: {
                  type: 'string',
                  description: 'Path to the project directory'
                }
              }
            }
          }
        }
      }
    };

    this.server = new Server(config);
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'codebase.index.create':
            return await this.handleCreateIndex(args);
          case 'codebase.index.search':
            return await this.handleSearch(args);
          case 'codebase.graph.analyze':
            return await this.handleGraphAnalyze(args);
          case 'codebase.status.get':
            return await this.handleGetStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, error);
        throw error;
      }
    });
  }

  private async handleCreateIndex(args: any): Promise<any> {
    const { projectPath, options = {} } = args;
    
    this.logger.info(`Creating index for project: ${projectPath}`);
    
    await this.indexService.createIndex(projectPath, options);
    
    return {
      success: true,
      message: `Index created successfully for ${projectPath}`,
      timestamp: new Date().toISOString()
    };
  }

  private async handleSearch(args: any): Promise<any> {
    const { query, options = {} } = args;
    
    this.logger.info(`Searching for: ${query}`);
    
    const results = await this.indexService.search(query, options);
    
    return {
      results,
      total: results.length,
      query,
      timestamp: new Date().toISOString()
    };
  }

  private async handleGraphAnalyze(args: any): Promise<any> {
    const { projectPath, options = {} } = args;
    
    this.logger.info(`Analyzing graph for project: ${projectPath}`);
    
    const analysis = await this.graphService.analyzeCodebase(projectPath, options);
    
    return {
      success: true,
      nodes: analysis.nodes,
      relationships: analysis.relationships,
      metrics: analysis.metrics,
      timestamp: new Date().toISOString()
    };
  }

  private async handleGetStatus(args: any): Promise<any> {
    const { projectPath } = args;
    
    const status = await this.indexService.getStatus(projectPath);
    
    return {
      status,
      timestamp: new Date().toISOString()
    };
  }

  async start(): Promise<void> {
    try {
      await this.server.start();
      this.logger.info('MCP Server started successfully');
    } catch (error) {
      this.logger.error('Failed to start MCP Server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.stop();
      this.logger.info('MCP Server stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop MCP Server', error);
      throw error;
    }
  }
}