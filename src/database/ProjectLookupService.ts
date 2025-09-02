import { ProjectIdManager } from './ProjectIdManager';

export class ProjectLookupService {
  private projectIdManager: ProjectIdManager;
  
  constructor(projectIdManager: ProjectIdManager) {
    this.projectIdManager = projectIdManager;
  }
  
  async getProjectIdByCollection(collectionName: string): Promise<string | null> {
    // Parse project ID from collection name
    if (collectionName.startsWith('project-')) {
      return collectionName.substring(8); // Remove 'project-' prefix
    }
    return null;
  }
  
  async getProjectIdBySpace(spaceName: string): Promise<string | null> {
    // Parse project ID from space name
    if (spaceName.startsWith('project_')) {
      return spaceName.substring(8); // Remove 'project_' prefix
    }
    return null;
  }
  
  async getProjectPathByProjectId(projectId: string): Promise<string | null> {
    // Get project path from project ID using the project ID manager
    const projectPath = this.projectIdManager.getProjectPath(projectId);
    return projectPath || null;
  }
  
  async getProjectPathByCollection(collectionName: string): Promise<string | null> {
    const projectId = await this.getProjectIdByCollection(collectionName);
    if (!projectId) {
      return null;
    }
    return this.getProjectPathByProjectId(projectId);
  }
  
  async getProjectPathBySpace(spaceName: string): Promise<string | null> {
    const projectId = await this.getProjectIdBySpace(spaceName);
    if (!projectId) {
      return null;
    }
    return this.getProjectPathByProjectId(projectId);
  }
}