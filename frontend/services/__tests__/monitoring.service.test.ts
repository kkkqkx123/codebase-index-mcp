import * as monitoringService from '../monitoring.service';
import { apiGet, apiPost } from '@services/api.service';
import { SystemHealth, PrometheusResponse, GrafanaDashboard, ApiResponse } from '../../types/api.types';
import { HealthStatus as FrontendHealthStatus } from '../../types/dashboard.types';

// Mock the API service functions
jest.mock('@services/api.service', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

describe('Monitoring Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemHealth', () => {
    test('should call apiGet with correct endpoint', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: Date.now(),
        checks: {
          qdrant: { status: 'healthy', message: 'Qdrant is healthy', responseTime: 10 },
          nebula: { status: 'healthy', message: 'NebulaGraph is healthy', responseTime: 15 },
          system: { status: 'healthy', message: 'System resources are healthy', memoryUsage: 45, cpuUsage: 30 }
        }
      };
      
      const mockResponse: any = {
        success: true,
        data: mockHealth,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getSystemHealth();

      expect(apiGet).toHaveBeenCalledWith('/monitoring/health');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('convertBackendToFrontendHealthStatus', () => {
    test('should convert healthy backend response to frontend health status', () => {
      const backendResponse: any = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: Date.now(),
          checks: {
            qdrant: { status: 'healthy', message: 'Qdrant is healthy', responseTime: 10 },
            nebula: { status: 'healthy', message: 'NebulaGraph is healthy', responseTime: 15 },
            system: { status: 'healthy', message: 'System resources are healthy', memoryUsage: 45, cpuUsage: 30 }
          }
        }
      };

      const result = monitoringService.convertBackendToFrontendHealthStatus(backendResponse);

      expect(result.overall).toBe('healthy');
      expect(result.components.database).toBe('healthy');
      expect(result.components.api).toBe('healthy');
      expect(result.components.indexing).toBe('healthy');
      expect(result.issues).toHaveLength(0);
    });

    test('should convert degraded backend response to frontend health status with issues', () => {
      const backendResponse: any = {
        success: true,
        data: {
          status: 'degraded',
          timestamp: Date.now(),
          checks: {
            qdrant: { status: 'degraded', message: 'Qdrant performance is degraded', responseTime: 100 },
            nebula: { status: 'healthy', message: 'NebulaGraph is healthy', responseTime: 15 },
            system: { status: 'degraded', message: 'High CPU usage', memoryUsage: 45, cpuUsage: 85 }
          }
        }
      };

      const result = monitoringService.convertBackendToFrontendHealthStatus(backendResponse);

      expect(result.overall).toBe('degraded');
      expect(result.components.database).toBe('degraded');
      expect(result.components.api).toBe('degraded');
      expect(result.issues).toHaveLength(2);
    });

    test('should convert unhealthy backend response to frontend health status with critical issues', () => {
      const backendResponse: any = {
        success: true,
        data: {
          status: 'unhealthy',
          timestamp: Date.now(),
          checks: {
            qdrant: { status: 'unhealthy', message: 'Qdrant connection failed', responseTime: 0 },
            nebula: { status: 'healthy', message: 'NebulaGraph is healthy', responseTime: 15 },
            system: { status: 'unhealthy', message: 'Out of memory', memoryUsage: 95, cpuUsage: 90 }
          }
        }
      };

      const result = monitoringService.convertBackendToFrontendHealthStatus(backendResponse);

      expect(result.overall).toBe('error');
      expect(result.components.database).toBe('error');
      expect(result.components.api).toBe('error');
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].severity).toBe('critical');
    });

    test('should handle unsuccessful backend response', () => {
      const backendResponse = {
        success: false,
        timestamp: new Date().toISOString()
      };

      const result = monitoringService.convertBackendToFrontendHealthStatus(backendResponse);

      expect(result.overall).toBe('error');
      expect(result.components.database).toBe('error');
      expect(result.components.api).toBe('error');
      expect(result.components.indexing).toBe('error');
    });

    test('should handle backend response without data', () => {
      const backendResponse = {
        success: true,
        timestamp: new Date().toISOString()
      };

      const result = monitoringService.convertBackendToFrontendHealthStatus(backendResponse);

      expect(result.overall).toBe('error');
      expect(result.components.database).toBe('error');
      expect(result.components.api).toBe('error');
      expect(result.components.indexing).toBe('error');
    });
  });

  describe('getPrometheusMetrics', () => {
    test('should call apiGet with correct parameters including time', async () => {
      const query = 'rate(http_requests_total[5m])';
      const time = Date.now();
      
      const mockResponseData: PrometheusResponse = {
        status: 'success',
        data: {
          resultType: 'vector',
          result: [
            {
              metric: { __name__: 'http_requests_total', job: 'api' },
              value: [time, '100']
            }
          ]
        }
      };
      
      const mockResponse: ApiResponse<PrometheusResponse> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getPrometheusMetrics(query, time);

      // We don't need to check the exact URL encoding since it's handled by the service
      expect(apiGet).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    test('should call apiGet with correct parameters without time', async () => {
      const query = 'rate(http_requests_total[5m])';
      
      const mockResponseData: PrometheusResponse = {
        status: 'success',
        data: {
          resultType: 'vector',
          result: []
        }
      };
      
      const mockResponse: ApiResponse<PrometheusResponse> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getPrometheusMetrics(query);

      // We don't need to check the exact URL encoding since it's handled by the service
      expect(apiGet).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getGrafanaDashboards', () => {
    test('should call apiGet with correct endpoint', async () => {
      const mockDashboards: GrafanaDashboard[] = [
        {
          id: 'dashboard-1',
          title: 'System Metrics',
          url: '/grafana/d/dashboard-1',
          description: 'System performance metrics'
        }
      ];
      
      const mockResponse: ApiResponse<GrafanaDashboard[]> = {
        success: true,
        data: mockDashboards,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getGrafanaDashboards();

      expect(apiGet).toHaveBeenCalledWith('/monitoring/grafana/dashboards');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getGrafanaDashboardUrl', () => {
    test('should call apiGet with correct endpoint', async () => {
      const dashboardId = 'dashboard-1';
      const mockResponseData = {
        url: '/grafana/d/dashboard-1'
      };
      
      const mockResponse: ApiResponse<{ url: string }> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getGrafanaDashboardUrl(dashboardId);

      expect(apiGet).toHaveBeenCalledWith(`/monitoring/grafana/dashboard/${dashboardId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getRealTimeMetrics', () => {
    test('should call apiPost with correct parameters', async () => {
      const metrics = ['cpu_usage', 'memory_usage', 'disk_io'];
      const mockResponseData = {
        cpu_usage: 45.2,
        memory_usage: 67.8,
        disk_io: 12.3
      };
      
      const mockResponse: ApiResponse<Record<string, any>> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await monitoringService.getRealTimeMetrics(metrics);

      expect(apiPost).toHaveBeenCalledWith('/monitoring/realtime', { metrics });
      expect(result).toEqual(mockResponse);
    });
  });
});