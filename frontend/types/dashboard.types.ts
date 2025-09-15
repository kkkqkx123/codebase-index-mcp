// Dashboard Data Structures
import { 
  HealthStatus as ApiHealthStatus, 
  HealthIssue as ApiHealthIssue,
  ProjectSummary as ApiProjectSummary,
  GrafanaDashboard as ApiGrafanaDashboard
} from './api.types';

export interface DashboardProps {
  refreshInterval?: number;
  showDetailedMetrics?: boolean;
}

export interface DashboardData {
  systemHealth: HealthStatus;
  projectsSummary: ProjectsSummary;
  databaseConnections: DatabaseConnections;
  performanceMetrics: PerformanceMetrics;
  grafanaDashboards: GrafanaDashboard[];
}

// Re-export types from API with Date type adjustments for frontend use
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

export interface ProjectsSummary {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  totalSize: number;
  lastUpdated: Date;
}

export interface DatabaseConnections {
  qdrant: {
    status: 'connected' | 'disconnected' | 'error';
    version?: string;
    lastChecked: Date;
  };
  nebula: {
    status: 'connected' | 'disconnected' | 'error';
    version?: string;
    lastChecked: Date;
  };
}

export interface PerformanceMetrics {
  indexingTime: {
    average: number;
    last: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  queryResponseTime: {
    average: number;
    last: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  memoryUsage: {
    current: number;
    max: number;
    percentage: number;
  };
  cpuUsage: {
    current: number;
    max: number;
    percentage: number;
  };
}

// Re-export GrafanaDashboard from API types
export type GrafanaDashboard = ApiGrafanaDashboard;