import { Driver, Session, auth, driver as neo4jDriver } from 'neo4j-driver';
import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
  maxConnectionPoolSize: number;
  connectionTimeout: number;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

export interface GraphQuery {
  cypher: string;
  parameters?: Record<string, any>;
}

export interface GraphQueryResult {
  records: any[];
  summary: {
    query: string;
    parameters: Record<string, any>;
    resultAvailableAfter: number;
    resultConsumedAfter: number;
  };
}

@injectable()
export class Neo4jConnectionManager {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private isConnected: boolean = false;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    
    const neo4jConfig = configService.get('neo4j');
    this.config = {
      uri: neo4jConfig.uri,
      username: neo4jConfig.username,
      password: neo4jConfig.password,
      database: neo4jConfig.database,
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000
    };
  }

  async connect(): Promise<boolean> {
    try {
      this.driver = neo4jDriver(
        this.config.uri,
        auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionTimeout: this.config.connectionTimeout,
          disableLosslessIntegers: true
        }
      );

      await this.verifyConnection();
      this.isConnected = true;
      
      this.logger.info('Connected to Neo4j successfully', {
        uri: this.config.uri,
        database: this.config.database
      });

      await this.initializeSchema();
      return true;
    } catch (error) {
      this.isConnected = false;
      this.driver = null;
      
      const report = this.errorHandler.handleError(
        new Error(`Failed to connect to Neo4j: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'Neo4jConnection', operation: 'connect' }
      );
      this.logger.error('Failed to connect to Neo4j', { errorId: report.id });
      return false;
    }
  }

  private async verifyConnection(): Promise<void> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    const session = this.driver.session({
      database: this.config.database,
      defaultAccessMode: 'READ'
    });

    try {
      await session.run('RETURN 1 as test');
    } finally {
      await session.close();
    }
  }

  private async initializeSchema(): Promise<void> {
    const constraints = [
      'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT import_id_unique IF NOT EXISTS FOR (i:Import) REQUIRE i.id IS UNIQUE'
    ];

    const indexes = [
      'CREATE INDEX file_path_index IF NOT EXISTS FOR (f:File) ON (f.path)',
      'CREATE INDEX function_name_index IF NOT EXISTS FOR (f:Function) ON (f.name)',
      'CREATE INDEX class_name_index IF NOT EXISTS FOR (c:Class) ON (c.name)',
      'CREATE INDEX project_name_index IF NOT EXISTS FOR (p:Project) ON (p.name)',
      'CREATE INDEX import_module_index IF NOT EXISTS FOR (i:Import) ON (i.module)'
    ];

    for (const constraint of constraints) {
      await this.executeQuery({ cypher: constraint });
    }

    for (const index of indexes) {
      await this.executeQuery({ cypher: index });
    }

    this.logger.info('Neo4j schema initialized with constraints and indexes');
  }

  async executeQuery(query: GraphQuery): Promise<GraphQueryResult> {
    if (!this.driver || !this.isConnected) {
      throw new Error('Not connected to Neo4j');
    }

    const session = this.driver.session({
      database: this.config.database,
      defaultAccessMode: 'WRITE'
    });

    try {
      const result = await session.run(query.cypher, query.parameters || {});
      
      return {
        records: result.records.map(record => record.toObject()),
        summary: {
          query: query.cypher,
          parameters: query.parameters || {},
          resultAvailableAfter: result.summary.resultAvailableAfter,
          resultConsumedAfter: result.summary.resultConsumedAfter
        }
      };
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Neo4j query failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'Neo4jConnection', operation: 'executeQuery', metadata: { query: query.cypher } }
      );
      this.logger.error('Neo4j query failed', { errorId: report.id, query: query.cypher });
      throw error;
    } finally {
      await session.close();
    }
  }

  async executeTransaction(queries: GraphQuery[]): Promise<GraphQueryResult[]> {
    if (!this.driver || !this.isConnected) {
      throw new Error('Not connected to Neo4j');
    }

    const session = this.driver.session({
      database: this.config.database,
      defaultAccessMode: 'WRITE'
    });

    try {
      const results: GraphQueryResult[] = [];
      
      const transactionResult = await session.writeTransaction(async tx => {
        const txResults: GraphQueryResult[] = [];
        
        for (const query of queries) {
          const result = await tx.run(query.cypher, query.parameters || {});
          txResults.push({
            records: result.records.map(record => record.toObject()),
            summary: {
              query: query.cypher,
              parameters: query.parameters || {},
              resultAvailableAfter: result.summary.resultAvailableAfter,
              resultConsumedAfter: result.summary.resultConsumedAfter
            }
          });
        }
        
        return txResults;
      });

      return transactionResult;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Neo4j transaction failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'Neo4jConnection', operation: 'executeTransaction', metadata: { queryCount: queries.length } }
      );
      this.logger.error('Neo4j transaction failed', { errorId: report.id, queryCount: queries.length });
      throw error;
    } finally {
      await session.close();
    }
  }

  async createNode(node: GraphNode): Promise<string> {
    const labels = node.labels.join(':');
    const properties = this.formatProperties(node.properties);
    
    const query: GraphQuery = {
      cypher: `CREATE (n:${labels} $properties) RETURN n.id as id`,
      parameters: { properties: { ...node.properties, id: node.id } }
    };

    const result = await this.executeQuery(query);
    return result.records[0]?.id || node.id;
  }

  async createRelationship(relationship: GraphRelationship): Promise<string> {
    const query: GraphQuery = {
      cypher: `
        MATCH (start), (end)
        WHERE start.id = $startId AND end.id = $endId
        CREATE (start)-[r:${relationship.type} $properties]->(end)
        RETURN id(r) as relationshipId
      `,
      parameters: {
        startId: relationship.startNodeId,
        endId: relationship.endNodeId,
        properties: relationship.properties
      }
    };

    const result = await this.executeQuery(query);
    return result.records[0]?.relationshipId?.toString() || relationship.id;
  }

  async findNodesByLabel(label: string, properties?: Record<string, any>): Promise<GraphNode[]> {
    const whereClause = properties ? this.buildWhereClause(properties) : '';
    const parameters = properties ? { properties } : {};
    
    const query: GraphQuery = {
      cypher: `MATCH (n:${label})${whereClause} RETURN n`,
      parameters
    };

    const result = await this.executeQuery(query);
    return result.records.map(record => this.recordToNode(record.n));
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<GraphRelationship[]> {
    const typePattern = type ? `:${type}` : '';
    const whereClause = properties ? this.buildWhereClause(properties, 'r') : '';
    const parameters = properties ? { properties } : {};
    
    const query: GraphQuery = {
      cypher: `MATCH (start)-[r${typePattern}]->(end)${whereClause} 
               RETURN r, start.id as startId, end.id as endId`,
      parameters
    };

    const result = await this.executeQuery(query);
    return result.records.map(record => this.recordToRelationship(record.r, record.startId, record.endId));
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const query: GraphQuery = {
      cypher: 'MATCH (n) WHERE n.id = $nodeId DETACH DELETE n RETURN count(n) as deleted',
      parameters: { nodeId }
    };

    const result = await this.executeQuery(query);
    return (result.records[0]?.deleted || 0) > 0;
  }

  async deleteRelationship(relationshipId: string): Promise<boolean> {
    const query: GraphQuery = {
      cypher: 'MATCH ()-[r]->() WHERE id(r) = $relationshipId DELETE r RETURN count(r) as deleted',
      parameters: { relationshipId: parseInt(relationshipId) }
    };

    const result = await this.executeQuery(query);
    return (result.records[0]?.deleted || 0) > 0;
  }

  async getDatabaseStats(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    labels: string[];
    relationshipTypes: string[];
  }> {
    const nodeCountQuery = { cypher: 'MATCH (n) RETURN count(n) as count' };
    const relationshipCountQuery = { cypher: 'MATCH ()-[r]->() RETURN count(r) as count' };
    const labelsQuery = { cypher: 'CALL db.labels()' };
    const relationshipTypesQuery = { cypher: 'CALL db.relationshipTypes()' };

    const [nodeCountResult, relationshipCountResult, labelsResult, relationshipTypesResult] = await Promise.all([
      this.executeQuery(nodeCountQuery),
      this.executeQuery(relationshipCountQuery),
      this.executeQuery(labelsQuery),
      this.executeQuery(relationshipTypesQuery)
    ]);

    return {
      nodeCount: nodeCountResult.records[0]?.count || 0,
      relationshipCount: relationshipCountResult.records[0]?.count || 0,
      labels: labelsResult.records.map(record => record['label']),
      relationshipTypes: relationshipTypesResult.records.map(record => record['relationshipType'])
    };
  }

  async clearDatabase(): Promise<boolean> {
    try {
      await this.executeQuery({ cypher: 'MATCH (n) DETACH DELETE n' });
      this.logger.info('Neo4j database cleared');
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to clear Neo4j database: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'Neo4jConnection', operation: 'clearDatabase' }
      );
      this.logger.error('Failed to clear Neo4j database', { errorId: report.id });
      return false;
    }
  }

  private formatProperties(properties: Record<string, any>): Record<string, any> {
    const formatted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if (value instanceof Date) {
        formatted[key] = value.toISOString();
      } else if (typeof value === 'object' && value !== null) {
        formatted[key] = JSON.stringify(value);
      } else {
        formatted[key] = value;
      }
    }
    
    return formatted;
  }

  private buildWhereClause(properties: Record<string, any>, variable: string = 'n'): string {
    const conditions = Object.entries(properties).map(([key, value]) => {
      if (typeof value === 'string') {
        return `${variable}.${key} = '${value.replace(/'/g, "\\'")}'`;
      } else if (typeof value === 'number') {
        return `${variable}.${key} = ${value}`;
      } else if (typeof value === 'boolean') {
        return `${variable}.${key} = ${value}`;
      } else {
        return `${variable}.${key} = $properties.${key}`;
      }
    });
    
    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private recordToNode(record: any): GraphNode {
    return {
      id: record.id,
      labels: record.labels || [],
      properties: record.properties || {}
    };
  }

  private recordToRelationship(record: any, startId: string, endId: string): GraphRelationship {
    return {
      id: record.id.toString(),
      type: record.type,
      startNodeId: startId,
      endNodeId: endId,
      properties: record.properties || {}
    };
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.isConnected = false;
      this.logger.info('Neo4j connection closed');
    }
  }
}