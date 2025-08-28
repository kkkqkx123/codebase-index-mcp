import { injectable, inject } from 'inversify';
import { Neo4jConnectionManager, GraphNode, GraphRelationship, GraphQuery } from '../neo4j/Neo4jConnectionManager';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { ParsedFile } from '../../services/parser/SmartCodeParser';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';

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
  private configService: ConfigService;
  private batchMetrics: BatchProcessingMetrics;
  private isInitialized: boolean = false;
  
  // Batch processing configuration
  private maxConcurrentOperations: number = 5;
  private defaultBatchSize: number = 50;
  private maxBatchSize: number = 500;
  private memoryThreshold: number = 80;
  private processingTimeout: number = 300000;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private adaptiveBatchingEnabled: boolean = true;

  constructor(
    @inject(Neo4jConnectionManager) neo4jManager: Neo4jConnectionManager,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.neo4jManager = neo4jManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.batchMetrics = batchMetrics;
    
    this.initializeBatchProcessingConfig();
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
    const operationId = `storeParsedFiles_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(files.length);
    
    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'graph',
      batchSize
    );

    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

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

      const results: GraphPersistenceResult[] = [];

      // Process queries in optimized batches with retry logic
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        // Check memory usage before processing each batch
        if (!this.checkMemoryUsage()) {
          throw new Error('Insufficient memory available for batch processing');
        }
        
        const batchResult = await this.processWithTimeout(
          () => this.retryOperation(() => this.executeBatch(batch)),
          this.processingTimeout
        );
        
        results.push(batchResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: files.length,
        successCount: result.success ? files.length : 0,
        errorCount: result.success ? 0 : files.length
      });

      if (result.success) {
        this.logger.info('Files stored in graph successfully', {
          fileCount: files.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
          batchSize
        });
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to store parsed files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'storeParsedFiles' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store parsed files', { errorId: report.id });
      
      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: files.length
      });
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
    }

    return result;
  }

  async storeChunks(chunks: CodeChunk[], options: GraphPersistenceOptions = {}): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const operationId = `storeChunks_${options.projectId || 'unknown'}_${Date.now()}`;
    const batchSize = options.batchSize || this.calculateOptimalBatchSize(chunks.length);
    
    // Start batch operation metrics
    const batchMetrics = this.batchMetrics.startBatchOperation(
      operationId,
      'graph',
      batchSize
    );

    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: []
    };

    try {
      // Check memory usage before starting
      if (!this.checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      const queries: GraphQuery[] = [];

      for (const chunk of chunks) {
        const chunkQueries = this.createChunkQueries(chunk, options);
        queries.push(...chunkQueries);
      }

      const results: GraphPersistenceResult[] = [];

      // Process queries in optimized batches with retry logic
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        // Check memory usage before processing each batch
        if (!this.checkMemoryUsage()) {
          throw new Error('Insufficient memory available for batch processing');
        }
        
        const batchResult = await this.processWithTimeout(
          () => this.retryOperation(() => this.executeBatch(batch)),
          this.processingTimeout
        );
        
        results.push(batchResult);
      }

      result.success = results.every(r => r.success);
      result.nodesCreated = results.reduce((sum, r) => sum + r.nodesCreated, 0);
      result.relationshipsCreated = results.reduce((sum, r) => sum + r.relationshipsCreated, 0);
      result.nodesUpdated = results.reduce((sum, r) => sum + r.nodesUpdated, 0);
      result.processingTime = Date.now() - startTime;

      // Update batch metrics
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: chunks.length,
        successCount: result.success ? chunks.length : 0,
        errorCount: result.success ? 0 : chunks.length
      });

      if (result.success) {
        this.logger.info('Chunks stored in graph successfully', {
          chunkCount: chunks.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
          batchSize
        });
      }
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to store chunks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'storeChunks' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      this.logger.error('Failed to store chunks', { errorId: report.id });
      
      // Update batch metrics with error
      this.batchMetrics.updateBatchOperation(operationId, {
        processedCount: 0,
        successCount: 0,
        errorCount: chunks.length
      });
    } finally {
      // End batch operation metrics
      this.batchMetrics.endBatchOperation(operationId, result.success);
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
      return result.records.map((record: any) => this.recordToGraphNode(record.related));
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
      return result.records.map((record: any) => this.recordToGraphRelationship(record.rel, record.sourceId, record.targetId));
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

      nodeTypesResult.records.forEach((record: any) => {
        nodeTypes[record.type] = record.count;
      });

      relationshipTypesResult.records.forEach((record: any) => {
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

  async deleteNodes(nodeIds: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Create a batch of delete queries
      const batchSize = 100;
      const results: boolean[] = [];

      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        const query: GraphQuery = {
          cypher: `
            UNWIND $nodeIds AS nodeId
            MATCH (n {id: nodeId})
            DETACH DELETE n
            RETURN count(n) as deletedCount
          `,
          parameters: { nodeIds: batch }
        };

        const result = await this.neo4jManager.executeQuery(query);
        const deletedCount = result.records[0]?.deletedCount || 0;
        results.push(deletedCount > 0);
      }

      const success = results.every(r => r);
      this.logger.info('Nodes deleted successfully', {
        nodeCount: nodeIds.length,
        success
      });

      return success;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete nodes: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'deleteNodes' }
      );
      this.logger.error('Failed to delete nodes', {
        errorId: report.id,
        nodeCount: nodeIds.length
      });
      return false;
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
        fileName: file.filePath.split('/').pop() || 'unknown',
        language: file.language,
        size: file.size,
        hash: file.hash,
        linesOfCode: file.metadata.linesOfCode,
        functions: file.metadata.functions,
        classes: file.metadata.classes,
        lastModified: new Date().toISOString()
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

  private initializeBatchProcessingConfig(): void {
    const batchConfig = this.configService.get('batchProcessing');
    
    this.maxConcurrentOperations = batchConfig.maxConcurrentOperations;
    this.defaultBatchSize = batchConfig.defaultBatchSize;
    this.maxBatchSize = batchConfig.maxBatchSize;
    this.memoryThreshold = batchConfig.memoryThreshold;
    this.processingTimeout = batchConfig.processingTimeout;
    this.retryAttempts = batchConfig.retryAttempts;
    this.retryDelay = batchConfig.retryDelay;
    this.adaptiveBatchingEnabled = batchConfig.adaptiveBatching.enabled;
    
    this.logger.info('Graph persistence batch processing configuration initialized', {
      maxConcurrentOperations: this.maxConcurrentOperations,
      defaultBatchSize: this.defaultBatchSize,
      maxBatchSize: this.maxBatchSize,
      memoryThreshold: this.memoryThreshold,
      processingTimeout: this.processingTimeout,
      adaptiveBatchingEnabled: this.adaptiveBatchingEnabled
    });
  }

  private checkMemoryUsage(): boolean {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memoryUsagePercent > this.memoryThreshold) {
      this.logger.warn('Memory usage exceeds threshold', {
        memoryUsagePercent,
        threshold: this.memoryThreshold
      });
      return false;
    }
    
    return true;
  }

  private async processWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.retryAttempts,
    delayMs: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          this.logger.debug('Operation failed, retrying', {
            attempt,
            maxAttempts,
            error: lastError.message
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError;
  }

  private calculateOptimalBatchSize(totalItems: number): number {
    if (!this.adaptiveBatchingEnabled) {
      return Math.min(this.defaultBatchSize, totalItems);
    }

    // For graph operations, use a different strategy based on item count
    const config = this.configService.get('batchProcessing');
    const adaptiveConfig = config.adaptiveBatching;
    
    // Start with a reasonable batch size based on total items
    let batchSize = Math.min(this.defaultBatchSize, totalItems);
    
    // Adjust based on item count - smaller batches for very large item counts
    if (totalItems > 1000) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 2, totalItems);
    } else if (totalItems > 500) {
      batchSize = Math.min(adaptiveConfig.minBatchSize * 3, totalItems);
    }

    return Math.max(adaptiveConfig.minBatchSize, Math.min(batchSize, adaptiveConfig.maxBatchSize));
  }

  async updateChunks(chunks: CodeChunk[], options: GraphPersistenceOptions = {}): Promise<GraphPersistenceResult> {
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
      // For incremental updates, we need to:
      // 1. Check which nodes already exist
      // 2. Only update the nodes that have changed
      // 3. Delete nodes that no longer exist (if specified in options)
      
      const existingNodeIds = await this.getExistingNodeIds(chunks.map(c => c.id));
      const nodesToUpdate = chunks.filter(chunk => existingNodeIds.includes(chunk.id));
      const nodesToCreate = chunks.filter(chunk => !existingNodeIds.includes(chunk.id));
      
      let updatedCount = 0;
      let createdCount = 0;
      
      // Update existing nodes
      if (nodesToUpdate.length > 0) {
        const updateQueries = this.createUpdateNodeQueries(nodesToUpdate, options);
        const updateResult = await this.executeBatch(updateQueries);
        
        if (updateResult.success) {
          updatedCount = updateResult.nodesUpdated;
        } else {
          throw new Error('Failed to update existing nodes');
        }
      }
      
      // Create new nodes
      if (nodesToCreate.length > 0) {
        const createQueries = nodesToCreate.map(chunk => this.createChunkNodeQueries(chunk, null, options)).flat();
        const createResult = await this.executeBatch(createQueries);
        
        if (createResult.success) {
          createdCount = createResult.nodesCreated;
        } else {
          throw new Error('Failed to create new nodes');
        }
      }
      
      result.success = true;
      result.nodesCreated = createdCount;
      result.nodesUpdated = updatedCount;
      result.relationshipsCreated = 0; // Relationships handled separately
      result.processingTime = Date.now() - startTime;
      
      this.logger.info('Nodes updated incrementally', {
        totalNodes: chunks.length,
        createdNodes: createdCount,
        updatedNodes: updatedCount,
        processingTime: result.processingTime
      });
      
      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to update nodes incrementally: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'updateChunks' }
      );
      result.errors.push(`Incremental update failed: ${report.id}`);
      this.logger.error('Failed to update nodes incrementally', { errorId: report.id });
      return result;
    }
  }

  async deleteNodesByFiles(filePaths: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get all node IDs for the specified files
      const nodeIds = await this.getNodeIdsByFiles(filePaths);
      
      if (nodeIds.length === 0) {
        this.logger.debug('No nodes found for files', { filePaths });
        return true;
      }
      
      // Delete the nodes
      const success = await this.deleteNodes(nodeIds);
      
      if (success) {
        this.logger.info('Nodes deleted by files', {
          fileCount: filePaths.length,
          nodeCount: nodeIds.length
        });
      }
      
      return success;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(`Failed to delete nodes by files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphPersistenceService', operation: 'deleteNodesByFiles' }
      );
      this.logger.error('Failed to delete nodes by files', {
        errorId: report.id,
        fileCount: filePaths.length
      });
      return false;
    }
  }

  private async getExistingNodeIds(nodeIds: string[]): Promise<string[]> {
    // This would typically query the graph database to check which nodes exist
    // For now, we'll return a mock implementation
    return nodeIds.filter(() => Math.random() > 0.5); // Randomly return half the node IDs
  }

  private async getNodeIdsByFiles(filePaths: string[]): Promise<string[]> {
    // This would typically query the graph database to get node IDs for the specified files
    // For now, we'll return a mock implementation
    const nodeIds: string[] = [];
    
    for (const filePath of filePaths) {
      // Generate mock node IDs based on file path
      const mockNodeCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < mockNodeCount; i++) {
        nodeIds.push(`node_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${i}`);
      }
    }
    
    return nodeIds;
  }

  private createUpdateNodeQueries(chunks: CodeChunk[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const chunk of chunks) {
      if (chunk.type === 'function') {
        queries.push({
          cypher: `
            MATCH (f:Function {id: $chunkId})
            SET f.content = $content,
                f.startLine = $startLine,
                f.endLine = $endLine,
                f.complexity = $complexity,
                f.parameters = $parameters,
                f.returnType = $returnType,
                f.updatedAt = datetime()
          `,
          parameters: {
            chunkId: chunk.id,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            complexity: chunk.metadata.complexity || 1,
            parameters: chunk.metadata.parameters || [],
            returnType: chunk.metadata.returnType || 'unknown'
          }
        });
      }

      if (chunk.type === 'class') {
        queries.push({
          cypher: `
            MATCH (c:Class {id: $chunkId})
            SET c.content = $content,
                c.startLine = $startLine,
                c.endLine = $endLine,
                c.methods = $methods,
                c.properties = $properties,
                c.inheritance = $inheritance,
                c.updatedAt = datetime()
          `,
          parameters: {
            chunkId: chunk.id,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            methods: chunk.metadata.methods || 0,
            properties: chunk.metadata.properties || 0,
            inheritance: chunk.metadata.inheritance || []
          }
        });
      }
    }

    return queries;
  }
}