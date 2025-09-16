import React, { useState, useEffect } from 'react';
import { ProjectsSummary, DatabaseConnections } from 'types/dashboard.types';
import { getSystemHealth, getProjectStats } from '@services/monitoring.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Card from '@components/common/Card/Card';
import Button from '@components/common/Button/Button';
import './ProjectSummary.module.css';

interface ProjectSummaryProps {
  refreshInterval?: number;
  showDetailedStats?: boolean;
  onNavigateToProjects?: () => void;
}

interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  color = 'primary',
  onClick
}) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toString();
  };

  const getTrendIcon = (): string => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '';
    }
  };

  const getTrendColor = (): string => {
    switch (trend) {
      case 'up': return '#10b981'; // green
      case 'down': return '#ef4444'; // red
      case 'stable': return '#6b7280'; // gray
      default: return 'inherit';
    }
  };

  return (
    <div
      className={`stat-card stat-card--${color} ${onClick ? 'stat-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="stat-card-header">
        <div className="stat-title">
          {icon && <span className="stat-icon">{icon}</span>}
          {title}
        </div>
        {trend && (
          <span
            className="stat-trend"
            style={{ color: getTrendColor() }}
            title={`Trend: ${trend}`}
          >
            {getTrendIcon()}
          </span>
        )}
      </div>

      <div className="stat-value">
        <span className="value">{formatValue(value)}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
};

interface DatabaseStatusProps {
  connections: DatabaseConnections;
}

const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ connections }) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return '#10b981'; // green
      case 'disconnected': return '#f59e0b'; // yellow
      case 'error': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'connected': return '●';
      case 'disconnected': return '○';
      case 'error': return '✗';
      default: return '?';
    }
  };

  return (
    <div className="database-status">
      <h4>Database Connections</h4>
      <div className="database-list">
        <div className="database-item">
          <div className="database-info">
            <span className="database-name">Qdrant (Vector)</span>
            {connections.qdrant.version && (
              <span className="database-version">v{connections.qdrant.version}</span>
            )}
          </div>
          <div className="database-status-indicator">
            <span
              className="status-dot"
              style={{ color: getStatusColor(connections.qdrant.status) }}
            >
              {getStatusIcon(connections.qdrant.status)}
            </span>
            <span className="status-text">{connections.qdrant.status}</span>
          </div>
        </div>

        <div className="database-item">
          <div className="database-info">
            <span className="database-name">Nebula (Graph)</span>
            {connections.nebula.version && (
              <span className="database-version">v{connections.nebula.version}</span>
            )}
          </div>
          <div className="database-status-indicator">
            <span
              className="status-dot"
              style={{ color: getStatusColor(connections.nebula.status) }}
            >
              {getStatusIcon(connections.nebula.status)}
            </span>
            <span className="status-text">{connections.nebula.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectSummary: React.FC<ProjectSummaryProps> = ({
  refreshInterval = 30000,
  showDetailedStats = true,
  onNavigateToProjects
}) => {
  const [projectSummary, setProjectSummary] = useState<ProjectsSummary | null>(null);
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnections | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get system health data
      const healthResponse = await getSystemHealth();
      
      // Get project statistics
      const projectStatsResponse = await getProjectStats();
      
      if (healthResponse.success && healthResponse.data) {
        let projectSummary: ProjectsSummary;
        
        if (projectStatsResponse.success && projectStatsResponse.data) {
          // Use real project statistics data
          const stats = projectStatsResponse.data;
          projectSummary = {
            totalProjects: stats.totalProjects,
            activeProjects: stats.activeProjects,
            totalFiles: stats.totalFiles,
            totalSize: stats.storageUsed,
            lastUpdated: new Date(stats.lastUpdated),
          };
        } else {
          // Fallback to mock data if real data is not available
          console.warn('Failed to fetch project statistics, using fallback data:', projectStatsResponse.error);
          projectSummary = {
            totalProjects: 0,
            activeProjects: 0,
            totalFiles: 0,
            totalSize: 0,
            lastUpdated: new Date(),
          };
        }

        // Extract database connection info from health data
        const healthData = healthResponse.data;
        const databaseConnections: DatabaseConnections = {
          qdrant: {
            status: healthData.checks.qdrant.status === 'healthy' ? 'connected' : 
                    healthData.checks.qdrant.status === 'degraded' ? 'error' : 'disconnected',
            version: healthData.checks.qdrant.status === 'healthy' ? '1.8.0' : undefined,
            lastChecked: new Date(healthData.timestamp),
          },
          nebula: {
            status: healthData.checks.nebula.status === 'healthy' ? 'connected' : 
                    healthData.checks.nebula.status === 'degraded' ? 'error' : 'disconnected',
            version: healthData.checks.nebula.status === 'healthy' ? '3.7.0' : undefined,
            lastChecked: new Date(healthData.timestamp),
          },
        };

        setProjectSummary(projectSummary);
        setDatabaseConnections(databaseConnections);
      } else {
        throw new Error(healthResponse.error || 'Failed to fetch system health data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch project data';
      setError(errorMessage);
      console.error('Error fetching project data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): { value: number; unit: string } => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return {
      value: Math.round(value * 100) / 100,
      unit: units[unitIndex]
    };
  };

  const handleNavigateToProjects = () => {
    if (onNavigateToProjects) {
      onNavigateToProjects();
    } else {
      // Default navigation using window.location
      window.location.href = '/projects';
    }
  };

  useEffect(() => {
    fetchProjectData();
    const interval = setInterval(fetchProjectData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading) {
    return (
      <Card className="project-summary-card">
        <div className="loading-container">
          <LoadingSpinner size="md" />
          <span>Loading project summary...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="project-summary-card">
        <ErrorMessage
          message={error}
          onRetry={fetchProjectData}
          showRetry={true}
        />
      </Card>
    );
  }

  if (!projectSummary || !databaseConnections) {
    return (
      <Card className="project-summary-card">
        <ErrorMessage message="No project data available" />
      </Card>
    );
  }

  const formattedSize = formatBytes(projectSummary.totalSize);

  return (
    <Card className="project-summary-card">
      <div className="project-summary-header">
        <h3>Project Overview</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={handleNavigateToProjects}
          aria-label="Navigate to project management"
        >
          Manage Projects
        </Button>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Total Projects"
          value={projectSummary.totalProjects}
          icon="📁"
          color="primary"
          onClick={handleNavigateToProjects}
        />

        <StatCard
          title="Active Projects"
          value={projectSummary.activeProjects}
          icon="🔄"
          color="success"
          trend="stable"
          onClick={handleNavigateToProjects}
        />

        <StatCard
          title="Total Files"
          value={projectSummary.totalFiles}
          icon="📄"
          color="primary"
          trend="up"
        />

        <StatCard
          title="Storage Used"
          value={formattedSize.value}
          unit={formattedSize.unit}
          icon="💾"
          color="warning"
          trend="up"
        />
      </div>

      {showDetailedStats && databaseConnections && (
        <DatabaseStatus connections={databaseConnections} />
      )}

      <div className="project-summary-footer">
        <p className="last-updated">
          Last updated: {new Date(projectSummary.lastUpdated).toLocaleString()}
        </p>
      </div>
    </Card>
  );
};

export default ProjectSummary;