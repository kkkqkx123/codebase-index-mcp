import React, { useState, useEffect, useCallback } from 'react';
import { ApiLog, ApiLogFilter, ExportOptions } from '../../../types/debug.types';
import Card from '../../common/Card/Card';
import Button from '../../common/Button/Button';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import styles from './ApiLogs.module.css';

interface ApiLogsProps {
  refreshInterval?: number;
  maxLogEntries?: number;
}

const ApiLogs: React.FC<ApiLogsProps> = ({
  refreshInterval = 5000,
  maxLogEntries = 100
}) => {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApiLogFilter>({});
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Simulate fetching API logs from backend
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the backend
      // For now, we'll simulate with mock data
      const mockLogs: ApiLog[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 60000),
          method: 'POST',
          url: '/api/v1/indexing/create',
          status: 200,
          statusText: 'OK',
          requestHeaders: { 'Content-Type': 'application/json' },
          requestBody: { projectPath: '/test/project' },
          responseHeaders: { 'Content-Type': 'application/json' },
          responseBody: { success: true },
          duration: 245,
          success: true
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 120000),
          method: 'GET',
          url: '/api/v1/indexing/status/test-project',
          status: 404,
          statusText: 'Not Found',
          requestHeaders: { 'Authorization': 'Bearer token' },
          responseHeaders: { 'Content-Type': 'application/json' },
          responseBody: { error: 'Project not found' },
          duration: 56,
          success: false,
          error: 'Project not found'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 180000),
          method: 'POST',
          url: '/api/v1/search/hybrid',
          status: 200,
          statusText: 'OK',
          requestHeaders: { 'Content-Type': 'application/json' },
          requestBody: { query: 'test function', limit: 10 },
          responseHeaders: { 'Content-Type': 'application/json' },
          responseBody: { results: [], total: 0 },
          duration: 156,
          success: true
        }
      ];

      setLogs(mockLogs.slice(0, maxLogEntries));
      setError(null);
    } catch (err) {
      setError('Failed to fetch API logs');
      console.error('Error fetching API logs:', err);
    } finally {
      setLoading(false);
    }
  }, [maxLogEntries]);

  // Apply filters to logs
  useEffect(() => {
    let filtered = [...logs];

    if (filter.method) {
      filtered = filtered.filter(log => log.method === filter.method);
    }

    if (filter.status) {
      filtered = filtered.filter(log =>
        typeof filter.status === 'string'
          ? log.status.toString().startsWith(filter.status)
          : log.status === filter.status
      );
    }

    if (filter.url) {
      filtered = filtered.filter(log =>
        log.url.toLowerCase().includes(filter.url!.toLowerCase())
      );
    }

    if (filter.success !== undefined) {
      filtered = filtered.filter(log => log.success === filter.success);
    }

    if (filter.timeRange) {
      filtered = filtered.filter(log =>
        log.timestamp >= filter.timeRange!.start &&
        log.timestamp <= filter.timeRange!.end
      );
    }

    setFilteredLogs(filtered);
  }, [logs, filter]);

  // Auto-refresh logs
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchLogs, refreshInterval, autoRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: ExportOptions['format']) => {

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(filteredLogs, null, 2);
          filename = `api-logs-${new Date().toISOString()}.json`;
          mimeType = 'application/json';
          break;
        case 'csv':
          content = convertToCSV(filteredLogs);
          filename = `api-logs-${new Date().toISOString()}.csv`;
          mimeType = 'text/csv';
          break;
        case 'txt':
          content = convertToText(filteredLogs);
          filename = `api-logs-${new Date().toISOString()}.txt`;
          mimeType = 'text/plain';
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to export logs: ${err}`);
    }
  };

  const convertToCSV = (logs: ApiLog[]): string => {
    const headers = [
      'Timestamp', 'Method', 'URL', 'Status', 'Duration', 'Success', 'Error'
    ];

    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.method,
      log.url,
      log.status,
      log.duration,
      log.success,
      log.error || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  };

  const convertToText = (logs: ApiLog[]): string => {
    return logs.map(log => {
      return `[${log.timestamp.toISOString()}] ${log.method} ${log.url} - ${log.status} (${log.duration}ms)${log.error ? ` - Error: ${log.error}` : ''}`;
    }).join('\n');
  };

  const clearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
    setSelectedLog(null);
  };

  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return styles.statusSuccess;
    if (status >= 300 && status < 400) return styles.statusRedirect;
    if (status >= 400 && status < 500) return styles.statusClientError;
    return styles.statusServerError;
  };

  if (loading && logs.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchLogs} />;
  }

  return (
    <div className={styles.apiLogs}>
      <Card>
        <div className={styles.header}>
          <h2>API Logs</h2>
          <div className={styles.controls}>
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
              onClick={fetchLogs}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('json')}
            >
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              variant="error"
              size="sm"
              onClick={clearLogs}
            >
              Clear Logs
            </Button>
          </div>
        </div>

        <div className={styles.filters}>
          <select
            value={filter.method || ''}
            onChange={(e) => setFilter({ ...filter, method: e.target.value || undefined })}
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <select
            value={filter.success === undefined ? '' : filter.success.toString()}
            onChange={(e) => setFilter({
              ...filter,
              success: e.target.value === '' ? undefined : e.target.value === 'true'
            })}
          >
            <option value="">All Status</option>
            <option value="true">Success</option>
            <option value="false">Error</option>
          </select>

          <input
            type="text"
            placeholder="Filter by URL..."
            value={filter.url || ''}
            onChange={(e) => setFilter({ ...filter, url: e.target.value || undefined })}
          />

          <input
            type="text"
            placeholder="Filter by status code..."
            value={typeof filter.status === 'string' ? filter.status : ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          />
        </div>

        <div className={styles.logsContainer}>
          <div className={styles.logsList}>
            {filteredLogs.length === 0 ? (
              <div className={styles.noLogs}>No API logs found</div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`${styles.logItem} ${selectedLog?.id === log.id ? styles.selected : ''}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className={styles.logSummary}>
                    <span className={`${styles.method} ${styles[log.method.toLowerCase()]}`}>
                      {log.method}
                    </span>
                    <span className={styles.url}>{log.url}</span>
                    <span className={`${styles.status} ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                    <span className={styles.duration}>{log.duration}ms</span>
                    <span className={styles.timestamp}>
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {log.error && (
                    <div className={styles.error}>{log.error}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {selectedLog && (
            <div className={styles.logDetails}>
              <div className={styles.detailsHeader}>
                <h3>Request Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  ×
                </Button>
              </div>

              <div className={styles.detailsContent}>
                <div className={styles.detailSection}>
                  <h4>General</h4>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Method:</span>
                    <span>{selectedLog.method}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>URL:</span>
                    <span>{selectedLog.url}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Status:</span>
                    <span className={getStatusColor(selectedLog.status)}>
                      {selectedLog.status} {selectedLog.statusText}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Duration:</span>
                    <span>{selectedLog.duration}ms</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Timestamp:</span>
                    <span>{selectedLog.timestamp.toLocaleString()}</span>
                  </div>
                </div>

                {selectedLog.requestHeaders && Object.keys(selectedLog.requestHeaders).length > 0 && (
                  <div className={styles.detailSection}>
                    <h4>Request Headers</h4>
                    <pre className={styles.codeBlock}>
                      {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.requestBody && (
                  <div className={styles.detailSection}>
                    <h4>Request Body</h4>
                    <pre className={styles.codeBlock}>
                      {JSON.stringify(selectedLog.requestBody, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.responseHeaders && Object.keys(selectedLog.responseHeaders).length > 0 && (
                  <div className={styles.detailSection}>
                    <h4>Response Headers</h4>
                    <pre className={styles.codeBlock}>
                      {JSON.stringify(selectedLog.responseHeaders, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.responseBody && (
                  <div className={styles.detailSection}>
                    <h4>Response Body</h4>
                    <pre className={styles.codeBlock}>
                      {JSON.stringify(selectedLog.responseBody, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.error && (
                  <div className={styles.detailSection}>
                    <h4>Error</h4>
                    <div className={styles.errorDetails}>
                      {selectedLog.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ApiLogs;