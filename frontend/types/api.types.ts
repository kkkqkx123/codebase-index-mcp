// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Health Status Types
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'error';
  components: {
    database: 'healthy' | 'degraded' | 'error';
    indexing: 'healthy' | 'degraded' | 'error';
    api: 'healthy' | 'degraded' | 'error';
  };
  lastChecked: Date;
  issues: HealthIssue[];
}

export interface HealthIssue {
  id: string;
  component: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
}

// Indexing Types
export interface IndexResponse {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  processingTime: number;
  errors: string[];
}

export interface ProjectStatus {
  projectId: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  totalFiles: number;
  processedFiles: number;
  lastUpdated: Date;
  estimatedCompletion?: Date;
}

// Search Types
export interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  similarity: number;
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    chunkType: string;
  };
}

export interface SearchResults {
  results: SearchResult[];
  total: number;
  timestamp: string;
}

export interface SearchQuery {
  text: string;
  projectId?: string;
  fileTypes?: string[];
  limit: number;
  threshold: number;
  includeGraph: boolean;
}

// Graph Types
export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'variable';
  x: number;
  y: number;
  metadata: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends' | 'implements';
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    layout: string;
    renderingTime: number;
  };
}

// Project Types
export interface ProjectSummary {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  totalSize: number;
  lastUpdated: Date;
}

// Monitoring Types
export interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'error';
  components: {
    database: 'healthy' | 'degraded' | 'error';
    indexing: 'healthy' | 'degraded' | 'error';
    api: 'healthy' | 'degraded' | 'error';
  };
  lastChecked: string;
}

export interface GrafanaDashboard {
  id: string;
  title: string;
  url: string;
  description?: string;
}

// Error Types
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  userMessage: string;
  action?: string;
}