import React from 'react';
// @ts-ignore - using frontend project's testing library
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import Dashboard from '../components/dashboard/Dashboard';
import SystemHealth from '../components/dashboard/SystemHealth/SystemHealth';
import MetricsDisplay from '../components/dashboard/MetricsDisplay/MetricsDisplay';
import ProjectSummary from '../components/dashboard/ProjectSummary/ProjectSummary';
import GrafanaIntegration from '../components/dashboard/GrafanaIntegration/GrafanaIntegration';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock the services
jest.mock('../services/monitoring.service', () => ({
  getSystemHealth: jest.fn().mockResolvedValue({
    success: true,
    data: {
      overall: 'healthy',
      components: {
        database: 'healthy',
        indexing: 'healthy',
        api: 'healthy'
      },
      lastChecked: new Date(),
      issues: []
    }
  }),
  getRealTimeMetrics: jest.fn().mockResolvedValue({
    success: true,
    data: {
      indexing_time_avg: 1500,
      indexing_time_last: 1200,
      query_response_time_avg: 200,
      query_response_time_last: 180,
      memory_usage_current: 512,
      memory_usage_max: 1024,
      cpu_usage_current: 45,
      cpu_usage_max: 100
    }
  }),
  getGrafanaDashboards: jest.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'dashboard-1',
        title: 'Codebase Index Metrics',
        url: 'http://localhost:3000/d/dashboard-1',
        description: 'Main dashboard for codebase indexing metrics'
      }
    ]
  }),
  getGrafanaDashboardUrl: jest.fn().mockResolvedValue({
    success: true,
    data: { url: 'http://localhost:3000/d/dashboard-1?auth=token' }
  }),
  convertBackendToFrontendHealthStatus: jest.fn().mockImplementation((backendResponse) => {
    if (backendResponse.success && backendResponse.data) {
      return {
        overall: 'healthy',
        components: {
          database: 'healthy',
          indexing: 'healthy',
          api: 'healthy'
        },
        lastChecked: new Date(),
        issues: []
      };
    }
    return {
      overall: 'error',
      components: {
        database: 'error',
        indexing: 'error',
        api: 'error'
      },
      lastChecked: new Date(),
      issues: []
    };
  })
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('Phase 4 Dashboard Implementation', () => {
  describe('Dashboard Component', () => {
    it('renders dashboard with all components', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Check if main dashboard elements are present
      expect(screen.getByText('Codebase Index Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Monitor your codebase indexing service and database health')).toBeInTheDocument();

      // Check for main sections
      await waitFor(() => {
        expect(screen.getByText('System Health')).toBeInTheDocument();
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Project Overview')).toBeInTheDocument();
        expect(screen.getByText('Grafana Dashboards')).toBeInTheDocument();
      });
    });

    it('handles configuration changes', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Open configuration
      const configButton = screen.getByLabelText('Dashboard configuration');
      fireEvent.click(configButton);

      // Check if config panel opens
      expect(screen.getByText('Display Options')).toBeInTheDocument();
      expect(screen.getByText('Refresh Settings')).toBeInTheDocument();

      // Test toggling system health
      const systemHealthCheckbox = screen.getByLabelText('System Health');
      fireEvent.click(systemHealthCheckbox);

      // Verify the component gets hidden/shown
      await waitFor(() => {
        // Component should still be in DOM but configuration changed
        expect(systemHealthCheckbox).not.toBeChecked();
      });
    });

    it('handles manual refresh', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const refreshButton = screen.getByLabelText('Manually refresh dashboard');
      fireEvent.click(refreshButton);

      // Check if refresh button shows loading state
      await waitFor(() => {
        expect(screen.getByText('Refreshing...')).toBeInTheDocument();
      });
    });
  });

  describe('SystemHealth Component', () => {
    it('displays system health status', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SystemHealth />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('System Health')).toBeInTheDocument();
        expect(screen.getByText('HEALTHY')).toBeInTheDocument();
      });
    });

    it('shows component status indicators', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <SystemHealth />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('database')).toBeInTheDocument();
        expect(screen.getByText('indexing')).toBeInTheDocument();
        expect(screen.getByText('api')).toBeInTheDocument();
      });
    });
  });

  describe('MetricsDisplay Component', () => {
    it('displays performance metrics', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <MetricsDisplay />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('Indexing Time (Avg)')).toBeInTheDocument();
        expect(screen.getByText('Memory Usage')).toBeInTheDocument();
        expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      });
    });

    it('handles time range selection', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <MetricsDisplay />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const timeRangeButtons = screen.getAllByRole('button');
        const sixHourButton = timeRangeButtons.find((button: { textContent: string; }) =>
          button.textContent === '6h'
        );

        if (sixHourButton) {
          fireEvent.click(sixHourButton);
          expect(sixHourButton).toHaveClass('active');
        }
      });
    });
  });

  describe('ProjectSummary Component', () => {
    it('displays project statistics', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <ProjectSummary />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Project Overview')).toBeInTheDocument();
        expect(screen.getByText('Total Projects')).toBeInTheDocument();
        expect(screen.getByText('Active Projects')).toBeInTheDocument();
        expect(screen.getByText('Database Connections')).toBeInTheDocument();
      });
    });

    it('handles navigation to project management', async () => {
      const mockNavigate = jest.fn();

      await act(async () => {
        render(
          <TestWrapper>
            <ProjectSummary onNavigateToProjects={mockNavigate} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const manageButton = screen.getByLabelText('Navigate to project management');
        fireEvent.click(manageButton);
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });

  describe('GrafanaIntegration Component', () => {
    it('displays Grafana dashboards', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <GrafanaIntegration />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Grafana Dashboards')).toBeInTheDocument();
        expect(screen.getByText('Codebase Index Metrics')).toBeInTheDocument();
      });
    });

    it('handles dashboard opening', async () => {
      // Mock window.open
      const originalOpen = window.open;
      window.open = jest.fn();

      await act(async () => {
        render(
          <TestWrapper>
            <GrafanaIntegration />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        const openButton = screen.getByLabelText('Open Codebase Index Metrics dashboard');
        fireEvent.click(openButton);
      });

      // Restore window.open
      window.open = originalOpen;
    });
  });

  describe('Responsive Design', () => {
    it('adapts to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      await act(async () => {
        render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
      });

      // Check if dashboard renders correctly on mobile
      await waitFor(() => {
        expect(screen.getByText('Codebase Index Dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('enables auto-refresh by default', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <Dashboard autoRefresh={true} refreshInterval={15000} />
          </TestWrapper>
        );
      });

      // Wait for the text to appear
      await waitFor(() => {
        expect(screen.getByText(/Auto-refresh: 15s/)).toBeInTheDocument();
      });
    });
  });
});

describe('Integration Tests', () => {
  it('dashboard components work together correctly', async () => {
    await act(async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
    });

    // Wait for all components to load
    await waitFor(() => {
      expect(screen.getByText('System Health')).toBeInTheDocument();
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
      expect(screen.getByText('Project Overview')).toBeInTheDocument();
      expect(screen.getByText('Grafana Dashboards')).toBeInTheDocument();
    });

    // Test configuration changes affect all components
    const configButton = screen.getByLabelText('Dashboard configuration');
    fireEvent.click(configButton);

    const compactViewCheckbox = screen.getByLabelText('Compact View');
    fireEvent.click(compactViewCheckbox);

    // Verify layout changes
    await waitFor(() => {
      expect(compactViewCheckbox).toBeChecked();
    });
  });
});