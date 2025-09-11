export interface IndexOptions {
  recursive?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkSize?: number;
  overlapSize?: number;
  batchSize?: number;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  includeGraph?: boolean;
  filters?: SearchFilter[];
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  metadata: CodeMetadata;
  graphData?: GraphData;
}

export interface CodeMetadata {
  id: string;
  filePath: string;
  language: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'export';
  name?: string;
  lineStart: number;
  lineEnd: number;
  dependencies?: string[];
  exports?: string[];
  imports?: string[];
  content: string;
  astPath: string;
  nodeType: string;
  parentType: string;
  children: string[];
  metadata: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

export interface IndexStatus {
  isIndexing: boolean;
  lastIndexed: Date | null;
  fileCount: number;
  totalFiles: number;
  errorCount: number;
  lastError?: string;
}