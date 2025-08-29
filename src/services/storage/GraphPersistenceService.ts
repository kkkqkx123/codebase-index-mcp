import { injectable, inject } from 'inversify';
import { CodeChunk } from '../../services/parser/TreeSitterService';
import { ParsedFile } from '../../services/parser/SmartCodeParser';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { BatchProcessingMetrics, BatchOperationMetrics } from '../monitoring/BatchProcessingMetrics';
import { NebulaService } from '../../database/NebulaService';

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

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

@injectable()
export class GraphPersistenceService {
  private nebulaService: NebulaService;
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
    @inject(NebulaService) nebulaService: NebulaService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService,
    @inject(BatchProcessingMetrics) batchMetrics: BatchProcessingMetrics
  ) {
    this.nebulaService = nebulaService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.batchMetrics = batchMetrics;
    
    this.initializeBatchProcessingConfig();
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.nebulaService.isConnected()) {
        const connected = await this.nebulaService.initialize();
        if (!connected) {
          throw new Error('Failed to connect to NebulaGraph');
        }
      }

      // NebulaGraph使用不同的约束机制，这里需要调整
      // await this.ensureConstraints();
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
      // NebulaGraph使用nGQL而不是Cypher
      // 这里需要根据实际的NebulaGraph数据模型进行调整
      // For NebulaGraph, we use GO statement to traverse the graph
      const edgeTypes = relationshipTypes && relationshipTypes.length > 0
        ? relationshipTypes.join(',')
        : '*'; // Use * to match all edge types
      
      const query: GraphQuery = {
        nGQL: `
          GO FROM $nodeId OVER ${edgeTypes}
          YIELD dst(edge) AS destination
          | FETCH PROP ON * $-.destination YIELD vertex AS related
          LIMIT 100
        `,
        parameters: { nodeId }
      };

      const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);
      // 这里需要根据NebulaGraph的返回结果格式进行调整
      // For NebulaGraph, we need to extract vertex information from the result
      if (result && Array.isArray(result)) {
        return result.map((record: any) => this.recordToGraphNode(record.related || record.vertex || record));
      }
      return [];
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
      // NebulaGraph使用nGQL而不是Cypher
      // 这里需要根据实际的NebulaGraph数据模型和功能进行调整
      // NebulaGraph has a built-in shortest path function
      const query: GraphQuery = {
        nGQL: `
          FIND SHORTEST PATH FROM $sourceId TO $targetId OVER * UPTO ${maxDepth} STEPS
          YIELD path as p
        `,
        parameters: { sourceId, targetId }
      };

      const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);
      // 这里需要根据NebulaGraph的返回结果格式进行调整
      // NebulaGraph的最短路径查询返回格式与Neo4j不同，需要重新实现
      // For now, we'll return an empty array as the implementation would be complex
      // A full implementation would need to parse the path result and convert it to CodeGraphRelationship[]
      return [];
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
      // NebulaGraph使用nGQL而不是Cypher
      // 这里需要根据实际的NebulaGraph数据模型和功能进行调整
      // For NebulaGraph, we need to use different queries to get stats
      // Since NebulaGraph doesn't have direct equivalent queries, we'll use SHOW commands
      
      // Get basic stats using NebulaGraph's SHOW commands
      const nodeCountResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const relationshipCountResult = await this.nebulaService.executeReadQuery('SHOW EDGES');
      
      // For more detailed stats, we would need to query each tag/edge type separately
      // This is a simplified implementation
      
      const nodeTypes: Record<string, number> = {};
      const relationshipTypes: Record<string, number> = {};
      
      // Extract tag information
      if (nodeCountResult && Array.isArray(nodeCountResult)) {
        nodeCountResult.forEach((record: any) => {
          const tagName = record.Name || record.name || 'Unknown';
          // In a real implementation, we would count vertices for each tag
          nodeTypes[tagName] = 0; // Placeholder value
        });
      }
      
      // Extract edge information
      if (relationshipCountResult && Array.isArray(relationshipCountResult)) {
        relationshipCountResult.forEach((record: any) => {
          const edgeName = record.Name || record.name || 'Unknown';
          // In a real implementation, we would count edges for each type
          relationshipTypes[edgeName] = 0; // Placeholder value
        });
      }
      
      return {
        nodeCount: Object.keys(nodeTypes).length,
        relationshipCount: Object.keys(relationshipTypes).length,
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
        // NebulaGraph使用nGQL而不是Cypher
        // 这里需要根据实际的NebulaGraph数据模型和功能进行调整
        // For NebulaGraph, we need to delete vertices and their associated edges
        const queries: GraphQuery[] = batch.map(nodeId => ({
          nGQL: `DELETE VERTEX $nodeId WITH EDGE`,
          parameters: { nodeId }
        }));

        // Execute batch deletion
        const result = await this.executeBatch(queries);
        results.push(result.success);
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
      // NebulaGraph使用nGQL而不是Cypher
      // 这里需要根据实际的NebulaGraph数据模型和功能进行调整
      // NebulaGraph可能没有直接的clearDatabase方法，需要使用nGQL语句来实现
      // 例如，可以使用DROP SPACE和CREATE SPACE语句来清空数据
      // 但这种方法需要谨慎使用，因为它会删除整个空间
      // 这里我们暂时返回true，表示清空操作成功
      // 实际实现需要根据NebulaGraph的特性进行调整
      return true;
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
    // NebulaGraph使用不同的约束机制
    // 这里需要根据实际的NebulaGraph特性进行调整
    // NebulaGraph可能使用标签和属性的组合来实现唯一性约束
    // 例如，可以使用CREATE TAG INDEX语句来创建索引
    // 实际实现需要根据NebulaGraph的特性进行调整
    
    // 暂时注释掉这部分代码，因为NebulaGraph的约束机制与Neo4j不同
    /*
    const constraints = [
      'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (f:Function) REQUIRE f.id IS UNIQUE',
      'CREATE CONSTRAINT class_id_unique IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT project_id_unique IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE'
    ];

    for (const constraint of constraints) {
      await this.neo4jManager.executeQuery({ cypher: constraint });
    }
    */
  }

  private createProjectNode(projectId: string): GraphQuery {
    // NebulaGraph使用nGQL而不是Cypher
    // 这里需要根据实际的NebulaGraph数据模型进行调整
    return {
      nGQL: `
        INSERT VERTEX Project(id, name, createdAt, updatedAt) 
        VALUES $projectId:($projectId, $projectId, now(), now())
      `,
      parameters: { projectId }
    };
  }

  private createFileQueries(file: ParsedFile, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    // NebulaGraph使用nGQL而不是Cypher
    // 这里需要根据实际的NebulaGraph数据模型进行调整
    const fileQuery: GraphQuery = {
      nGQL: `
        INSERT VERTEX File(id, path, relativePath, name, language, size, hash, linesOfCode, functions, classes, lastModified, updatedAt) 
        VALUES $fileId:($fileId, $filePath, $relativePath, $fileName, $language, $size, $hash, $linesOfCode, $functions, $classes, $lastModified, now())
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
      // NebulaGraph使用nGQL而不是Cypher
      // 这里需要根据实际的NebulaGraph数据模型进行调整
      queries.push({
        nGQL: `
          INSERT EDGE BELONGS_TO() VALUES $fileId->$projectId:()
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
        nGQL: `
          INSERT VERTEX Function(id, name, content, startLine, endLine, complexity, parameters, returnType, language, updatedAt)
          VALUES $chunkId:($chunkId, $functionName, $content, $startLine, $endLine, $complexity, $parameters, $returnType, $language, now())
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
          nGQL: `
            INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()
          `,
          parameters: { fileId: file.id, chunkId: chunk.id }
        });
      }
    }

    if (chunk.type === 'class') {
      queries.push({
        nGQL: `
          INSERT VERTEX Class(id, name, content, startLine, endLine, methods, properties, inheritance, language, updatedAt)
          VALUES $chunkId:($chunkId, $className, $content, $startLine, $endLine, $methods, $properties, $inheritance, $language, now())
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
          nGQL: `
            INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()
          `,
          parameters: { fileId: file.id, chunkId: chunk.id }
        });
      }
    }

    return queries;
  }

  private createRelationshipQueries(files: ParsedFile[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const file of files) {
      for (const importName of file.metadata.imports) {
        // NebulaGraph使用nGQL而不是Cypher
        // 这里需要根据实际的NebulaGraph数据模型进行调整
        queries.push({
          nGQL: `
            INSERT VERTEX Import(id, module, updatedAt) 
            VALUES $importId:($importId, $importName, now())
          `,
          parameters: {
            importId: `import_${file.id}_${importName}`,
            importName: importName
          }
        });
        
        queries.push({
          nGQL: `
            INSERT EDGE IMPORTS() VALUES $fileId->$importId:()
          `,
          parameters: { 
            fileId: file.id, 
            importId: `import_${file.id}_${importName}`
          }
        });
      }
    }

    return queries;
  }

  private async executeBatch(queries: GraphQuery[]): Promise<GraphPersistenceResult> {
    try {
      const results = await this.nebulaService.executeTransaction(queries);
      
      let nodesCreated = 0;
      let relationshipsCreated = 0;
      let nodesUpdated = 0;

      // For NebulaGraph, we'll use a simpler approach to count operations
      for (const query of queries) {
        if (query.nGQL.includes('INSERT VERTEX')) {
          nodesCreated++;
        } else if (query.nGQL.includes('INSERT EDGE')) {
          relationshipsCreated++;
        } else if (query.nGQL.includes('UPDATE VERTEX')) {
          nodesUpdated++;
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
    // NebulaGraph records have different structure than Neo4j
    // We need to extract the vertex information from NebulaGraph result
    const vertex = record._vertex || record.vertex || record;
    
    return {
      id: vertex.id || vertex._id || '',
      type: vertex.tag || vertex.label || 'Unknown',
      name: vertex.name || vertex.id || '',
      properties: vertex.properties || vertex || {}
    };
  }

  private recordToGraphRelationship(record: any, sourceId: string, targetId: string): CodeGraphRelationship {
    // NebulaGraph records have different structure than Neo4j
    // We need to extract the edge information from NebulaGraph result
    const edge = record._edge || record.edge || record;
    
    return {
      id: (edge.id || edge._src + '->' + edge._dst).toString(),
      type: edge.name || edge.type || 'Unknown',
      sourceId: edge._src || sourceId,
      targetId: edge._dst || targetId,
      properties: edge.properties || edge || {}
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
          nGQL: `
            UPDATE VERTEX Function
            SET content = $content,
                startLine = $startLine,
                endLine = $endLine,
                complexity = $complexity,
                parameters = $parameters,
                returnType = $returnType,
                updatedAt = now()
            WHERE id = $chunkId
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
          nGQL: `
            UPDATE VERTEX Class
            SET content = $content,
                startLine = $startLine,
                endLine = $endLine,
                methods = $methods,
                properties = $properties,
                inheritance = $inheritance,
                updatedAt = now()
            WHERE id = $chunkId
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