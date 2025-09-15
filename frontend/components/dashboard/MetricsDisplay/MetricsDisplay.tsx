import React, { useState, useEffect } from 'react';
import { PerformanceMetrics } from 'types/dashboard.types';
import { getRealTimeMetrics } from '@services/monitoring.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Card from '@components/common/Card/Card';
import './MetricsDisplay.module.css';

interface MetricsDisplayProps {
  refreshInterval?: number;
  showTrends?: boolean;
  timeRange?: '1h' | '6h' | '24h' | '7d';
}

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  trend?: 'increasing' | 'decreasing' | 'stable';
  percentage?: number;
  sparklineData?: number[];
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  percentage,
  sparklineData
}) => {
  const getTrendIcon = (trend?: string): string => {
    switch (trend) {
      case 'increasing': return '↗';
      case 'decreasing': return '↘';
      case 'stable': return '→';
      default: return '';
    }
  };

  const getTrendColor = (trend?: string): string => {
    switch (trend) {
      case 'increasing': return '#ef4444'; // red
      case 'decreasing': return '#10b981'; // green
      case 'stable': return '#6b7280'; // gray
      default: return '#6b7280';
    }
  };

  const formatValue = (val: number): string => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return val.toFixed(2);
  };

  return (
    <div className="metric-card">
      <div className="metric-header">
        <h4 className="metric-title">{title}</h4>
        {trend && (
          <span
            className="metric-trend"
            style={{ color: getTrendColor(trend) }}
            title={`Trend: ${trend}`}
          >
            {getTrendIcon(trend)}
          </span>
        )}
      </div>

      <div className="metric-value">
        <span className="value">{formatValue(value)}</span>
        <span className="unit">{unit}</span>
      </div>

      {percentage !== undefined && (
        <div className="metric-percentage">
          <div className="percentage-bar">
            <div
              className="percentage-fill"
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: percentage > 80 ? '#ef4444' : percentage > 60 ? '#f59e0b' : '#10b981'
              }}
            />
          </div>
          <span className="percentage-text">{percentage.toFixed(1)}%</span>
        </div>
      )}

      {sparklineData && sparklineData.length > 0 && (
        <div className="metric-sparkline">
          <svg width="100%" height="30" viewBox="0 0 100 30">
            <polyline
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              points={sparklineData.map((point, index) =>
                `${(index / (sparklineData.length - 1)) * 100},${30 - (point / Math.max(...sparklineData)) * 25}`
              ).join(' ')}
            />
          </svg>
        </div>
      )}
    </div>
  );
};

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  refreshInterval = 30000,
  showTrends = true,
  timeRange = '1h'
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const metricsToFetch = [
        'indexing_time_avg',
        'indexing_time_last',
        'query_response_time_avg',
        'query_response_time_last',
        'memory_usage_current',
        'memory_usage_max',
        'cpu_usage_current',
        'cpu_usage_max'
      ];

      const response = await getRealTimeMetrics(metricsToFetch);
      if (response.success && response.data) {
        // Transform the response data into PerformanceMetrics format
        const transformedMetrics: PerformanceMetrics = {
          indexingTime: {
            average: response.data.indexing_time_avg || 0,
            last: response.data.indexing_time_last || 0,
            trend: determineTimeTrend(response.data.indexing_time_avg, response.data.indexing_time_last)
          },
          queryResponseTime: {
            average: response.data.query_response_time_avg || 0,
            last: response.data.query_response_time_last || 0,
            trend: determineTimeTrend(response.data.query_response_time_avg, response.data.query_response_time_last)
          },
          memoryUsage: {
            current: response.data.memory_usage_current || 0,
            max: response.data.memory_usage_max || 1000,
            percentage: ((response.data.memory_usage_current || 0) / (response.data.memory_usage_max || 1000)) * 100
          },
          cpuUsage: {
            current: response.data.cpu_usage_current || 0,
            max: response.data.cpu_usage_max || 100,
            percentage: response.data.cpu_usage_current || 0
          }
        };

        setMetrics(transformedMetrics);
      } else {
        setError(response.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const determineTimeTrend = (avg: number, last: number): 'increasing' | 'decreasing' | 'stable' => {
    const threshold = 0.1; // 10% threshold
    const ratio = last / avg;

    if (ratio > 1 + threshold) return 'increasing';
    if (ratio < 1 - threshold) return 'decreasing';
    return 'stable';
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, selectedTimeRange]);

  if (loading) {
    return (
      <Card className="metrics-display-card">
        <LoadingSpinner size="sm" />
        <span>Loading performance metrics...</span>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="metrics-display-card">
        <ErrorMessage
          message={error}
          onRetry={fetchMetrics}
          showRetry={true}
        />
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="metrics-display-card">
        <ErrorMessage message="No metrics data available" />
      </Card>
    );
  }

  return (
    <Card className="metrics-display-card">
      <div className="metrics-header">
        <h3>Performance Metrics</h3>
        <div className="time-range-selector">
          {(['1h', '6h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              className={`time-range-button ${selectedTimeRange === range ? 'active' : ''}`}
              onClick={() => setSelectedTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard
          title="Indexing Time (Avg)"
          value={metrics.indexingTime.average}
          unit="ms"
          trend={showTrends ? metrics.indexingTime.trend : undefined}
        />

        <MetricCard
          title="Indexing Time (Last)"
          value={metrics.indexingTime.last}
          unit="ms"
          trend={showTrends ? metrics.indexingTime.trend : undefined}
        />

        <MetricCard
          title="Query Response (Avg)"
          value={metrics.queryResponseTime.average}
          unit="ms"
          trend={showTrends ? metrics.queryResponseTime.trend : undefined}
        />

        <MetricCard
          title="Query Response (Last)"
          value={metrics.queryResponseTime.last}
          unit="ms"
          trend={showTrends ? metrics.queryResponseTime.trend : undefined}
        />

        <MetricCard
          title="Memory Usage"
          value={metrics.memoryUsage.current}
          unit="MB"
          percentage={metrics.memoryUsage.percentage}
        />

        <MetricCard
          title="CPU Usage"
          value={metrics.cpuUsage.current}
          unit="%"
          percentage={metrics.cpuUsage.percentage}
        />
      </div>
    </Card>
  );
};

export default MetricsDisplay;