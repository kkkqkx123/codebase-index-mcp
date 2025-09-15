import React, { useState, useEffect, useCallback } from 'react';
import { IndexingProgress as IndexingProgressType, IndexingStats } from '../../../types/project.types';
import { getIndexingProgress, getIndexingStats } from '@services/project.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Card from '@components/common/Card/Card';
import Button from '@components/common/Button/Button';
import './IndexingProgress.module.css';

interface IndexingProgressProps {
  projectId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onComplete?: (projectId: string) => void;
  onError?: (projectId: string, error: string) => void;
  showDetailedStats?: boolean;
}

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  color = 'primary',
  showPercentage = true
}) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const getColorClass = (color: string): string => {
    switch (color) {
      case 'success': return 'progress-bar--success';
      case 'warning': return 'progress-bar--warning';
      case 'error': return 'progress-bar--error';
      default: return 'progress-bar--primary';
    }
  };

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-label">{label}</span>
        {showPercentage && (
          <span className="progress-percentage">{percentage.toFixed(1)}%</span>
        )}
      </div>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${getColorClass(color)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="progress-bar-values">
        <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, unit, trend, icon }) => {
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

  return (
    <div className="stats-card">
      <div className="stats-card-header">
        {icon && <span className="stats-icon">{icon}</span>}
        <span className="stats-title">{title}</span>
        {trend && (
          <span
            className="stats-trend"
            style={{ color: getTrendColor() }}
            title={`Trend: ${trend}`}
          >
            {getTrendIcon()}
          </span>
        )}
      </div>
      <div className="stats-value">
        <span className="value">{formatValue(value)}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
};

const IndexingProgress: React.FC<IndexingProgressProps> = ({
  projectId,
  autoRefresh = true,
  refreshInterval = 2000, // 2 seconds for real-time updates
  onComplete,
  onError,
  showDetailedStats = true
}) => {
  const [progress, setProgress] = useState<IndexingProgressType | null>(null);
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchProgress = useCallback(async () => {
    try {
      setError(null);
      const response = await getIndexingProgress(projectId);
      if (response.success && response.data) {
        const newProgress = response.data;
        setProgress(newProgress);
        setLastUpdate(new Date());

        // Check if indexing is complete
        if (newProgress.status === 'completed' && onComplete) {
          onComplete(projectId);
        }

        // Check if indexing failed
        if (newProgress.status === 'failed' && onError && newProgress.error) {
          onError(projectId, newProgress.error);
        }
      } else {
        throw new Error(response.error || 'Failed to fetch indexing progress');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      if (onError) {
        onError(projectId, errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, onComplete, onError]);

  const fetchStats = useCallback(async () => {
    if (!showDetailedStats) return;

    try {
      const response = await getIndexingStats(projectId);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      // Stats are optional, don't show error if they fail
      console.warn('Failed to fetch indexing stats:', err);
    }
  }, [projectId, showDetailedStats]);

  const calculateETA = (): string | null => {
    if (!progress || progress.totalFiles === 0 || progress.processedFiles === 0) {
      return null;
    }

    const rate = progress.processedFiles / (Date.now() - new Date(progress.startTime).getTime());
    const remaining = progress.totalFiles - progress.processedFiles;
    const etaMs = remaining / rate;

    if (etaMs <= 0 || !isFinite(etaMs)) {
      return null;
    }

    const etaSeconds = Math.floor(etaMs / 1000);

    if (etaSeconds < 60) {
      return `${etaSeconds}s`;
    } else if (etaSeconds < 3600) {
      return `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`;
    } else {
      const hours = Math.floor(etaSeconds / 3600);
      const minutes = Math.floor((etaSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const getProgressColor = (): 'primary' | 'success' | 'warning' | 'error' => {
    if (!progress) return 'primary';

    switch (progress.status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'paused': return 'warning';
      default: return 'primary';
    }
  };

  const getStatusIcon = (): string => {
    if (!progress) return '⏳';

    switch (progress.status) {
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'paused': return '⏸️';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  useEffect(() => {
    fetchProgress();
    if (showDetailedStats) {
      fetchStats();
    }

    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchProgress();
        if (showDetailedStats) {
          fetchStats();
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [fetchProgress, fetchStats, autoRefresh, refreshInterval, showDetailedStats]);

  if (loading) {
    return (
      <Card className="indexing-progress-container">
        <div className="loading-container">
          <LoadingSpinner size="md" />
          <span>Loading indexing progress...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="indexing-progress-container">
        <ErrorMessage
          message={error}
          onRetry={fetchProgress}
          showRetry={true}
        />
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card className="indexing-progress-container">
        <ErrorMessage message="No indexing progress data available" />
      </Card>
    );
  }

  const eta = calculateETA();
  const duration = new Date().getTime() - new Date(progress.startTime).getTime();

  return (
    <Card className="indexing-progress-container">
      <div className="progress-header">
        <div className="header-info">
          <h3>Indexing Progress</h3>
          <div className="status-indicator">
            <span className="status-icon">{getStatusIcon()}</span>
            <span className="status-text">{progress.status}</span>
          </div>
        </div>

        <div className="progress-controls">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchProgress}
            aria-label="Refresh progress"
          >
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="main-progress">
        <ProgressBar
          value={progress.processedFiles}
          max={progress.totalFiles}
          label="Files Processed"
          color={getProgressColor()}
          showPercentage={true}
        />
      </div>

      {/* Progress Details */}
      <div className="progress-details">
        <div className="detail-item">
          <span className="detail-label">Current File:</span>
          <span className="detail-value current-file">
            {progress.currentFile || 'N/A'}
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Duration:</span>
          <span className="detail-value">{formatDuration(duration)}</span>
        </div>

        {eta && (
          <div className="detail-item">
            <span className="detail-label">ETA:</span>
            <span className="detail-value">{eta}</span>
          </div>
        )}

        <div className="detail-item">
          <span className="detail-label">Last Updated:</span>
          <span className="detail-value">{lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Error Display */}
      {progress.error && (
        <div className="progress-error">
          <h4>Error Details</h4>
          <p>{progress.error}</p>
        </div>
      )}

      {/* Detailed Statistics */}
      {showDetailedStats && stats && (
        <div className="detailed-stats">
          <h4>Indexing Statistics</h4>
          <div className="stats-grid">
            <StatsCard
              title="Processing Rate"
              value={stats.processingRate}
              unit="files/min"
              icon="⚡"
              trend="stable"
            />

            <StatsCard
              title="Average File Size"
              value={stats.averageFileSize}
              unit="KB"
              icon="📄"
            />

            <StatsCard
              title="Total Size Processed"
              value={stats.totalSizeProcessed}
              unit="MB"
              icon="💾"
              trend="up"
            />

            <StatsCard
              title="Errors Encountered"
              value={stats.errors}
              icon="⚠️"
              trend={stats.errors > 0 ? 'up' : 'stable'}
            />
          </div>
        </div>
      )}

      {/* Auto-refresh Indicator */}
      {autoRefresh && (
        <div className="auto-refresh-indicator">
          🔄 Auto-refreshing every {refreshInterval / 1000}s
        </div>
      )}
    </Card>
  );
};

export default IndexingProgress;