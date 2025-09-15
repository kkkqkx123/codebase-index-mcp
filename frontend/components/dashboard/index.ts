// Dashboard Components Exports
export { default as Dashboard } from './Dashboard';
export { default as SystemHealth } from './SystemHealth/SystemHealth';
export { default as MetricsDisplay } from './MetricsDisplay/MetricsDisplay';
export { default as GrafanaIntegration } from './GrafanaIntegration/GrafanaIntegration';
export { default as ProjectSummary } from './ProjectSummary/ProjectSummary';

// Re-export types
export type {
  DashboardProps,
  DashboardData,
  HealthStatus,
  HealthIssue,
  ProjectsSummary,
  DatabaseConnections,
  PerformanceMetrics,
  GrafanaDashboard
} from 'types/dashboard.types';