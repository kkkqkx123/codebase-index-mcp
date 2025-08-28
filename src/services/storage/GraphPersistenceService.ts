import { injectable, inject } from 'inversify';
import { Neo4jConnectionManager, GraphNode, GraphRelationship, GraphQuery } from '../neo4j/Neo4jConnectionManager';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { ParsedFile } from '../../services/parser/SmartCodeParser';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

export interface GraphPersistenceOptions {
  projectId?: string;
  overwriteExisting?: boolean;
  createRelationships?: boolean;
  batchSize?: number;
}

export interface GraphPersistenceResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  nodesUpdated: number;
  processingTime: number;
  errors: string[];
}

export interface CodeGraphNode {
  id: string;
  type: 'File' | 'Function' | 'Class' | 'Interface' | 'Import' | 'Project';
  name: string;
  properties: Record<string, any>;
}

export interface CodeGraphRelationship {
  id: string;
  type: 'CONTAINS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'IMPORTS' | 'BELONGS_TO';
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

@injectable()
export class GraphPersistenceService {
  private neo4jManager: Neo4jConnectionManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private isInitialized: boolean = false;

  constructor(
    @inject(Neo4jConnectionManager) neo4jManager: Neo4jConnectionManager,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService
  ) {
    this.neo4jManager = neo4jManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.neo4jManager.isConnectedToDatabase()) {
        const connected = await this.neo4jManager.connect();
        if (!connected) {
          throw new Error('Failed to connect to Neo4j');
        }
      }

      await this.ensureConstraints();
      this.isInitialized = true;
      
