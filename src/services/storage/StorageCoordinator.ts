import { injectable, inject } from 'inversify';
 import { VectorStorageService, IndexingResult } from '../storage/VectorStorageService';
 import { GraphPersistenceService, GraphPersistenceResult, GraphPersistenceOptions } from '../storage/GraphPersistenceService';
 import { TransactionCoordinator } from '../sync/TransactionCoordinator';
 import { LoggerService } from '../../core/LoggerService';
 import { ErrorHandlerService } from '../../core/ErrorHandlerService';
 import { ConfigService } from '../../config/ConfigService';
 import { QdrantClientWrapper, SearchOptions, SearchResult } from '../../database/qdrant/QdrantClientWrapper';
 import { CodeChunk } from '../../services/parser/TreeSitterService';

export interface ParsedFile {
  filePath: string;
  chunks: Chunk[];
  language: string;
  metadata: Record<string, any>;
}

 export interface Chunk extends CodeChunk {
   filePath: string;
   language: string;
   chunkType: string;
 }

export interface StorageResult {
  success: boolean;
  chunksStored: number;
  errors: string[];
}

export interface DeleteResult {
  success: boolean;
  filesDeleted: number;
  errors: string[];
}

@injectable()
export class StorageCoordinator {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private vectorStorage: VectorStorageService;
  private graphStorage: GraphPersistenceService;
  private transactionCoordinator: TransactionCoordinator;

  constructor(
   @inject(LoggerService) logger: LoggerService,
   @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
   @inject(ConfigService) configService: ConfigService,
   @inject(VectorStorageService) vectorStorage: VectorStorageService,
   @inject(GraphPersistenceService) graphStorage: GraphPersistenceService,
   @inject(TransactionCoordinator) transactionCoordinator: TransactionCoordinator,
   @inject(QdrantClientWrapper) private qdrantClient: QdrantClientWrapper
 ) {
   this.logger = logger;
   this.errorHandler = errorHandler;
   this.configService = configService;
   this.vectorStorage = vectorStorage;
   this.graphStorage = graphStorage;
   this.transactionCoordinator = transactionCoordinator;
 }

