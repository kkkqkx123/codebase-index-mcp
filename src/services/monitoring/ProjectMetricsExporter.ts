import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { QdrantClientWrapper } from '../../database/qdrant/QdrantClientWrapper';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';

@injectable()
export class ProjectMetricsExporter {
  constructor(
    @inject(ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.QdrantClientWrapper) private qdrantClient: QdrantClientWrapper,
    @inject(TYPES.NebulaService) private nebulaClient: NebulaService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async collectMetrics(): Promise<void> {
    try {
      // Collect metrics for all projects
      const projects = this.projectIdManager.listAllProjects();
      
      for (const projectId of projects) {
        // Collect Qdrant collection metrics
        await this.collectQdrantMetrics(projectId);
        
        // Collect Nebula Graph space metrics
        await this.collectNebulaMetrics(projectId);
      }
    } catch (error) {
      this.logger.error('Failed to collect project metrics:', error);
    }
  }
  
  private async collectQdrantMetrics(projectId: string): Promise<void> {
    try {
      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) return;
      
      const collectionInfo = await this.qdrantClient.getCollectionInfo(collectionName);
      if (!collectionInfo) return;
      
      // Output Prometheus format metrics
      console.log(`qdrant_collection_size_bytes{collection="${collectionName}", project_id="${projectId}"} ${collectionInfo.pointsCount}`);
      console.log(`qdrant_collection_vectors_count{collection="${collectionName}", project_id="${projectId}"} ${collectionInfo.pointsCount}`);
      
      // Additional metrics could be added here
    } catch (error) {
      this.logger.error(`Failed to collect Qdrant metrics for project ${projectId}:`, error);
    }
  }
  
  private async collectNebulaMetrics(projectId: string): Promise<void> {
    try {
      const spaceName = this.projectIdManager.getSpaceName(projectId);
      if (!spaceName) return;
      
      await this.nebulaClient.executeReadQuery(`USE ${spaceName}`);
      const result = await this.nebulaClient.executeReadQuery('SHOW STATS');
      
      // Parse results and output metrics
      // Implementation details depend on Nebula Graph's specific statistics format
      console.log(`nebula_space_stats{space="${spaceName}", project_id="${projectId}"} 1`);
    } catch (error) {
      this.logger.error(`Failed to collect Nebula metrics for project ${projectId}:`, error);
    }
  }
}