      this.logger.info('Graph persistence service initialized');
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to initialize graph persistence: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'initialize' }
      );
      this.logger.error('Failed to initialize graph persistence', { errorId: report.id });
      return false;
    }
  }

  async storeParsedFiles(files: ParsedFile[], options: GraphPersistenceOptions = {}): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      const queries: GraphQuery[] = [];
      
      if (options.projectId) {
        const projectQuery = this.createProjectNode(options.projectId);
        queries.push(projectQuery);
      }

      for (const file of files) {
        const fileQueries = this.createFileQueries(file, options);
        queries.push(...fileQueries);
      }

      if (options.createRelationships !== false) {
        const relationshipQueries = this.createRelationshipQueries(files, options);
        queries.push(...relationshipQueries);
      }

      const batchSize = options.batchSize || 50;
      const results: GraphPersistenceResult[] = [];

      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const batchResult = await this.executeBatch(batch);
        results.push(batchResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.info('Files stored in graph successfully', {
          fileCount: files.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime
        });
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to store parsed files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'storeParsedFiles' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store parsed files', { errorId: report.id });
    }

    return result;
  }

  async storeChunks(chunks: CodeChunk[], options: GraphPersistenceOptions = {}): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      const queries: GraphQuery[] = [];

      for (const chunk of chunks) {
        const chunkQueries = this.createChunkQueries(chunk, options);
        queries.push(...chunkQueries);
      }

      const batchSize = options.batchSize || 100;
      const results: GraphPersistenceResult[] = [];

      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        const batchResult = await this.executeBatch(batch);
        results.push(batchResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      if (result.success) {
        this.logger.info('Chunks stored in graph successfully', {
          chunkCount: chunks.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime
        });
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to store chunks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'storeChunks' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store chunks', { errorId: report.id });
    }

    return result;
  }

  async findRelatedNodes(nodeId: string, relationshipTypes?: string[], maxDepth: number = 2): Promise<CodeGraphNode[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const relationshipPattern = relationshipTypes ? `:${relationshipTypes.join('|')}` : '';
      const query: GraphQuery = {
        cypher: `
          MATCH (start {id: $nodeId})-[r${relationshipPattern}*1..${maxDepth}]->(related)
          RETURN DISTINCT related
        `,
        parameters: { nodeId }
      };

      const result = await this.neo4jManager.executeQuery(query);
      return result.records.map(record => this.recordToGraphNode(record.related));
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to find related nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'findRelatedNodes' }
      );
      this.logger.error('Failed to find related nodes', { errorId: report.id, nodeId });
      return [];
    }
  }

  async findPath(sourceId: string, targetId: string, maxDepth: number = 5): Promise<CodeGraphRelationship[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const query: GraphQuery = {
        cypher: `
          MATCH path = shortestPath((start {id: $sourceId})-[*1..${maxDepth}]->(end {id: $targetId}))
          UNWIND relationships(path) as rel
          RETURN rel, startNode(rel).id as sourceId, endNode(rel).id as targetId
        `,
        parameters: { sourceId, targetId }
      };

      const result = await this.neo4jManager.executeQuery(query);
      return result.records.map(record => this.recordToGraphRelationship(record.rel, record.sourceId, record.targetId));
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to find path: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'findPath' }
      );
      this.logger.error('Failed to find path', { errorId: report.id, sourceId, targetId });
      return [];
    }
  }

  async getGraphStats(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [nodeCountResult, relationshipCountResult, nodeTypesResult, relationshipTypesResult] = await Promise.all([
        this.neo4jManager.executeQuery({ cypher: 'MATCH (n) RETURN count(n) as count' }),
        this.neo4jManager.executeQuery({ cypher: 'MATCH ()-[r]->() RETURN count(r) as count' }),
        this.neo4jManager.executeQuery({ cypher: 'MATCH (n) RETURN labels(n)[0] as type, count(n) as count ORDER BY count DESC' }),
        this.neo4jManager.executeQuery({ cypher: 'MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC' })
      ]);

      const nodeTypes: Record<string, number> = {};
      const relationshipTypes: Record<string, number> = {};

      nodeTypesResult.records.forEach(record => {
        nodeTypes[record.type] = record.count;
      });

      relationshipTypesResult.records.forEach(record => {
        relationshipTypes[record.type] = record.count;
      });

      return {
        nodeCount: nodeCountResult.records[0]?.count || 0,
        relationshipCount: relationshipCountResult.records[0]?.count || 0,
        nodeTypes,
        relationshipTypes
      };
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to get graph stats: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'getGraphStats' }
      );
      this.logger.error('Failed to get graph stats', { errorId: report.id });
      return {
        nodeCount: 0,
        relationshipCount: 0,
        nodeTypes: {},
        relationshipTypes: {}
      };
    }
  }

  async clearGraph(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await this.neo4jManager.clearDatabase();
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to clear graph: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'clearGraph' }
      );
      this.logger.error('Failed to clear graph', { errorId: report.id });
      return false;
    }
  }

  private async ensureConstraints(): Promise<void> {
    const constraints = [
      'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE'
    ];

    for (const constraint of constraints) {
      await this.neo4jManager.executeQuery({ cypher: constraint });
    }
  }

  private createProjectNode(projectId: string): GraphQuery {
    return {
      cypher: `
        MERGE (p:Project {id: $projectId})
        SET p.name = $projectId,
            p.createdAt = datetime(),
            p.updatedAt = datetime()
        RETURN p
      `,
      parameters: { projectId }
    };
  }

  private createFileQueries(file: ParsedFile, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    const fileQuery: GraphQuery = {
      cypher: `
        MERGE (f:File {id: $fileId})
        SET f.path = $filePath,
            f.relativePath = $relativePath,
            f.name = $fileName,
            f.language = $language,
            f.size = $size,
            f.hash = $hash,
            f.linesOfCode = $linesOfCode,
            f.functions = $functions,
            f.classes = $classes,
            f.lastModified = $lastModified,
            f.updatedAt = datetime()
      `,
      parameters: {
        fileId: file.id,
        filePath: file.filePath,
        relativePath: file.relativePath,
        fileName: file.name,
        language: file.language,
        size: file.size,
        hash: file.hash,
        linesOfCode: file.metadata.linesOfCode,
        functions: file.metadata.functions,
        classes: file.metadata.classes,
        lastModified: file.lastModified.toISOString()
      }
    };

    queries.push(fileQuery);

    if (options.projectId) {
      queries.push({
        cypher: `
          MATCH (f:File {id: $fileId}), (p:Project {id: $projectId})
          MERGE (f)-[:BELONGS_TO]->(p)
        `,
        parameters: { fileId: file.id, projectId: options.projectId }
      });
    }

    for (const chunk of file.chunks) {
      queries.push(...this.createChunkNodeQueries(chunk, file, options));
    }

    return queries;
  }

  private createChunkQueries(chunk: CodeChunk, options: GraphPersistenceOptions): GraphQuery[] {
    return this.createChunkNodeQueries(chunk, null, options);
  }

  private createChunkNodeQueries(chunk: CodeChunk, file: ParsedFile | null, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    if (chunk.type === 'function') {
      queries.push({
        cypher: `
          MERGE (f:Function {id: $chunkId})
          SET f.name = $functionName,
              f.content = $content,
              f.startLine = $startLine,
              f.endLine = $endLine,
              f.complexity = $complexity,
              f.parameters = $parameters,
              f.returnType = $returnType,
              f.language = $language,
              f.updatedAt = datetime()
        `,
        parameters: {
          chunkId: chunk.id,
          functionName: chunk.functionName || 'anonymous',
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          complexity: chunk.metadata.complexity || 1,
          parameters: chunk.metadata.parameters || [],
          returnType: chunk.metadata.returnType || 'unknown',
          language: chunk.metadata.language || 'unknown'
        }
      });

      if (file) {
        queries.push({
          cypher: `
            MATCH (f:Function {id: $chunkId}), (file:File {id: $fileId})
            MERGE (file)-[:CONTAINS]->(f)
          `,
          parameters: { chunkId: chunk.id, fileId: file.id }
        });
      }
    }

    if (chunk.type === 'class') {
      queries.push({
        cypher: `
          MERGE (c:Class {id: $chunkId})
          SET c.name = $className,
              c.content = $content,
              c.startLine = $startLine,
              c.endLine = $endLine,
              c.methods = $methods,
              c.properties = $properties,
              c.inheritance = $inheritance,
              c.language = $language,
              c.updatedAt = datetime()
        `,
        parameters: {
          chunkId: chunk.id,
          className: chunk.className || 'anonymous',
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          methods: chunk.metadata.methods || 0,
          properties: chunk.metadata.properties || 0,
          inheritance: chunk.metadata.inheritance || [],
          language: chunk.metadata.language || 'unknown'
        }
      });

      if (file) {
        queries.push({
          cypher: `
            MATCH (c:Class {id: $chunkId}), (file:File {id: $fileId})
            MERGE (file)-[:CONTAINS]->(c)
          `,
          parameters: { chunkId: chunk.id, fileId: file.id }
        });
      }
    }

    return queries;
  }

  private createRelationshipQueries(files: ParsedFile[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const file of files) {
      for (const importName of file.metadata.imports) {
        queries.push({
          cypher: `
            MATCH (f:File {id: $fileId})
            MERGE (i:Import {id: $importId})
            SET i.module = $importName,
                i.updatedAt = datetime()
            MERGE (f)-[:IMPORTS]->(i)
          `,
          parameters: {
            fileId: file.id,
            importId: `import_${file.id}_${importName}`,
            importName: importName
          }
        });
      }
    }

    return queries;
  }

  private async executeBatch(queries: GraphQuery[]): Promise<GraphPersistenceResult> {
    try {
      const results = await this.neo4jManager.executeTransaction(queries);
      
      let nodesCreated = 0;
      let relationshipsCreated = 0;
      let nodesUpdated = 0;

      for (const result of results) {
        const summary = result.summary;
        if (summary.query.includes('MERGE')) {
          nodesCreated += result.records.length;
        }
        if (summary.query.includes('->')) {
          relationshipsCreated += result.records.length;
        }
        if (summary.query.includes('SET')) {
          nodesUpdated += result.records.length;
        }
      }

      return {
        success: true,
        nodesCreated,
        relationshipsCreated,
        nodesUpdated,
        processingTime: 0,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        nodesCreated: 0,
        relationshipsCreated: 0,
        nodesUpdated: 0,
        processingTime: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private recordToGraphNode(record: any): CodeGraphNode {
    return {
      id: record.id,
      type: record.labels[0],
      name: record.name || record.id,
      properties: record.properties || {}
    };
  }

  private recordToGraphRelationship(record: any, sourceId: string, targetId: string): CodeGraphRelationship {
    return {
      id: record.id.toString(),
      type: record.type,
      sourceId,
      targetId,
      properties: record.properties || {}
    };
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}