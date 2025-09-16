import React, { useState, useEffect, useCallback } from 'react';
import { ErrorInfo, ErrorFilter } from '../../../types/debug.types';
import Card from '../../common/Card/Card';
import Button from '../../common/Button/Button';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import styles from './ErrorViewer.module.css';

interface ErrorViewerProps {
  refreshInterval?: number;
  autoCapture?: boolean;
}

const ErrorViewer: React.FC<ErrorViewerProps> = ({
  refreshInterval = 15000,
  autoCapture = true // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [filteredErrors, setFilteredErrors] = useState<ErrorInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorInfo | null>(null);
  const [filter, setFilter] = useState<ErrorFilter>({});
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [resolutionNotes, setResolutionNotes] = useState<{ [key: string]: string }>({});

  // Simulate fetching error data from backend
  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would fetch from the backend
      // For now, we'll simulate with mock data
      const mockErrors: ErrorInfo[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 300000),
          type: 'TypeError',
          message: 'Cannot read property \'map\' of undefined',
          stackTrace: `at Object.render (frontend/components/dashboard/Dashboard.tsx:45:32)
    at finishClassComponent (node_modules/react-dom/cjs/react-dom.development.js:17485:31)
    at updateClassComponent (node_modules/react-dom/cjs/react-dom.development.js:17435:24)`,
          component: 'Dashboard',
          action: 'render',
          context: { userId: '123', projectId: 'test-project' },
          frequency: 15,
          firstSeen: new Date(Date.now() - 86400000), // 1 day ago
          lastSeen: new Date(Date.now() - 300000),
          resolved: false
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 600000),
          type: 'NetworkError',
          message: 'Failed to fetch: Request timeout',
          stackTrace: `at ApiService.request (frontend/services/api.service.ts:78:15)
    at processTicksAndRejections (node:internal/process/task_queues.js:93:5)`,
          component: 'ApiService',
          action: 'request',
          context: { endpoint: '/api/v1/search/hybrid', timeout: 30000 },
          frequency: 8,
          firstSeen: new Date(Date.now() - 432000000), // 5 days ago
          lastSeen: new Date(Date.now() - 600000),
          resolved: false
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 1800000),
          type: 'ValidationError',
          message: 'Project path is required',
          stackTrace: `at ProjectForm.validate (frontend/components/projects/ProjectForm.tsx:112:20)
    at ProjectForm.handleSubmit (frontend/components/projects/ProjectForm.tsx:89:15)`,
          component: 'ProjectForm',
          action: 'validate',
          context: { formField: 'projectPath', value: '' },
          frequency: 23,
          firstSeen: new Date(Date.now() - 1728000000), // 20 days ago
          lastSeen: new Date(Date.now() - 1800000),
          resolved: true,
          resolutionNotes: 'Added form validation to ensure project path is not empty'
        }
      ];

      setErrors(mockErrors);
      setError(null);
    } catch (err) {
      setError('Failed to fetch error data');
      console.error('Error fetching error data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh errors
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchErrors, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchErrors, refreshInterval, autoRefresh]);

  // Initial fetch
  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Apply filters to errors
  useEffect(() => {
    let filtered = [...errors];

    if (!showResolved) {
      filtered = filtered.filter(error => !error.resolved);
    }

    if (filter.type) {
      filtered = filtered.filter(error => error.type === filter.type);
    }

    if (filter.component) {
      filtered = filtered.filter(error =>
        error.component?.toLowerCase().includes(filter.component!.toLowerCase())
      );
    }

    if (filter.resolved !== undefined) {
      filtered = filtered.filter(error => error.resolved === filter.resolved);
    }

    if (filter.timeRange) {
      filtered = filtered.filter(error =>
        error.timestamp >= filter.timeRange!.start &&
        error.timestamp <= filter.timeRange!.end
      );
    }

    // Sort by frequency (highest first) and then by timestamp (most recent first)
    filtered.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.lastSeen.getTime() - a.lastSeen.getTime();
    });

    setFilteredErrors(filtered);
  }, [errors, filter, showResolved]);

  const handleErrorResolution = (errorId: string, resolved: boolean) => {
    setErrors(prev =>
      prev.map(error =>
        error.id === errorId
          ? {
            ...error,
            resolved,
            resolutionNotes: resolved ? resolutionNotes[errorId] || '' : undefined
          }
          : error
      )
    );
  };

  const updateResolutionNotes = (errorId: string, notes: string) => {
    setResolutionNotes(prev => ({
      ...prev,
      [errorId]: notes
    }));
  };

  const getErrorTypeColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'typeerror':
      case 'referenceerror':
        return styles.typeCritical;
      case 'networkerror':
      case 'apierror':
        return styles.typeHigh;
      case 'validationerror':
        return styles.typeMedium;
      default:
        return styles.typeLow;
    }
  };

  const getFrequencyLabel = (frequency: number): string => {
    if (frequency >= 50) return 'Very High';
    if (frequency >= 20) return 'High';
    if (frequency >= 10) return 'Medium';
    if (frequency >= 5) return 'Low';
    return 'Very Low';
  };

  const getFrequencyColor = (frequency: number): string => {
    if (frequency >= 50) return styles.frequencyVeryHigh;
    if (frequency >= 20) return styles.frequencyHigh;
    if (frequency >= 10) return styles.frequencyMedium;
    if (frequency >= 5) return styles.frequencyLow;
    return styles.frequencyVeryLow;
  };

  const exportErrors = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalErrors: filteredErrors.length,
      errors: filteredErrors
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `errors-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && errors.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchErrors} />;
  }

  return (
    <div className={styles.errorViewer}>
      <Card>
        <div className={styles.header}>
          <h2>Error Viewer</h2>
          <div className={styles.controls}>
            <Button
              variant={showResolved ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide Resolved' : 'Show Resolved'}
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
              onClick={fetchErrors}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportErrors}
            >
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <select
            value={filter.type || ''}
            onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
          >
            <option value="">All Types</option>
            <option value="TypeError">TypeError</option>
            <option value="ReferenceError">ReferenceError</option>
            <option value="NetworkError">NetworkError</option>
            <option value="APIError">APIError</option>
            <option value="ValidationError">ValidationError</option>
            <option value="SyntaxError">SyntaxError</option>
          </select>

          <input
            type="text"
            placeholder="Filter by component..."
            value={filter.component || ''}
            onChange={(e) => setFilter({ ...filter, component: e.target.value || undefined })}
          />

          <select
            value={filter.resolved === undefined ? '' : filter.resolved.toString()}
            onChange={(e) => setFilter({
              ...filter,
              resolved: e.target.value === '' ? undefined : e.target.value === 'true'
            })}
          >
            <option value="">All Status</option>
            <option value="false">Active</option>
            <option value="true">Resolved</option>
          </select>
        </div>

        {/* Error Statistics */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Errors:</span>
            <span className={styles.statValue}>{errors.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Active Errors:</span>
            <span className={styles.statValue}>{errors.filter(e => !e.resolved).length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Resolved Errors:</span>
            <span className={styles.statValue}>{errors.filter(e => e.resolved).length}</span>
          </div>
        </div>

        {/* Errors List */}
        <div className={styles.errorsContainer}>
          <div className={styles.errorsList}>
            {filteredErrors.length === 0 ? (
              <div className={styles.noErrors}>No errors found</div>
            ) : (
              filteredErrors.map(error => (
                <div
                  key={error.id}
                  className={`${styles.errorItem} ${selectedError?.id === error.id ? styles.selected : ''} ${error.resolved ? styles.resolved : ''}`}
                  onClick={() => setSelectedError(error)}
                >
                  <div className={styles.errorHeader}>
                    <div className={styles.errorType}>
                      <span className={`${styles.typeBadge} ${getErrorTypeColor(error.type)}`}>
                        {error.type}
                      </span>
                    </div>
                    <div className={styles.errorFrequency}>
                      <span className={`${styles.frequencyBadge} ${getFrequencyColor(error.frequency)}`}>
                        {getFrequencyLabel(error.frequency)}
                      </span>
                      <span className={styles.frequencyCount}>
                        {error.frequency} occurrences
                      </span>
                    </div>
                    {error.resolved && (
                      <div className={styles.resolvedBadge}>
                        ✓ Resolved
                      </div>
                    )}
                  </div>

                  <div className={styles.errorSummary}>
                    <div className={styles.errorMessage}>
                      {error.message}
                    </div>
                    <div className={styles.errorMeta}>
                      {error.component && (
                        <span className={styles.errorComponent}>
                          Component: {error.component}
                        </span>
                      )}
                      {error.action && (
                        <span className={styles.errorAction}>
                          Action: {error.action}
                        </span>
                      )}
                      <span className={styles.errorTime}>
                        Last seen: {error.lastSeen.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Error Details Panel */}
          {selectedError && (
            <div className={styles.errorDetailsPanel}>
              <div className={styles.detailsHeader}>
                <h3>Error Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedError(null)}
                >
                  ×
                </Button>
              </div>

              <div className={styles.detailsContent}>
                <div className={styles.detailSection}>
                  <h4>General Information</h4>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Type:</span>
                    <span className={`${styles.typeBadge} ${getErrorTypeColor(selectedError.type)}`}>
                      {selectedError.type}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Message:</span>
                    <span className={styles.errorMessage}>{selectedError.message}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Status:</span>
                    <span className={selectedError.resolved ? styles.resolvedStatus : styles.activeStatus}>
                      {selectedError.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Frequency:</span>
                    <span className={`${styles.frequencyBadge} ${getFrequencyColor(selectedError.frequency)}`}>
                      {selectedError.frequency} occurrences ({getFrequencyLabel(selectedError.frequency)})
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>First Seen:</span>
                    <span>{selectedError.firstSeen.toLocaleString()}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Last Seen:</span>
                    <span>{selectedError.lastSeen.toLocaleString()}</span>
                  </div>
                </div>

                {selectedError.component && (
                  <div className={styles.detailSection}>
                    <h4>Component Information</h4>
                    <div className={styles.detailRow}>
                      <span className={styles.label}>Component:</span>
                      <span>{selectedError.component}</span>
                    </div>
                    {selectedError.action && (
                      <div className={styles.detailRow}>
                        <span className={styles.label}>Action:</span>
                        <span>{selectedError.action}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedError.stackTrace && (
                  <div className={styles.detailSection}>
                    <h4>Stack Trace</h4>
                    <pre className={styles.stackTrace}>
                      {selectedError.stackTrace}
                    </pre>
                  </div>
                )}

                {selectedError.context && Object.keys(selectedError.context).length > 0 && (
                  <div className={styles.detailSection}>
                    <h4>Context</h4>
                    <pre className={styles.context}>
                      {JSON.stringify(selectedError.context, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Resolution Section */}
                <div className={styles.detailSection}>
                  <h4>Resolution</h4>
                  {!selectedError.resolved ? (
                    <div className={styles.resolutionForm}>
                      <textarea
                        placeholder="Add resolution notes..."
                        value={resolutionNotes[selectedError.id] || ''}
                        onChange={(e) => updateResolutionNotes(selectedError.id, e.target.value)}
                        className={styles.resolutionNotes}
                        rows={3}
                      />
                      <div className={styles.resolutionActions}>
                        <Button
                          variant="primary"
                          onClick={() => handleErrorResolution(selectedError.id, true)}
                        >
                          Mark as Resolved
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.resolvedInfo}>
                      <div className={styles.resolvedMessage}>
                        ✓ This error has been resolved
                      </div>
                      {selectedError.resolutionNotes && (
                        <div className={styles.resolutionNotesDisplay}>
                          <strong>Resolution notes:</strong>
                          <p>{selectedError.resolutionNotes}</p>
                        </div>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => handleErrorResolution(selectedError.id, false)}
                      >
                        Reopen Error
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ErrorViewer;