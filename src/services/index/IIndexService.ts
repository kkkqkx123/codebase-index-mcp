import { IndexOptions, SearchOptions, SearchResult, IndexStatus } from '../models/IndexTypes';
import { FileChangeEvent } from '../filesystem/ChangeDetectionService';

export interface IIndexService {
  createIndex(projectPath: string, options?: IndexOptions): Promise<void>;
  updateIndex(projectPath: string, changedFiles: string[]): Promise<void>;
  processIncrementalChanges(changes: FileChangeEvent[]): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getStatus(projectPath: string): Promise<IndexStatus>;
  deleteIndex(projectPath: string): Promise<void>;
  startIncrementalMonitoring(projectPath: string): Promise<void>;
  stopIncrementalMonitoring(projectPath: string): Promise<void>;
}