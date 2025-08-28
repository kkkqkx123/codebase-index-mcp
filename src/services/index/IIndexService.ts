import { IndexOptions, SearchOptions, SearchResult, IndexStatus } from '../models/IndexTypes';

export interface IIndexService {
  createIndex(projectPath: string, options?: IndexOptions): Promise<void>;
  updateIndex(filePath: string): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getStatus(projectPath: string): Promise<IndexStatus>;
  deleteIndex(projectPath: string): Promise<void>;
}