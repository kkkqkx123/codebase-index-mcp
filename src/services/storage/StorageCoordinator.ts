import { injectable, inject } from 'inversify';
import { VectorStorageService } from '../storage/VectorStorageService';
import { GraphPersistenceService } from '../storage/GraphPersistenceService';
import { TransactionCoordinator } from '../sync/TransactionCoordinator';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

export interface ParsedFile {
  filePath: string;
  chunks: Chunk[];
  language: string;
  metadata: Record<string, any>;
}

export interface Chunk {
  id: string;
  content: string;
 filePath: string;
 startLine: number;
  endLine: number;
  language: string;
  chunkType: string;
  metadata: Record<string, any>;
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
    @inject(TransactionCoordinator) transactionCoordinator: TransactionCoordinator
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
      
      let vectorResult: any = null;
      let graphResult: any = null;

      try {
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

        // Mock results for now - in real implementation, these would come from the services
        vectorResult = {
          success: true,
          processedFiles: files.length,
          totalChunks: allChunks.length,
          uniqueChunks: allChunks.length,
          duplicatesRemoved: 0,
          processingTime: 0,
          errors: []
        };
        
        graphResult = {
          success: true,
          nodesCreated: allChunks.length,
          relationshipsCreated: 0,
          nodesUpdated: 0,
          processingTime: 0,
          errors: []
        };

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
      // In a real implementation, this would query for all chunks belonging to the project
      // For now, we'll use a mock implementation
      const mockChunkIds = await this.getProjectChunkIds(projectId);
      
      if (mockChunkIds.length === 0) {
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
          chunkIds: mockChunkIds
        }, {
          type: 'restoreChunks',
          chunkIds: mockChunkIds
        });
        
        // Add graph deletion operation to transaction
        await this.transactionCoordinator.addGraphOperation({
          type: 'deleteNodes',
          nodeIds: mockChunkIds
        }, {
          type: 'restoreNodes',
          nodeIds: mockChunkIds
        });
        
        // Commit transaction
        const transactionSuccess = await this.transactionCoordinator.commitTransaction();
        
        if (!transactionSuccess) {
          throw new Error('Transaction failed');
        }

        this.logger.info('Project deleted successfully', {
          projectId,
          chunkCount: mockChunkIds.length
        });

        return {
          success: true,
          filesDeleted: mockChunkIds.length,
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

  async searchGraph(query: string, options: any = {}): Promise<any[]> {
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
    // In a real implementation, this would query the storage for snippet statistics
    // For now, we'll return mock data
    return {
      totalSnippets: 150,
      processedSnippets: 142,
      duplicateSnippets: 8,
      processingRate: 45.2
    };
  }

  // Add method to find snippet by hash
  async findSnippetByHash(contentHash: string, projectId: string): Promise<any> {
    // In a real implementation, this would query the storage for a snippet with the given hash
    // For now, we'll return mock data
    return null;
  }

  // Add method to find snippet references
  async findSnippetReferences(snippetId: string, projectId: string): Promise<string[]> {
    // In a real implementation, this would query the storage for references to the given snippet
    // For now, we'll return mock data
    return [`ref_${snippetId}_1`, `ref_${snippetId}_2`];
  }

  // Add method to analyze snippet dependencies
  async analyzeSnippetDependencies(snippetId: string, projectId: string): Promise<{
    dependsOn: string[];
    usedBy: string[];
    complexity: number;
  }> {
    // In a real implementation, this would analyze code dependencies
    // For now, we'll return mock data
    return {
      dependsOn: [`dep_${snippetId}_1`, `dep_${snippetId}_2`],
      usedBy: [`user_${snippetId}_1`],
      complexity: Math.floor(Math.random() * 10) + 1
    };
  }

  // Add method to find snippet overlaps
  async findSnippetOverlaps(snippetId: string, projectId: string): Promise<string[]> {
    // In a real implementation, this would detect overlapping code segments
    // For now, we'll return mock data
    return [`overlap_${snippetId}_1`];
  }

  private async getChunkIdsForFiles(filePaths: string[]): Promise<string[]> {
    // This would typically query the database to get chunk IDs for the specified files
    // For now, we'll return a mock implementation
    const chunkIds: string[] = [];
    
    for (const filePath of filePaths) {
      // Generate mock chunk IDs based on file path
      const mockChunkCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < mockChunkCount; i++) {
        chunkIds.push(`chunk_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${i}`);
      }
    }
    
    return chunkIds;
  }

  private async getProjectChunkIds(projectId: string): Promise<string[]> {
    // This would typically query the database to get all chunk IDs for the project
    // For now, we'll return a mock implementation
    const mockChunkCount = Math.floor(Math.random() * 100) + 50;
    const chunkIds: string[] = [];
    
    for (let i = 0; i < mockChunkCount; i++) {
      chunkIds.push(`chunk_${projectId}_${i}`);
    }
    
    return chunkIds;
  }
}