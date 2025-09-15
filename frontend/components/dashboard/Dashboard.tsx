import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SystemHealth from './SystemHealth/SystemHealth';
import MetricsDisplay from './MetricsDisplay/MetricsDisplay';
import GrafanaIntegration from './GrafanaIntegration/GrafanaIntegration';
import ProjectSummary from './ProjectSummary/ProjectSummary';
import Button from '@components/common/Button/Button';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import './Dashboard.module.css';

interface DashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  layout?: 'grid' | 'columns';
}

interface DashboardConfig {
  showSystemHealth: boolean;
  showMetrics: boolean;
  showGrafana: boolean;
  showProjectSummary: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  compactView: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  layout = 'grid'
}) => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DashboardConfig>({
    showSystemHealth: true,
    showMetrics: true,
    showGrafana: true,
    showProjectSummary: true,
    autoRefresh,
    refreshInterval,
    compactView: false
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('dashboard-config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(prev => ({ ...prev, ...parsedConfig }));
      } catch (error) {
        console.warn('Failed to parse saved dashboard config:', error);
      }
    }
  }, []);

  // Save configuration to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboard-config', JSON.stringify(config));
  }, [config]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!config.autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.autoRefresh, config.refreshInterval]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Trigger refresh by updating lastRefresh
    setLastRefresh(new Date());

    // Simulate refresh time
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, []);

  const handleNavigateToProjects = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  const updateConfig = (updates: Partial<DashboardConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const getGridLayout = () => {
    if (config.compactView) {
      return 'dashboard-grid dashboard-grid--compact';
    }
    return layout === 'columns' ? 'dashboard-columns' : 'dashboard-grid';
  };

  const getRefreshIntervalText = (interval: number): string => {
    if (interval < 60000) {
      return `${interval / 1000}s`;
    }
    return `${interval / 60000}m`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>Codebase Index Dashboard</h1>
          <p className="dashboard-description">
            Monitor your codebase indexing service and database health
          </p>
        </div>

        <div className="dashboard-controls">
          <div className="refresh-info">
            <span className="last-refresh">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            {config.autoRefresh && (
              <span className="auto-refresh-indicator">
                🔄 Auto-refresh: {getRefreshIntervalText(config.refreshInterval)}
              </span>
            )}
          </div>

          <div className="control-buttons">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              aria-label="Manually refresh dashboard"
            >
              {isRefreshing ? <LoadingSpinner size="sm" /> : '↻'}
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              aria-label="Dashboard configuration"
              className={isConfigOpen ? 'active' : ''}
            >
              ⚙️ Config
            </Button>
          </div>
        </div>
      </div>

      {isConfigOpen && (
        <div className="dashboard-config">
          <div className="config-section">
            <h3>Display Options</h3>
            <div className="config-options">
              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.showSystemHealth}
                  onChange={(e) => updateConfig({ showSystemHealth: e.target.checked })}
                />
                <span>System Health</span>
              </label>

              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.showMetrics}
                  onChange={(e) => updateConfig({ showMetrics: e.target.checked })}
                />
                <span>Performance Metrics</span>
              </label>

              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.showGrafana}
                  onChange={(e) => updateConfig({ showGrafana: e.target.checked })}
                />
                <span>Grafana Dashboards</span>
              </label>

              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.showProjectSummary}
                  onChange={(e) => updateConfig({ showProjectSummary: e.target.checked })}
                />
                <span>Project Summary</span>
              </label>
            </div>
          </div>

          <div className="config-section">
            <h3>Refresh Settings</h3>
            <div className="config-options">
              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.autoRefresh}
                  onChange={(e) => updateConfig({ autoRefresh: e.target.checked })}
                />
                <span>Auto-refresh</span>
              </label>

              <label className="config-option">
                <span>Refresh interval:</span>
                <select
                  value={config.refreshInterval}
                  onChange={(e) => updateConfig({ refreshInterval: parseInt(e.target.value) })}
                  disabled={!config.autoRefresh}
                >
                  <option value={15000}>15 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </label>
            </div>
          </div>

          <div className="config-section">
            <h3>Layout Options</h3>
            <div className="config-options">
              <label className="config-option">
                <input
                  type="checkbox"
                  checked={config.compactView}
                  onChange={(e) => updateConfig({ compactView: e.target.checked })}
                />
                <span>Compact View</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className={getGridLayout()}>
        {config.showSystemHealth && (
          <div className="dashboard-component dashboard-component--system-health">
            <SystemHealth
              refreshInterval={config.refreshInterval}
              showDetails={!config.compactView}
            />
          </div>
        )}

        {config.showProjectSummary && (
          <div className="dashboard-component dashboard-component--project-summary">
            <ProjectSummary
              refreshInterval={config.refreshInterval}
              showDetailedStats={!config.compactView}
              onNavigateToProjects={handleNavigateToProjects}
            />
          </div>
        )}

        {config.showMetrics && (
          <div className="dashboard-component dashboard-component--metrics">
            <MetricsDisplay
              refreshInterval={config.refreshInterval}
              showTrends={!config.compactView}
            />
          </div>
        )}

        {config.showGrafana && (
          <div className="dashboard-component dashboard-component--grafana">
            <GrafanaIntegration
              autoRefresh={config.autoRefresh}
              refreshInterval={config.refreshInterval * 10} // Refresh Grafana less frequently
              showDescriptions={!config.compactView}
            />
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="dashboard-footer">
        <div className="quick-actions">
          <Button
            variant="primary"
            onClick={() => navigate('/projects')}
          >
            📁 Manage Projects
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/search')}
          >
            🔍 Search Code
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/graph')}
          >
            🔗 View Graph
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/debug')}
          >
            🔧 Debug Tools
          </Button>
        </div>

        <div className="dashboard-info">
          <span>
            Codebase Index MCP Service •
            {config.autoRefresh ? ' Auto-refresh enabled' : ' Manual refresh only'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;