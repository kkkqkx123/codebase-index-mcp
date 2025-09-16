import React, { useState, useEffect, useCallback } from 'react';
import {
  PerformanceMetric,
  PerformanceAlert,
  TimeRange,
  FilterOptions
} from '../../../types/debug.types';
import Card from '../../common/Card/Card';
import Button from '../../common/Button/Button';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import styles from './PerformanceMetrics.module.css';

interface PerformanceMetricsProps {
  refreshInterval?: number;
  enableAlerting?: boolean;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  refreshInterval = 10000,
  enableAlerting = true
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: new Date(Date.now() - 360000), // 1 hour ago
    end: new Date()
  }); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [filters, setFilters] = useState<FilterOptions>({});
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  // Simulate fetching performance metrics from backend proxy
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the backend proxy
      // For now, we'll simulate with mock data
      const mockMetrics: PerformanceMetric[] = [
        {
          id: '1',
          name: 'CPU Usage',
          value: 45.2,
          unit: '%',
          timestamp: new Date(),
          category: 'cpu',
          threshold: { warning: 70, critical: 90 },
          trend: 'up'
        },
        {
          id: '2',
          name: 'Memory Usage',
          value: 78.5,
          unit: '%',
          timestamp: new Date(),
          category: 'memory',
          threshold: { warning: 80, critical: 95 },
          trend: 'stable'
        },
        {
          id: '3',
          name: 'Disk I/O',
          value: 125.6,
          unit: 'MB/s',
          timestamp: new Date(),
          category: 'disk',
          threshold: { warning: 200, critical: 500 },
          trend: 'down'
        },
        {
          id: '4',
          name: 'API Response Time',
          value: 245,
          unit: 'ms',
          timestamp: new Date(),
          category: 'api',
          threshold: { warning: 500, critical: 1000 },
          trend: 'stable'
        },
        {
          id: '5',
          name: 'Database Query Time',
          value: 89,
          unit: 'ms',
          timestamp: new Date(),
          category: 'database',
          threshold: { warning: 200, critical: 500 },
          trend: 'down'
        },
        {
          id: '6',
          name: 'Network Throughput',
          value: 12.4,
          unit: 'MB/s',
          timestamp: new Date(),
          category: 'network',
          threshold: { warning: 50, critical: 100 },
          trend: 'up'
        }
      ];

      setMetrics(mockMetrics);

      // Generate alerts based on thresholds
      const newAlerts: PerformanceAlert[] = [];
      mockMetrics.forEach(metric => {
        if (metric.threshold) {
          if (metric.value >= metric.threshold.critical) {
            newAlerts.push({
              id: `alert-${metric.id}-${Date.now()}`,
              metricId: metric.id,
              metricName: metric.name,
              severity: 'critical',
              message: `${metric.name} is critically high: ${metric.value}${metric.unit}`,
              timestamp: new Date(),
              acknowledged: false,
              resolved: false
            });
          } else if (metric.value >= metric.threshold.warning) {
            newAlerts.push({
              id: `alert-${metric.id}-${Date.now()}`,
              metricId: metric.id,
              metricName: metric.name,
              severity: 'medium',
              message: `${metric.name} is elevated: ${metric.value}${metric.unit}`,
              timestamp: new Date(),
              acknowledged: false,
              resolved: false
            });
          }
        }
      });

      setAlerts(newAlerts);
      setError(null);
    } catch (err) {
      setError('Failed to fetch performance metrics');
      console.error('Error fetching performance metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval, autoRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    );
  };

  const getMetricStatus = (metric: PerformanceMetric): 'normal' | 'warning' | 'critical' => {
    if (!metric.threshold) return 'normal';
    if (metric.value >= metric.threshold.critical) return 'critical';
    if (metric.value >= metric.threshold.warning) return 'warning';
    return 'normal';
  };

  const getStatusColor = (status: 'normal' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'warning': return styles.statusWarning;
      case 'critical': return styles.statusCritical;
      default: return styles.statusNormal;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | undefined): string => {
    if (!trend) return '→';
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable' | undefined): string => {
    if (!trend) return styles.trendStable;
    switch (trend) {
      case 'up': return styles.trendUp;
      case 'down': return styles.trendDown;
      default: return styles.trendStable;
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical'): string => {
    switch (severity) {
      case 'low': return styles.severityLow;
      case 'medium': return styles.severityMedium;
      case 'high': return styles.severityHigh;
      case 'critical': return styles.severityCritical;
    }
  };

  const filteredMetrics = metrics.filter(metric => {
    if (filters.category && metric.category !== filters.category) return false;
    return true;
  });

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const unacknowledgedAlerts = activeAlerts.filter(alert => !alert.acknowledged);

  if (loading && metrics.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchMetrics} />;
  }

  return (
    <div className={styles.performanceMetrics}>
      <Card>
        <div className={styles.header}>
          <h2>Performance Metrics</h2>
          <div className={styles.controls}>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List View
            </Button>
            <Button
              variant={viewMode === 'chart' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('chart')}
            >
              Chart View
            </Button>
            <Button
              variant={autoRefresh ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchMetrics}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Alerts Section */}
        {enableAlerting && unacknowledgedAlerts.length > 0 && (
          <div className={styles.alertsSection}>
            <h3>Active Alerts</h3>
            <div className={styles.alertsList}>
              {unacknowledgedAlerts.map(alert => (
                <div key={alert.id} className={`${styles.alertItem} ${getSeverityColor(alert.severity)}`}>
                  <div className={styles.alertContent}>
                    <div className={styles.alertHeader}>
                      <span className={styles.alertSeverity}>{alert.severity.toUpperCase()}</span>
                      <span className={styles.alertMessage}>{alert.message}</span>
                      <span className={styles.alertTime}>
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={styles.alertActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filters}>
          <select
            value={filters.category || ''}
            onChange={(e) => setFilters({
              ...filters,
              category: e.target.value || undefined
            })}
          >
            <option value="">All Categories</option>
            <option value="cpu">CPU</option>
            <option value="memory">Memory</option>
            <option value="disk">Disk</option>
            <option value="network">Network</option>
            <option value="api">API</option>
            <option value="database">Database</option>
          </select>
        </div>

        {/* Metrics Display */}
        <div className={styles.metricsContainer}>
          {viewMode === 'list' ? (
            <div className={styles.metricsList}>
              {filteredMetrics.length === 0 ? (
                <div className={styles.noMetrics}>No metrics found</div>
              ) : (
                filteredMetrics.map(metric => {
                  const status = getMetricStatus(metric);
                  return (
                    <div
                      key={metric.id}
                      className={`${styles.metricItem} ${getStatusColor(status)}`}
                      onClick={() => setSelectedMetric(metric)}
                    >
                      <div className={styles.metricHeader}>
                        <span className={styles.metricName}>{metric.name}</span>
                        <span className={styles.metricValue}>
                          {metric.value}{metric.unit}
                        </span>
                        <span className={`${styles.metricTrend} ${getTrendColor(metric.trend)}`}>
                          {getTrendIcon(metric.trend)}
                        </span>
                      </div>
                      <div className={styles.metricDetails}>
                        <span className={styles.metricCategory}>{metric.category}</span>
                        <span className={styles.metricTime}>
                          {metric.timestamp.toLocaleTimeString()}
                        </span>
                        {metric.threshold && (
                          <span className={styles.metricThreshold}>
                            Warning: {metric.threshold.warning}{metric.unit},
                            Critical: {metric.threshold.critical}{metric.unit}
                          </span>
                        )}
                      </div>
                      {status !== 'normal' && (
                        <div className={styles.metricStatus}>
                          Status: {status.toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className={styles.chartView}>
              <div className={styles.chartPlaceholder}>
                <p>Chart visualization would be implemented here</p>
                <p>Would integrate with a charting library like Chart.js or D3.js</p>
              </div>
            </div>
          )}

          {/* Metric Details Panel */}
          {selectedMetric && (
            <div className={styles.metricDetailsPanel}>
              <div className={styles.detailsHeader}>
                <h3>Metric Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMetric(null)}
                >
                  ×
                </Button>
              </div>

              <div className={styles.detailsContent}>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Name:</span>
                  <span>{selectedMetric.name}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Value:</span>
                  <span>{selectedMetric.value}{selectedMetric.unit}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Category:</span>
                  <span>{selectedMetric.category}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Status:</span>
                  <span className={getStatusColor(getMetricStatus(selectedMetric))}>
                    {getMetricStatus(selectedMetric).toUpperCase()}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Trend:</span>
                  <span className={getTrendColor(selectedMetric.trend)}>
                    {getTrendIcon(selectedMetric.trend)} {selectedMetric.trend}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.label}>Last Updated:</span>
                  <span>{selectedMetric.timestamp.toLocaleString()}</span>
                </div>

                {selectedMetric.threshold && (
                  <div className={styles.thresholdSection}>
                    <h4>Thresholds</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Warning:</span>
                      <span>{selectedMetric.threshold.warning}{selectedMetric.unit}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Critical:</span>
                      <span>{selectedMetric.threshold.critical}{selectedMetric.unit}</span>
                    </div>
                  </div>
                )}

                <div className={styles.optimizationSection}>
                  <h4>Optimization Suggestions</h4>
                  <div className={styles.suggestions}>
                    {getMetricStatus(selectedMetric) === 'critical' && (
                      <div className={styles.suggestion}>
                        • Immediate action required. Consider scaling resources or optimizing code.
                      </div>
                    )}
                    {getMetricStatus(selectedMetric) === 'warning' && (
                      <div className={styles.suggestion}>
                        • Monitor closely. Consider optimization if trend continues.
                      </div>
                    )}
                    {selectedMetric.category === 'cpu' && selectedMetric.value > 70 && (
                      <div className={styles.suggestion}>
                        • High CPU usage detected. Review algorithmic efficiency.
                      </div>
                    )}
                    {selectedMetric.category === 'memory' && selectedMetric.value > 80 && (
                      <div className={styles.suggestion}>
                        • High memory usage detected. Check for memory leaks.
                      </div>
                    )}
                    {selectedMetric.category === 'api' && selectedMetric.value > 500 && (
                      <div className={styles.suggestion}>
                        • Slow API response times. Consider caching or database optimization.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PerformanceMetrics;