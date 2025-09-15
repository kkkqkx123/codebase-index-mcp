// Project Management Types

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  lastIndexed: Date;
  fileCount: number;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFormData {
  path: string;
  options: {
    recursive: boolean;
    includePatterns: string[];
    excludePatterns: string[];
  };
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectCreateRequest {
  path: string;
  options?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
  };
}

export interface ProjectCreateResponse {
  success: boolean;
  projectId?: string;
  error?: string;
}

export interface ProjectStatusResponse {
  projectId: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  totalFiles: number;
  processedFiles: number;
  lastUpdated: Date;
  estimatedCompletion?: Date;
}

export interface ProjectDeleteResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ProjectReindexResponse {
  success: boolean;
  projectId?: string;
  message?: string;
  error?: string;
}

export interface ProjectDetails {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  lastIndexed: Date;
  fileCount: number;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  indexingHistory: IndexingHistoryEntry[];
  configuration: ProjectConfiguration;
}

export interface IndexingHistoryEntry {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  filesProcessed: number;
  errors: string[];
}

export interface ProjectConfiguration {
  recursive: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  fileTypes: string[];
}