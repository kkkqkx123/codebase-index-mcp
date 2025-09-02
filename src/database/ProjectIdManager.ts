import { HashUtils } from '../utils/HashUtils';
import fs from 'fs/promises';

export class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
  private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
  private pathToProjectMap: Map<string, string> = new Map(); // projectId -> projectPath (reverse mapping)
  
 async generateProjectId(projectPath: string): Promise<string> {
    // Use SHA256 hash to generate project ID
    const directoryHash = await HashUtils.calculateDirectoryHash(projectPath);
    const projectId = directoryHash.hash.substring(0, 16);
    
    // Establish mapping relationships
    this.projectIdMap.set(projectPath, projectId);
    this.pathToProjectMap.set(projectId, projectPath);
    
    // Generate corresponding collection and space names
    const collectionName = `project-${projectId}`;
    const spaceName = `project_${projectId}`;
    
    this.collectionMap.set(projectId, collectionName);
    this.spaceMap.set(projectId, spaceName);
    
    return projectId;
  }
  
  getProjectId(projectPath: string): string | undefined {
    return this.projectIdMap.get(projectPath);
  }
  
  getProjectPath(projectId: string): string | undefined {
    return this.pathToProjectMap.get(projectId);
  }
  
  getCollectionName(projectId: string): string | undefined {
    return this.collectionMap.get(projectId);
  }
  
  getSpaceName(projectId: string): string | undefined {
    return this.spaceMap.get(projectId);
  }
  
  // Persist mapping relationships
  async saveMapping(): Promise<void> {
    const mapping = {
      projectIdMap: Object.fromEntries(this.projectIdMap),
      collectionMap: Object.fromEntries(this.collectionMap),
      spaceMap: Object.fromEntries(this.spaceMap),
      pathToProjectMap: Object.fromEntries(this.pathToProjectMap)
    };
    
    // Use configurable storage path, support different environments
    const storagePath = process.env.PROJECT_MAPPING_PATH || './data/project-mapping.json';
    await fs.writeFile(storagePath, JSON.stringify(mapping, null, 2));
  }
  
  // Load mapping relationships
  async loadMapping(): Promise<void> {
    try {
      const storagePath = process.env.PROJECT_MAPPING_PATH || './data/project-mapping.json';
      const data = await fs.readFile(storagePath, 'utf8');
      const mapping = JSON.parse(data);
      
      this.projectIdMap = new Map(Object.entries(mapping.projectIdMap));
      this.collectionMap = new Map(Object.entries(mapping.collectionMap));
      this.spaceMap = new Map(Object.entries(mapping.spaceMap));
      this.pathToProjectMap = new Map(Object.entries(mapping.pathToProjectMap || {}));
    } catch (error) {
      console.warn('Failed to load project mapping:', error);
      // If mapping file doesn't exist, initialize empty mapping
      this.projectIdMap = new Map();
      this.collectionMap = new Map();
      this.spaceMap = new Map();
      this.pathToProjectMap = new Map();
    }
  }
  
  // List all projects
  listAllProjects(): string[] {
    return Array.from(this.projectIdMap.values());
  }
  
  // Check if a project exists
  hasProject(projectPath: string): boolean {
    return this.projectIdMap.has(projectPath);
  }
  
  // Remove a project from mappings
  removeProject(projectPath: string): boolean {
    const projectId = this.projectIdMap.get(projectPath);
    if (!projectId) {
      return false;
    }
    
    this.projectIdMap.delete(projectPath);
    this.collectionMap.delete(projectId);
    this.spaceMap.delete(projectId);
    this.pathToProjectMap.delete(projectId);
    
    return true;
  }
}