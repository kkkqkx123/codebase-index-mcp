import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaService } from '../NebulaService';

export interface GraphConfig {
  partitionNum?: number;
  replicaFactor?: number;
  vidType?: string;
}

export interface SpaceInfo {
  name: string;
  partition_num: number;
  replica_factor: number;
  vid_type: string;
  charset: string;
  collate: string;
}

@injectable()
export class NebulaSpaceManager {
  private nebulaService: NebulaService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService
  ) {
    this.nebulaService = nebulaService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  private generateSpaceName(projectId: string): string {
    return `project_${projectId}`;
  }

  async createSpace(projectId: string, config: GraphConfig): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // 创建空间
      const createQuery = `
        CREATE SPACE IF NOT EXISTS ${spaceName} (
          partition_num = ${config.partitionNum || 10},
          replica_factor = ${config.replicaFactor || 1},
          vid_type = ${config.vidType || 'FIXED_STRING(32)'}
        )
      `;

      await this.nebulaService.executeWriteQuery(createQuery);

      // 等待空间创建完成
      await this.waitForSpaceReady(spaceName);

      // 使用空间
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);

      // 创建图结构
      await this.createGraphSchema();

      this.logger.info(`Successfully created space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create space ${spaceName}:`, error);
      return false;
    }
  }

  async deleteSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      await this.nebulaService.executeWriteQuery(`DROP SPACE IF EXISTS ${spaceName}`);
      this.logger.info(`Successfully deleted space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete space ${spaceName}:`, error);
      return false;
    }
  }

  async listSpaces(): Promise<string[]> {
    try {
      const result = await this.nebulaService.executeReadQuery('SHOW SPACES');
      return result.data.map((row: any) => row.Name || row.name);
    } catch (error) {
      this.logger.error('Failed to list spaces:', error);
      return [];
    }
  }

  async getSpaceInfo(projectId: string): Promise<SpaceInfo | null> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const result = await this.nebulaService.executeReadQuery(`DESCRIBE SPACE ${spaceName}`);
      if (result && result.data && result.data.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get space info for ${spaceName}:`, error);
      return null;
    }
  }

  async checkSpaceExists(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const spaces = await this.listSpaces();
      return spaces.includes(spaceName);
    } catch (error) {
      this.logger.error(`Failed to check if space ${spaceName} exists:`, error);
      return false;
    }
  }

  private async waitForSpaceReady(spaceName: string, maxRetries: number = 30, retryDelay: number = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.nebulaService.executeReadQuery(`DESCRIBE SPACE ${spaceName}`);
        if (result && result.data && result.data.length > 0) {
          return;
        }
      } catch (error) {
        // Space not ready yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Space ${spaceName} did not become ready within ${maxRetries} retries`);
  }

  private async createGraphSchema(): Promise<void> {
    try {
      // 创建标签（Tags）
      const tagQueries = [
        'CREATE TAG IF NOT EXISTS Project(id string, name string, createdAt string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS File(id string, path string, relativePath string, name string, language string, size int, hash string, linesOfCode int, functions int, classes int, lastModified string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Function(id string, name string, content string, startLine int, endLine int, complexity int, parameters string, returnType string, language string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Class(id string, name string, content string, startLine int, endLine int, methods int, properties int, inheritance string, language string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Import(id string, module string, updatedAt string)'
      ];

      for (const query of tagQueries) {
        await this.nebulaService.executeWriteQuery(query);
      }

      // 创建边类型（Edge Types）
      const edgeQueries = [
        'CREATE EDGE IF NOT EXISTS BELONGS_TO()',
        'CREATE EDGE IF NOT EXISTS CONTAINS()',
        'CREATE EDGE IF NOT EXISTS IMPORTS()',
        'CREATE EDGE IF NOT EXISTS CALLS()',
        'CREATE EDGE IF NOT EXISTS EXTENDS()',
        'CREATE EDGE IF NOT EXISTS IMPLEMENTS()'
      ];

      for (const query of edgeQueries) {
        await this.nebulaService.executeWriteQuery(query);
      }

      this.logger.info('Graph schema created successfully');
    } catch (error) {
      this.logger.error('Failed to create graph schema:', error);
      throw error;
    }
  }

  async clearSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // First, get all tags in the space
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);
      const tagsResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const tags = tagsResult.data.map((row: any) => row.Name || row.name);

      // Delete all edges first
      const edgesResult = await this.nebulaService.executeReadQuery('SHOW EDGES');
      const edges = edgesResult.data.map((row: any) => row.Name || row.name);
      
      for (const edge of edges) {
        await this.nebulaService.executeWriteQuery(`DELETE EDGE ${edge} * -> *`);
      }

      // Delete all vertices
      for (const tag of tags) {
        await this.nebulaService.executeWriteQuery(`DELETE VERTEX * WITH EDGE`);
      }

      this.logger.info(`Successfully cleared space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to clear space ${spaceName}:`, error);
      return false;
    }
  }

  async getSpaceSize(projectId: string): Promise<number> {
    try {
      const info = await this.getSpaceInfo(projectId);
      // This is a simplified implementation - in a real scenario, you would need
      // to query Nebula Graph for actual space size statistics
      return info ? 1 : 0;
    } catch (error) {
      this.logger.error(`Failed to get space size for project ${projectId}:`, error);
      return 0;
    }
  }
}