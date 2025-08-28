import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { Neo4jConnectionManager } from './neo4j/Neo4jConnectionManager';

@injectable()
export class Neo4jService {
  private neo4jConnection: Neo4jConnectionManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(Neo4jConnectionManager) neo4jConnection: Neo4jConnectionManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.neo4jConnection = neo4jConnection;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.neo4jConnection.connect();
      if (connected) {
        this.logger.info('Neo4j service initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize Neo4j service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'Neo4jService', operation: 'initialize' }
      );
      return false;
    }
  }

  async executeQuery(cypher: string, parameters?: Record<string, any>): Promise<any> {
    return this.neo4jConnection.executeQuery({ cypher, parameters });
  }

  async executeTransaction(queries: Array<{ cypher: string; parameters?: Record<string, any> }>): Promise<any[]> {
    return this.neo4jConnection.executeTransaction(queries.map(q => ({ cypher: q.cypher, parameters: q.parameters })));
  }

  async createNode(node: any): Promise<string> {
    return this.neo4jConnection.createNode(node);
  }

  async createRelationship(relationship: any): Promise<string> {
    return this.neo4jConnection.createRelationship(relationship);
  }

  async findNodes(label: string, properties?: Record<string, any>): Promise<any[]> {
    return this.neo4jConnection.findNodesByLabel(label, properties);
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    return this.neo4jConnection.findRelationships(type, properties);
  }

  async getDatabaseStats(): Promise<any> {
    return this.neo4jConnection.getDatabaseStats();
  }

  isConnected(): boolean {
    return this.neo4jConnection.isConnectedToDatabase();
  }

  async close(): Promise<void> {
    await this.neo4jConnection.close();
  }
}