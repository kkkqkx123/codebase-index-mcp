import React, { useState, useEffect } from 'react';
import { HealthStatus, HealthIssue } from 'types/dashboard.types';
import { getSystemHealth, convertBackendToFrontendHealthStatus } from '@services/monitoring.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Card from '@components/common/Card/Card';
import './SystemHealth.module.css';

interface SystemHealthProps {
  refreshInterval?: number;
  showDetails?: boolean;
}

const SystemHealth: React.FC<SystemHealthProps> = ({
  refreshInterval = 30000,
  showDetails = false
}) => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(showDetails);

  const fetchHealthStatus = async () => {
    try {
      setError(null);
      const response = await getSystemHealth();
      const frontendHealthStatus = convertBackendToFrontendHealthStatus(response);
      if (response.success) {
        setHealthStatus(frontendHealthStatus);
      } else {
        setError(response.error || 'Failed to fetch health status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#10b981'; // green
      case 'degraded': return '#f59e0b'; // yellow
      case 'error': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'healthy': return '✓';
      case 'degraded': return '⚠';
      case 'error': return '✗';
      default: return '?';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'low': return '#3b82f6'; // blue
      case 'medium': return '#f59e0b'; // yellow
      case 'high': return '#f97316'; // orange
      case 'critical': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  if (loading) {
    return (
      <Card className="system-health-card">
        <LoadingSpinner size="sm" />
        <span>Loading system health...</span>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="system-health-card">
        <ErrorMessage
          message={error}
          onRetry={fetchHealthStatus}
          showRetry={true}
        />
      </Card>
    );
  }

  if (!healthStatus) {
    return (
      <Card className="system-health-card">
        <ErrorMessage message="No health data available" />
      </Card>
    );
  }

  return (
    <Card className="system-health-card">
      <div className="system-health-header">
        <h3>System Health</h3>
        <div
          className="overall-status"
          style={{ color: getStatusColor(healthStatus.overall) }}
        >
          <span className="status-icon">
            {getStatusIcon(healthStatus.overall)}
          </span>
          <span className="status-text">
            {healthStatus.overall.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="components-status">
        {Object.entries(healthStatus.components).map(([component, status]) => (
          <div
            key={component}
            className="component-status"
            onClick={() => setShowDetailedView(!showDetailedView)}
            style={{ cursor: 'pointer' }}
          >
            <span className="component-name">{component}</span>
            <div
              className="component-indicator"
              style={{ backgroundColor: getStatusColor(status) }}
              title={`${component}: ${status}`}
            >
              {getStatusIcon(status)}
            </div>
          </div>
        ))}
      </div>

      {showDetailedView && healthStatus.issues.length > 0 && (
        <div className="health-issues">
          <h4>Issues ({healthStatus.issues.length})</h4>
          <div className="issues-list">
            {healthStatus.issues.map((issue: HealthIssue) => (
              <div
                key={issue.id}
                className="issue-item"
                style={{ borderLeftColor: getSeverityColor(issue.severity) }}
              >
                <div className="issue-header">
                  <span className="issue-component">{issue.component}</span>
                  <span
                    className="issue-severity"
                    style={{ color: getSeverityColor(issue.severity) }}
                  >
                    {issue.severity.toUpperCase()}
                  </span>
                </div>
                <div className="issue-message">{issue.message}</div>
                <div className="issue-timestamp">
                  {new Date(issue.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="last-checked">
        Last checked: {healthStatus.lastChecked.toLocaleString()}
      </div>
    </Card>
  );
};

export default SystemHealth;