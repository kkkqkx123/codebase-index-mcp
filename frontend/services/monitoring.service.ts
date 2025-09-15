// Monitoring Service for Codebase Index Frontend
// This service provides typed methods for monitoring-related API operations
// through the backend proxy endpoints

import { apiGet, apiPost } from '@services/api.service';
import {
  SystemHealth,
  PrometheusResponse,
  GrafanaDashboard,
  ApiResponse
} from '@types/api.types';
import { HealthStatus as FrontendHealthStatus, HealthIssue } from '@types/dashboard.types';

// Get monitoring base URL from environment variables
const MONITORING_BASE_URL = import.meta.env.VITE_MONITORING_BASE_URL || '/api/v1/monitoring';

/**
 * Get system health status
 * @returns Promise with system health information
 */
export const getSystemHealth = async (): Promise<ApiResponse<SystemHealth>> => {
  return apiGet<SystemHealth>('/monitoring/health');
};

/**
 * Convert backend HealthStatus to frontend HealthStatus
 * @param backendResponse - The response from the backend health endpoint
 * @returns Frontend HealthStatus object
 */
export const convertBackendToFrontendHealthStatus = (
  backendResponse: any
): FrontendHealthStatus => {
  // If the response is not successful or doesn't have data, return a default health status
  if (!backendResponse?.success || !backendResponse?.data) {
    return {
      overall: 'error',
      components: {
        database: 'error',
        indexing: 'error',
        api: 'error',
      },
      lastChecked: new Date(),
      issues: [],
    };
  }

  const backendData = backendResponse.data;
  const timestamp = new Date(backendData.timestamp);

  // Map backend status to frontend status
  const mapStatus = (status: string): 'healthy' | 'degraded' | 'error' => {
    switch (status) {
      case 'healthy': return 'healthy';
      case 'degraded': return 'degraded';
      case 'unhealthy': return 'error';
      default: return 'error';
    }
  };

  // Determine overall status
  const overallStatus = mapStatus(backendData.status);

  // Map backend checks to frontend components
  const databaseStatus = backendData.checks?.qdrant ? mapStatus(backendData.checks.qdrant.status) : 'error';
  const apiStatus = backendData.checks?.system ? mapStatus(backendData.checks.system.status) : 'error';
  // For indexing, we don't have a direct mapping, so we'll use a reasonable default
  const indexingStatus = overallStatus;

  // Create issues from check messages
  const issues: HealthIssue[] = [];
  if (backendData.checks?.qdrant?.message && backendData.checks.qdrant.status !== 'healthy') {
    issues.push({
      id: `qdrant-${timestamp.getTime()}`,
      component: 'database',
      message: backendData.checks.qdrant.message,
      severity: backendData.checks.qdrant.status === 'unhealthy' ? 'critical' : 'medium',
      timestamp: timestamp,
    });
  }
  
  if (backendData.checks?.nebula?.message && backendData.checks.nebula.status !== 'healthy') {
    issues.push({
      id: `nebula-${timestamp.getTime()}`,
      component: 'database',
      message: backendData.checks.nebula.message,
      severity: backendData.checks.nebula.status === 'unhealthy' ? 'critical' : 'medium',
      timestamp: timestamp,
    });
  }
  
  if (backendData.checks?.system?.message && backendData.checks.system.status !== 'healthy') {
    issues.push({
      id: `system-${timestamp.getTime()}`,
      component: 'api',
      message: backendData.checks.system.message,
      severity: backendData.checks.system.status === 'unhealthy' ? 'critical' : 'medium',
      timestamp: timestamp,
    });
  }

  return {
    overall: overallStatus,
    components: {
      database: databaseStatus,
      indexing: indexingStatus,
      api: apiStatus,
    },
    lastChecked: timestamp,
    issues: issues,
  };
};

/**
 * Get Prometheus metrics
 * @param query - The Prometheus query
 * @param time - Optional timestamp
 * @returns Promise with Prometheus response
 */
export const getPrometheusMetrics = async (
  query: string,
  time?: number
): Promise<ApiResponse<PrometheusResponse>> => {
  const params = new URLSearchParams();
  params.append('query', query);
  if (time) {
    params.append('time', time.toString());
  }
  
  return apiGet<PrometheusResponse>(`/monitoring/prometheus?${params.toString()}`);
};

/**
 * Get Grafana dashboards
 * @returns Promise with Grafana dashboards
 */
export const getGrafanaDashboards = async (): Promise<ApiResponse<GrafanaDashboard[]>> => {
  return apiGet<GrafanaDashboard[]>('/monitoring/grafana/dashboards');
};

/**
 * Get specific Grafana dashboard URL
 * @param dashboardId - The ID of the dashboard
 * @returns Promise with Grafana dashboard URL
 */
export const getGrafanaDashboardUrl = async (
  dashboardId: string
): Promise<ApiResponse<{ url: string }>> => {
  return apiGet<{ url: string }>(`/monitoring/grafana/dashboard/${dashboardId}`);
};

/**
 * Get real-time metrics
 * @param metrics - Array of metric names to fetch
 * @returns Promise with real-time metrics data
 */
export const getRealTimeMetrics = async (
  metrics: string[]
): Promise<ApiResponse<Record<string, any>>> => {
  return apiPost<Record<string, any>>('/monitoring/realtime', { metrics });
};