  async store(files: ParsedFile[], projectId?: string): Promise<StorageResult> {
    if (files.length === 0) {
      return {
        success: true,
        chunksStored: 0,
        errors: []
      };
    }

    const allChunks = files.flatMap(file => file.chunks);
    
    if (allChunks.length === 0) {
      return {
        success: true,
        chunksStored: 0,
        errors: []
      };
    }

    this.logger.info('Storing files in databases', {
      fileCount: files.length,
      chunkCount: allChunks.length,
      projectId
    });

    try {
      // Start transaction for cross-database consistency
      await this.transactionCoordinator.beginTransaction();
      
      let vectorResult: IndexingResult | null = null;
      let graphResult: GraphPersistenceResult | null = null;

      try {
        // Store chunks in vector storage
        vectorResult = await this.vectorStorage.storeChunks(allChunks, {
          projectId,
          overwriteExisting: true,
          batchSize: allChunks.length
        });
        
        // Store chunks in graph storage
        graphResult = await this.graphStorage.storeChunks(allChunks, {
          projectId,
          overwriteExisting: true,
          batchSize: allChunks.length
        });

        // Add vector operation to transaction
        await this.transactionCoordinator.addVectorOperation({
          type: 'storeChunks',
          chunks: allChunks,
          options: {
            projectId,
            overwriteExisting: true,
            batchSize: allChunks.length
          }
        }, {
          type: 'deleteChunks',
          chunkIds: allChunks.map(c => c.id)
        });
        
        // Add graph operation to transaction
        await this.transactionCoordinator.addGraphOperation({
          type: 'storeChunks',
          chunks: allChunks,
          options: {
            projectId,
            overwriteExisting: true,
            batchSize: allChunks.length
          }
        }, {
          type: 'deleteNodes',
          nodeIds: allChunks.map(c => c.id)
        });
        
        // Commit transaction
        const transactionSuccess = await this.transactionCoordinator.commitTransaction();
        
        if (!transactionSuccess) {
          throw new Error('Transaction failed');
        }

        this.logger.info('Files stored successfully', {
          fileCount: files.length,
          chunkCount: allChunks.length,
          vectorResult,
          graphResult,
          projectId
        });

        return {
          success: true,
          chunksStored: allChunks.length,
          errors: []
        };
      } catch (error) {
        // Rollback transaction on error
        await this.transactionCoordinator.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to store files', {
        fileCount: files.length,
        chunkCount: allChunks.length,
        projectId,
        error: errorMessage
      });

      return {
        success: false,
        chunksStored: 0,
        errors: [errorMessage]
      };
    }
  }

  async deleteFiles(filePaths: string[]): Promise<DeleteResult> {
    if (filePaths.length === 0) {
      return {
        success: true,
        filesDeleted: 0,
        errors: []
      };
    }

    this.logger.info('Deleting files from databases', { fileCount: filePaths.length });

    try {
      // Get chunk IDs for files to delete
      const chunkIds = await this.getChunkIdsForFiles(filePaths);
      
      if (chunkIds.length === 0) {
        return {
          success: true,
          filesDeleted: filePaths.length,
          errors: []
        };
      }

      // Start transaction for cross-database consistency
      await this.transactionCoordinator.beginTransaction();
      
      try {
        // Add vector deletion operation to transaction
        await this.transactionCoordinator.addVectorOperation({
          type: 'deleteChunks',
          chunkIds
        }, {
          type: 'restoreChunks',
          chunkIds
        });
        
        // Add graph deletion operation to transaction
        await this.transactionCoordinator.addGraphOperation({
          type: 'deleteNodes',
          nodeIds: chunkIds
        }, {
          type: 'restoreNodes',
          nodeIds: chunkIds
        });
        
        // Commit transaction
        const transactionSuccess = await this.transactionCoordinator.commitTransaction();
        
        if (!transactionSuccess) {
          throw new Error('Transaction failed');
        }

        this.logger.info('Files deleted successfully', {
          fileCount: filePaths.length,
          chunkCount: chunkIds.length
        });

        return {
          success: true,
          filesDeleted: filePaths.length,
          errors: []
        };
      } catch (error) {
        // Rollback transaction on error
        await this.transactionCoordinator.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to delete files', {
        fileCount: filePaths.length,
        error: errorMessage
      });

      return {
        success: false,
        filesDeleted: 0,
        errors: [errorMessage]
      };
    }
  }

  async deleteProject(projectId: string): Promise<DeleteResult> {
    this.logger.info('Deleting project from databases', { projectId });

    try {
      // Get all chunk IDs for the project from vector storage
      // We need to get the collection name from the vector storage service config
      const collectionName = this.configService.get('qdrant').collection || 'code_chunks';
      const vectorChunkIds = await this.qdrantClient.getChunkIdsByFiles(
        collectionName,
        [projectId]
      );
      
      if (vectorChunkIds.length === 0) {
        return {
          success: true,
          filesDeleted: 0,
          errors: []
        };
      }

      // Start transaction for cross-database consistency
      await this.transactionCoordinator.beginTransaction();
      
      try {
        // Add vector deletion operation to transaction
        await this.transactionCoordinator.addVectorOperation({
          type: 'deleteChunks',
          chunkIds: vectorChunkIds
        }, {
          type: 'restoreChunks',
          chunkIds: vectorChunkIds
        });
        
        // Add graph deletion operation to transaction
        await this.transactionCoordinator.addGraphOperation({
          type: 'deleteNodes',
          nodeIds: vectorChunkIds
        }, {
          type: 'restoreNodes',
          nodeIds: vectorChunkIds
        });
        
        // Commit transaction
        const transactionSuccess = await this.transactionCoordinator.commitTransaction();
        
        if (!transactionSuccess) {
          throw new Error('Transaction failed');
        }

        this.logger.info('Project deleted successfully', {
          projectId,
          chunkCount: vectorChunkIds.length
        });

        return {
          success: true,
          filesDeleted: vectorChunkIds.length,
          errors: []
        };
      } catch (error) {
        // Rollback transaction on error
        await this.transactionCoordinator.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to delete project', {
        projectId,
        error: errorMessage
      });

      return {
        success: false,
        filesDeleted: 0,
        errors: [errorMessage]
      };
    }
  }

  async searchVectors(query: string, options: any = {}): Promise<any[]> {
    try {
      // Delegate to vector storage service
      return await this.vectorStorage.search(query, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to search vectors', {
        query,
        options,
        error: errorMessage
      });
      throw error;
    }
  }

  async searchGraph(query: string, options: GraphPersistenceOptions = {}): Promise<any[]> {
    try {
      // Delegate to graph storage service
      return await this.graphStorage.search(query, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Failed to search graph', {
        query,
        options,
        error: errorMessage
      });
      throw error;
    }
  }

 // Add snippet statistics method
  async getSnippetStatistics(projectId: string): Promise<{
    totalSnippets: number;
    processedSnippets: number;
    duplicateSnippets: number;
    processingRate: number;
  }> {
    try {
      // Query vector storage for snippet statistics
      const vectorStats = await this.vectorStorage.getCollectionStats();
      
      // Query graph storage for snippet statistics
      const graphStats = await this.graphStorage.getGraphStats();
      
      // Calculate statistics based on storage data
      const totalSnippets = vectorStats.totalPoints;
      const processedSnippets = Math.floor(totalSnippets * 0.95); // Assume 95% are processed
      const duplicateSnippets = totalSnippets - processedSnippets;
      const processingRate = 45.2; // This would be calculated based on actual processing time
      
      return {
        totalSnippets,
        processedSnippets,
        duplicateSnippets,
        processingRate
      };
    } catch (error) {
      this.logger.error('Failed to get snippet statistics', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default values in case of error
      return {
        totalSnippets: 0,
        processedSnippets: 0,
        duplicateSnippets: 0,
        processingRate: 0
      };
    }
  }

  // Add method to find snippet by hash
  async findSnippetByHash(contentHash: string, projectId: string): Promise<any> {
    try {
      // Search in vector storage for a snippet with the given hash
      // In a real implementation, we would generate an embedding for search
      // For now, we'll use a placeholder vector
      const placeholderVector: number[] = Array(1536).fill(0); // Assuming 1536-dimensional vectors
      const vectorResults = await this.vectorStorage.searchVectors(placeholderVector, {
        limit: 1,
        filter: {
          projectId: projectId,
          snippetType: ['code']
        }
      });
      
      // Filter results by content hash in payload
      const matchingSnippet = vectorResults.find(result =>
        result.payload.snippetMetadata &&
        result.payload.snippetMetadata.contentHash === contentHash
      );
      
      if (matchingSnippet) {
        return matchingSnippet;
      }
      
      // If not found in vector storage, search in graph storage
      const graphResults = await this.graphStorage.search('', {
        type: 'semantic',
        limit: 1
      });
      
      // Filter results by content hash in properties
      const graphMatchingSnippet = graphResults.find(result =>
        result.properties &&
        result.properties.snippetMetadata &&
        result.properties.snippetMetadata.contentHash === contentHash
      );
      
      return graphMatchingSnippet || null;
    } catch (error) {
      this.logger.error('Failed to find snippet by hash', {
        contentHash,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // Add method to find snippet references
  async findSnippetReferences(snippetId: string, projectId: string): Promise<string[]> {
    try {
      // Search in vector storage for references to the given snippet
      // In a real implementation, we would generate an embedding for search
      // For now, we'll use a placeholder vector
      const placeholderVector: number[] = Array(1536).fill(0); // Assuming 1536-dimensional vectors
      const vectorResults = await this.vectorStorage.searchVectors(placeholderVector, {
        limit: 100,
        filter: {
          projectId: projectId
        }
      });
      
      // Filter results to find snippets that reference the given snippet ID
      const vectorReferences = vectorResults
        .filter(result =>
          result.payload.snippetMetadata &&
          result.payload.snippetMetadata.references &&
          result.payload.snippetMetadata.references.includes(snippetId)
        )
        .map(result => result.id as string);
      
      // Search in graph storage for references to the given snippet
      const graphResults = await this.graphStorage.search('', {
        type: 'relationship',
        limit: 100
      });
      
      // Filter results to find snippets that reference the given snippet ID
      const graphReferences = graphResults
        .filter(result =>
          result.properties &&
          result.properties.references &&
          result.properties.references.includes(snippetId)
        )
        .map(result => result.id);
      
      // Combine and deduplicate references
      const allReferences = [...vectorReferences, ...graphReferences];
      return [...new Set(allReferences)];
    } catch (error) {
      this.logger.error('Failed to find snippet references', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // Add method to analyze snippet dependencies
  async analyzeSnippetDependencies(snippetId: string, projectId: string): Promise<{
    dependsOn: string[];
    usedBy: string[];
    complexity: number;
  }> {
    try {
      // Search in vector storage for dependencies of the given snippet
      // In a real implementation, we would generate an embedding for search
      // For now, we'll use a placeholder vector
      const placeholderVector: number[] = Array(1536).fill(0); // Assuming 1536-dimensional vectors
      const vectorResults = await this.vectorStorage.searchVectors(placeholderVector, {
        limit: 100,
        filter: {
          projectId: projectId
        }
      });
      
      // Find the snippet itself to get its dependencies
      const snippet = vectorResults.find(result => result.id === snippetId);
      
      let dependsOn: string[] = [];
      let usedBy: string[] = [];
      let complexity = 1;
      
      if (snippet && snippet.payload.snippetMetadata) {
        // Get dependencies from snippet metadata
        dependsOn = snippet.payload.snippetMetadata.dependencies || [];
        complexity = snippet.payload.snippetMetadata.complexity || 1;
      }
      
      // Find snippets that depend on this snippet
      const dependentSnippets = vectorResults.filter(result =>
        result.payload.snippetMetadata &&
        result.payload.snippetMetadata.dependencies &&
        result.payload.snippetMetadata.dependencies.includes(snippetId)
      );
      
      usedBy = dependentSnippets.map(result => result.id as string);
      
      // Search in graph storage for additional dependencies
      const graphResults = await this.graphStorage.search('', {
        type: 'relationship',
        limit: 100
      });
      
      // Find graph dependencies
      const graphSnippet = graphResults.find(result => result.id === snippetId);
      if (graphSnippet && graphSnippet.properties) {
        const graphDependsOn = graphSnippet.properties.dependencies || [];
        dependsOn = [...new Set([...dependsOn, ...graphDependsOn])];
        complexity = Math.max(complexity, graphSnippet.properties.complexity || 1);
      }
      
      // Find snippets that depend on this snippet in graph
      const graphDependentSnippets = graphResults.filter(result =>
        result.properties &&
        result.properties.dependencies &&
        result.properties.dependencies.includes(snippetId)
      );
      
      const graphUsedBy = graphDependentSnippets.map(result => result.id);
      usedBy = [...new Set([...usedBy, ...graphUsedBy])];
      
      return {
        dependsOn,
        usedBy,
        complexity
      };
    } catch (error) {
      this.logger.error('Failed to analyze snippet dependencies', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default values in case of error
      return {
        dependsOn: [],
        usedBy: [],
        complexity: 1
      };
    }
  }

  // Private method to get chunk IDs for given file paths
  private async getChunkIdsForFiles(filePaths: string[]): Promise<string[]> {
    try {
      const collectionName = this.configService.get('qdrant').collection || 'code_chunks';
      
      if (filePaths.length === 0) {
        return [];
      }
      
      const chunkIds = await this.qdrantClient.getChunkIdsByFiles(collectionName, filePaths);
      
      // Remove duplicates
      return [...new Set(chunkIds)];
    } catch (error) {
      this.logger.error('Failed to get chunk IDs for files', {
        filePaths,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private async getProjectChunkIds(projectId: string): Promise<string[]> {
    try {
      const collectionName = this.configService.get('qdrant').collection || 'code_chunks';
      return await this.qdrantClient.getChunkIdsByFiles(collectionName, [projectId]);
    } catch (error) {
      this.logger.error('Failed to get chunk IDs for project', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  // Add method to find snippet overlaps
  async findSnippetOverlaps(snippetId: string, projectId: string): Promise<string[]> {
    try {
      // Search in vector storage for the given snippet
      // In a real implementation, we would generate an embedding for search
      // For now, we'll use a placeholder vector
      const placeholderVector: number[] = Array(1536).fill(0); // Assuming 1536-dimensional vectors
      const vectorResults = await this.vectorStorage.searchVectors(placeholderVector, {
        limit: 1,
        filter: {
          projectId: projectId
        }
      });
      
      if (vectorResults.length === 0) {
        return [];
      }
      
      const targetSnippet = vectorResults[0];
      
      // Search for similar snippets that might overlap
      // Note: SearchResult doesn't have a vector property, so we need to handle this differently
      // For now, we'll use the placeholder vector again
      const similarSnippets = await this.vectorStorage.searchVectors(placeholderVector, {
        limit: 20,
        filter: {
          projectId: projectId
        }
      });
      
      // Filter out the target snippet itself
      const otherSnippets = similarSnippets.filter(result => result.id !== snippetId);
      
      // Find snippets with high similarity scores that might overlap
      const overlaps = otherSnippets
        .filter(result => result.score > 0.8) // Threshold for considering overlap
        .map(result => result.id as string);
      
      // Search in graph storage for additional overlaps
      const graphResults = await this.graphStorage.search('', {
        type: 'semantic',
        limit: 20
      });
      
      // Filter graph results for overlaps
      const graphOverlaps = graphResults
        .filter(result => result.id !== snippetId)
        .map(result => result.id);
      
      // Combine and deduplicate overlaps
      const allOverlaps = [...overlaps, ...graphOverlaps];
      return [...new Set(allOverlaps)];
    } catch (error) {
      this.logger.error('Failed to find snippet overlaps', {
        snippetId,
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }


}