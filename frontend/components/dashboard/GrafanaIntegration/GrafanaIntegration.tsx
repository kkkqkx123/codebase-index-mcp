import React, { useState, useEffect } from 'react';
import { GrafanaDashboard } from 'types/dashboard.types';
import { getGrafanaDashboards, getGrafanaDashboardUrl } from '@services/monitoring.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Card from '@components/common/Card/Card';
import Button from '@components/common/Button/Button';
import './GrafanaIntegration.module.css';

interface GrafanaIntegrationProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  showDescriptions?: boolean;
}

interface DashboardCardProps {
  dashboard: GrafanaDashboard;
  onOpen: (dashboard: GrafanaDashboard) => void;
  showDescription?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  dashboard,
  onOpen,
  showDescription = true
}) => {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      await onOpen(dashboard);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h4 className="dashboard-title">{dashboard.title}</h4>
        <div className="dashboard-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpen}
            disabled={loading}
            aria-label={`Open ${dashboard.title} dashboard`}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Open'}
          </Button>
        </div>
      </div>

      {showDescription && dashboard.description && (
        <div className="dashboard-description">
          {dashboard.description}
        </div>
      )}

      <div className="dashboard-meta">
        <span className="dashboard-id">ID: {dashboard.id}</span>
        <span className="dashboard-status">
          <span className="status-indicator active" />
          Available
        </span>
      </div>
    </div>
  );
};

const GrafanaIntegration: React.FC<GrafanaIntegrationProps> = ({
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  showDescriptions = true
}) => {
  const [dashboards, setDashboards] = useState<GrafanaDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchDashboards = async () => {
    try {
      setError(null);
      const response = await getGrafanaDashboards();
      if (response.success && response.data) {
        setDashboards(response.data);
      } else {
        setError(response.error || 'Failed to fetch Grafana dashboards');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDashboard = async (dashboard: GrafanaDashboard) => {
    try {
      // Get the authenticated URL for the dashboard
      const urlResponse = await getGrafanaDashboardUrl(dashboard.id);
      if (urlResponse.success && urlResponse.data) {
        // Open in new tab/window
        window.open(urlResponse.data.url, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback to the dashboard's original URL
        window.open(dashboard.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open dashboard:', err);
      // Fallback to the dashboard's original URL
      window.open(dashboard.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getDashboardCategories = (): string[] => {
    const categories = new Set<string>();
    dashboards.forEach(dashboard => {
      // Extract category from dashboard title or ID
      const category = dashboard.title.split('-')[0].toLowerCase().trim();
      categories.add(category);
    });
    return ['all', ...Array.from(categories).sort()];
  };

  const getFilteredDashboards = (): GrafanaDashboard[] => {
    if (selectedCategory === 'all') {
      return dashboards;
    }

    return dashboards.filter(dashboard =>
      dashboard.title.toLowerCase().includes(selectedCategory) ||
      dashboard.id.toLowerCase().includes(selectedCategory)
    );
  };

  useEffect(() => {
    fetchDashboards();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboards, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <Card className="grafana-integration-card">
        <div className="loading-container">
          <LoadingSpinner size="md" />
          <span>Loading Grafana dashboards...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="grafana-integration-card">
        <ErrorMessage
          message={error}
          onRetry={fetchDashboards}
          showRetry={true}
        />
      </Card>
    );
  }

  const filteredDashboards = getFilteredDashboards();
  const categories = getDashboardCategories();

  return (
    <Card className="grafana-integration-card">
      <div className="grafana-header">
        <div className="header-title">
          <h3>Grafana Dashboards</h3>
          <span className="dashboard-count">
            {filteredDashboards.length} dashboard{filteredDashboards.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="header-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboards}
            aria-label="Refresh dashboards"
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      {categories.length > 2 && (
        <div className="category-filter">
          <label htmlFor="category-select" className="filter-label">
            Category:
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredDashboards.length === 0 ? (
        <div className="no-dashboards">
          <p>No Grafana dashboards available</p>
          <Button
            variant="primary"
            onClick={fetchDashboards}
          >
            Try Again
          </Button>
        </div>
      ) : (
        <div className="dashboards-grid">
          {filteredDashboards.map((dashboard) => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              onOpen={handleOpenDashboard}
              showDescription={showDescriptions}
            />
          ))}
        </div>
      )}

      <div className="grafana-footer">
        <p className="footer-note">
          Dashboards open in new tab with authenticated access
        </p>
        {autoRefresh && (
          <p className="refresh-info">
            Auto-refreshing every {Math.floor(refreshInterval / 60000)} minutes
          </p>
        )}
      </div>
    </Card>
  );
};

export default GrafanaIntegration;