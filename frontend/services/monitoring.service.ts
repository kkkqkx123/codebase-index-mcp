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