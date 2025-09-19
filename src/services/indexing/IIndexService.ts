import { SearchOptions, IndexOptions, IndexResult, IndexStatus } from './IndexService';

export interface IIndexService {
  createIndex(projectPath: string, options?: IndexOptions): Promise<IndexResult>;
  search(query: string, projectId: string, options?: SearchOptions): Promise<any[]>;
  searchSnippets(query: string, projectId: string, options?: SearchOptions): Promise<any[]>;
  getStatus(projectPath: string): Promise<IndexStatus>;
  updateIndex(projectPath: string, changedFiles: string[]): Promise<IndexResult>;
  deleteIndex(projectPath: string): Promise<boolean>;
}