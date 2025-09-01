import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { NebulaService } from '../../database/NebulaService';
import { NebulaQueryBuilder } from '../../database/nebula/NebulaQueryBuilder';
import { ParsedFile } from '../parser/SmartCodeParser';
import { CodeChunk } from '../parser/TreeSitterService';

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

export interface GraphPersistenceOptions {
  projectId?: string;
  overwriteExisting?: boolean;
  createRelationships?: boolean;
  batchSize?: number;
  useCache?: boolean;
  cacheTTL?: number;
  limit?: number;
  type?: string;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

@injectable()
export class GraphPersistenceUtils {
  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(NebulaService) private nebulaService: NebulaService,
    @inject(NebulaQueryBuilder) private queryBuilder: NebulaQueryBuilder
  ) { }

  createProjectNode(projectId: string): GraphQuery {
    return {
      nGQL: `INSERT VERTEX Project(id, name, createdAt, updatedAt) VALUES $projectId:($projectId, $projectId, now(), now())`,
      parameters: { projectId }
    };
  }

  createFileQueries(file: ParsedFile, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];
    const fileQuery: GraphQuery = {
      nGQL: `INSERT VERTEX File(id, path, relativePath, name, language, size, hash, linesOfCode, functions, classes, lastModified, updatedAt) VALUES $fileId:($fileId, $filePath, $relativePath, $fileName, $language, $size, $hash, $linesOfCode, $functions, $classes, $lastModified, now())`,
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
        nGQL: `INSERT EDGE BELONGS_TO() VALUES $fileId->$projectId:()`,
        parameters: { fileId: file.id, projectId: options.projectId }
      });
    }

    for (const chunk of file.chunks) {
      queries.push(...this.createChunkNodeQueries(chunk, file, options));
    }

    return queries;
  }

  createChunkQueries(chunk: CodeChunk, options: GraphPersistenceOptions): GraphQuery[] {
    return this.createChunkNodeQueries(chunk, null, options);
  }

  private createChunkNodeQueries(chunk: CodeChunk, file: ParsedFile | null, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    if (chunk.type === 'function') {
      queries.push({
        nGQL: `INSERT VERTEX Function(id, name, content, startLine, endLine, complexity, parameters, returnType, language, updatedAt) VALUES $chunkId:($chunkId, $functionName, $content, $startLine, $endLine, $complexity, $parameters, $returnType, $language, now())`,
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
          nGQL: `INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()`,
          parameters: { fileId: file.id, chunkId: chunk.id }
        });
      }
    }

    if (chunk.type === 'class') {
      queries.push({
        nGQL: `INSERT VERTEX Class(id, name, content, startLine, endLine, methods, properties, inheritance, language, updatedAt) VALUES $chunkId:($chunkId, $className, $content, $startLine, $endLine, $methods, $properties, $inheritance, $language, now())`,
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
          nGQL: `INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()`,
          parameters: { fileId: file.id, chunkId: chunk.id }
        });
      }
    }

    return queries;
  }

  createRelationshipQueries(files: ParsedFile[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const file of files) {
      for (const importName of file.metadata.imports) {
        queries.push({
          nGQL: `INSERT VERTEX Import(id, module, updatedAt) VALUES $importId:($importId, $importName, now())`,
          parameters: {
            importId: `import_${file.id}_${importName}`,
            importName: importName
          }
        });

        queries.push({
          nGQL: `INSERT EDGE IMPORTS() VALUES $fileId->$importId:()`,
          parameters: {
            fileId: file.id,
            importId: `import_${file.id}_${importName}`
          }
        });
      }
    }

    return queries;
  }

  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  calculateOptimalBatchSize(
    avgQuerySize: number,
    availableMemory: number,
    networkLatency: number
  ): number {
    const memoryLimit = Math.floor(availableMemory * 0.8 / avgQuerySize);
    const latencyLimit = Math.floor(1000 / networkLatency);

    return Math.min(memoryLimit, latencyLimit, 1000);
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
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
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  createUpdateNodeQueries(chunks: CodeChunk[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const chunk of chunks) {
      if (chunk.type === 'function') {
        const updateQuery = this.queryBuilder.updateVertex(chunk.id, 'Function', {
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          complexity: chunk.metadata.complexity || 1,
          parameters: chunk.metadata.parameters || [],
          returnType: chunk.metadata.returnType || 'unknown',
          updatedAt: new Date().toISOString()
        });
        queries.push({ nGQL: updateQuery.query, parameters: updateQuery.params });
      }

      if (chunk.type === 'class') {
        const updateQuery = this.queryBuilder.updateVertex(chunk.id, 'Class', {
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          methods: chunk.metadata.methods || 0,
          properties: chunk.metadata.properties || 0,
          inheritance: chunk.metadata.inheritance || [],
          updatedAt: new Date().toISOString()
        });
        queries.push({ nGQL: updateQuery.query, parameters: updateQuery.params });
      }
    }

    return queries;
  }

  async getExistingNodeIds(nodeType: string, options: GraphPersistenceOptions = {}): Promise<string[]> {
    try {
      const query = this.queryBuilder.buildPagedQuery(
        `(n:${nodeType})`,
        'n.id',
        options.projectId ? `n.projectId = \"${options.projectId}\"` : undefined,
        undefined,
        options.limit
      );

      const result = await this.nebulaService.executeReadQuery(query.query, query.params);

      if (result && result.success && result.data && result.data.rows) {
        return result.data.rows.map((row: any) => row.id || row._id);
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get existing node IDs', {
        nodeType,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async getExistingNodeIdsByIds(nodeIds: string[], nodeType: string = 'Node'): Promise<string[]> {
    try {
      if (nodeIds.length === 0) {
        return [];
      }

      // 对于大量节点ID，需要分批查询
      const batches = this.chunkArray(nodeIds, 100);
      const existingIds: string[] = [];

      for (const batch of batches) {
        const idList = batch.map(id => `\"${id}\"`).join(',');
        const query = this.queryBuilder.buildPagedQuery(
          `(n:${nodeType})`,
          'n.id',
          `n.id IN [${idList}]`
        );

        const result = await this.nebulaService.executeReadQuery(query.query, query.params);

        if (result && result.success && result.data && result.data.rows) {
          existingIds.push(...result.data.rows.map((row: any) => row.id || row._id));
        }
      }

      return existingIds;
    } catch (error) {
      this.logger.error('Failed to get existing node IDs by IDs', {
        nodeType,
        nodeIdsCount: nodeIds.length,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async getNodeIdsByFiles(filePaths: string[], options: GraphPersistenceOptions = {}): Promise<Record<string, string[]>> {
    try {
      const result: Record<string, string[]> = {};

      for (const filePath of filePaths) {
        const query = this.queryBuilder.buildPagedQuery(
          `(f:File)`,
          'f.id',
          `f.path = \"${filePath}\"`,
          undefined,
          options.limit
        );

        const queryResult = await this.nebulaService.executeReadQuery(query.query, query.params);

        if (queryResult && queryResult.success && queryResult.data && queryResult.data.rows) {
          result[filePath] = queryResult.data.rows.map((row: any) => row.id || row._id);
        } else {
          result[filePath] = [];
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get node IDs by files', {
        filePaths,
        error: (error as Error).message
      });
      throw error;
    }
  }
}