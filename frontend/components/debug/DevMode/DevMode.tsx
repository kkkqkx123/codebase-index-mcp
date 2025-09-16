import React, { useState, useCallback } from 'react';
import {
  DevModeFeature,
  ComponentState,
  ProfilingData,
  DebugSession
} from '../../../types/debug.types';
import Card from '../../common/Card/Card';
import Button from '../../common/Button/Button';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../common/ErrorMessage/ErrorMessage';
import styles from './DevMode.module.css';

interface DevModeProps {
  enableProfiling?: boolean;
  enableInspection?: boolean;
}

const DevMode: React.FC<DevModeProps> = ({
  enableProfiling = true,
  enableInspection = true
}) => {
  const [features, setFeatures] = useState<DevModeFeature[]>([
    {
      id: 'logging',
      name: 'Enhanced Logging',
      description: 'Enable detailed console logging with timestamps and context',
      enabled: true,
      category: 'logging'
    },
    {
      id: 'component-inspection',
      name: 'Component Inspection',
      description: 'Inspect React component state, props, and hooks in real-time',
      enabled: false,
      category: 'inspection'
    },
    {
      id: 'performance-profiling',
      name: 'Performance Profiling',
      description: 'Profile component render times and effects performance',
      enabled: false,
      category: 'profiling'
    },
    {
      id: 'route-logging',
      name: 'Route Logging',
      description: 'Log all navigation events with timing information',
      enabled: true,
      category: 'logging'
    },
    {
      id: 'api-logging',
      name: 'API Request Logging',
      description: 'Log all API requests and responses with detailed timing',
      enabled: true,
      category: 'logging'
    },
    {
      id: 'error-boundary',
      name: 'Error Boundary Testing',
      description: 'Test error boundaries by simulating component errors',
      enabled: false,
      category: 'testing'
    }
  ]);

  const [componentStates, setComponentStates] = useState<ComponentState[]>([]);
  const [profilingData, setProfilingData] = useState<ProfilingData[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ComponentState | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfilingData | null>(null);
  const [isProfiling, setIsProfiling] = useState<boolean>(false);
  const [session, setSession] = useState<DebugSession | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle feature on/off
  const toggleFeature = (featureId: string) => {
    setFeatures(prev => {
      const updatedFeatures = prev.map(feature =>
        feature.id === featureId
          ? { ...feature, enabled: !feature.enabled }
          : feature
      );
      
      // Apply feature changes with the updated state
      const feature = updatedFeatures.find(f => f.id === featureId);
      if (feature) {
        applyFeatureChange(featureId, !feature.enabled);
      }
      
      return updatedFeatures;
    });
  };

  // Apply feature changes (in a real app, this would affect the application behavior)
  const applyFeatureChange = (featureId: string, enabled: boolean) => {
    console.log(`Feature ${featureId} ${enabled ? 'enabled' : 'disabled'}`);

    // Simulate applying feature changes
    if (featureId === 'logging' && enabled) {
      console.log('Enhanced logging enabled');
    } else if (featureId === 'component-inspection') {
      if (enabled) {
        // Simulate fetching component states
        fetchComponentStates();
      } else {
        setComponentStates([]);
        setSelectedComponent(null);
      }
    } else if (featureId === 'performance-profiling') {
      if (!enabled) {
        setProfilingData([]);
        setSelectedProfile(null);
        setIsProfiling(false);
      }
    }
  };

  // Simulate fetching component states
  const fetchComponentStates = useCallback(async () => {
    try {
      setLoading(true);
      // In a real implementation, this would use React DevTools or similar
      // For now, we'll simulate with mock data
      const mockStates: ComponentState[] = [
        {
          componentId: 'Dashboard',
          props: { refreshInterval: 5000, showDetailedMetrics: false },
          state: { metrics: [], loading: false },
          hooks: [
            { name: 'useMetricsPolling', value: { data: [], loading: false } },
            { name: 'useState', value: { metrics: [] } }
          ],
          renderCount: 15,
          lastRender: new Date(Date.now() - 5000),
          renderTime: 12.5
        },
        {
          componentId: 'ProjectList',
          props: { projects: [], loading: false },
          state: { selectedProject: null, filter: '' },
          hooks: [
            { name: 'useProjects', value: { projects: [], loading: false } }
          ],
          renderCount: 8,
          lastRender: new Date(Date.now() - 3000),
          renderTime: 8.2
        },
        {
          componentId: 'SearchBar',
          props: { placeholder: 'Search code...', onSearch: jest.fn() },
          state: { query: '', suggestions: [], showSuggestions: false },
          hooks: [
            { name: 'useState', value: { query: '' } },
            { name: 'useDebounce', value: { debouncedValue: '' } }
          ],
          renderCount: 23,
          lastRender: new Date(Date.now() - 1000),
          renderTime: 5.8
        }
      ];

      setComponentStates(mockStates);
      setError(null);
    } catch (err) {
      setError('Failed to fetch component states');
      console.error('Error fetching component states:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Start performance profiling
  const startProfiling = () => {
    setIsProfiling(true);
    setProfilingData([]);

    // Simulate profiling data collection
    const mockProfiling: ProfilingData[] = [
      {
        id: '1',
        name: 'Dashboard Render',
        duration: 12.5,
        startTime: new Date(Date.now() - 10000),
        endTime: new Date(Date.now() - 9987.5),
        type: 'render',
        component: 'Dashboard',
        metrics: {
          memoryUsage: 45.2,
          cpuUsage: 12.5,
          callCount: 1
        }
      },
      {
        id: '2',
        name: 'ProjectList Effect',
        duration: 8.2,
        startTime: new Date(Date.now() - 8000),
        endTime: new Date(Date.now() - 7991.8),
        type: 'effect',
        component: 'ProjectList',
        metrics: {
          memoryUsage: 23.1,
          cpuUsage: 8.2,
          callCount: 1
        }
      },
      {
        id: '3',
        name: 'SearchBar Callback',
        duration: 5.8,
        startTime: new Date(Date.now() - 6000),
        endTime: new Date(Date.now() - 5994.2),
        type: 'callback',
        component: 'SearchBar',
        metrics: {
          memoryUsage: 15.7,
          cpuUsage: 5.8,
          callCount: 3
        }
      }
    ];

    setTimeout(() => {
      setProfilingData(mockProfiling);
      setIsProfiling(false);
    }, 2000);
  };

  // Stop performance profiling
  const stopProfiling = () => {
    setIsProfiling(false);
  };

  // Create new debug session
  const createDebugSession = () => {
    const newSession: DebugSession = {
      id: `session-${Date.now()}`,
      name: `Debug Session ${new Date().toLocaleString()}`,
      startTime: new Date(),
      active: true,
      features: features.filter(f => f.enabled),
      logs: [],
      errors: [],
      performanceData: [],
      notes: ''
    };

    setSession(newSession);
    console.log('Debug session started:', newSession);
  };

  // End debug session
  const endDebugSession = () => {
    if (session) {
      const endedSession = {
        ...session,
        active: false,
        endTime: new Date()
      };

      setSession(endedSession);
      console.log('Debug session ended:', endedSession);
    }
  };

  // Export session data
  const exportSession = () => {
    if (!session) return;

    const exportData = {
      session,
      componentStates,
      profilingData,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-session-${session.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Simulate error for testing
  const simulateError = () => {
    throw new Error('This is a simulated error for testing error boundaries');
  };

  // Get performance color based on duration
  const getPerformanceColor = (duration: number): string => {
    if (duration >= 100) return styles.performancePoor;
    if (duration >= 50) return styles.performanceFair;
    return styles.performanceGood;
  };

  // Get render count color
  const getRenderCountColor = (count: number): string => {
    if (count >= 50) return styles.renderCountHigh;
    if (count >= 20) return styles.renderCountMedium;
    return styles.renderCountLow;
  };

  const inspectionFeature = features.find(f => f.id === 'component-inspection');
  const profilingFeature = features.find(f => f.id === 'performance-profiling');

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className={styles.devMode}>
      <Card>
        <div className={styles.header}>
          <h2>Development Mode</h2>
          <div className={styles.controls}>
            <Button
              variant="primary"
              size="sm"
              onClick={createDebugSession}
              disabled={session?.active}
            >
              Start Session
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={endDebugSession}
              disabled={!session?.active}
            >
              End Session
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportSession}
              disabled={!session}
            >
              Export Session
            </Button>
          </div>
        </div>

        {/* Session Info */}
        {session && (
          <div className={styles.sessionInfo}>
            <div className={styles.sessionHeader}>
              <h3>Debug Session: {session.name}</h3>
              <span className={`${styles.sessionStatus} ${session.active ? styles.active : styles.ended}`}>
                {session.active ? 'Active' : 'Ended'}
              </span>
            </div>
            <div className={styles.sessionDetails}>
              <div className={styles.sessionDetail}>
                <span className={styles.label}>Started:</span>
                <span>{session.startTime.toLocaleString()}</span>
              </div>
              {session.endTime && (
                <div className={styles.sessionDetail}>
                  <span className={styles.label}>Ended:</span>
                  <span>{session.endTime.toLocaleString()}</span>
                </div>
              )}
              <div className={styles.sessionDetail}>
                <span className={styles.label}>Active Features:</span>
                <span>{session.features.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className={styles.featuresSection}>
          <h3>Debug Features</h3>
          <div className={styles.featuresGrid}>
            {features.map(feature => (
              <div
                key={feature.id}
                className={`${styles.featureCard} ${feature.enabled ? styles.enabled : styles.disabled}`}
              >
                <div className={styles.featureHeader}>
                  <h4>{feature.name}</h4>
                  <Button
                    variant={feature.enabled ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => toggleFeature(feature.id)}
                  >
                    {feature.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
                <p className={styles.featureDescription}>{feature.description}</p>
                <div className={styles.featureMeta}>
                  <span className={`${styles.category} ${styles[feature.category]}`}>
                    {feature.category}
                  </span>
                  <span className={feature.enabled ? styles.statusEnabled : styles.statusDisabled}>
                    {feature.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Component Inspection */}
        {enableInspection && inspectionFeature?.enabled && (
          <div className={styles.inspectionSection}>
            <h3>Component Inspection</h3>
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className={styles.inspectionContainer}>
                <div className={styles.componentsList}>
                  {componentStates.length === 0 ? (
                    <div className={styles.noComponents}>No component data available</div>
                  ) : (
                    componentStates.map(component => (
                      <div
                        key={component.componentId}
                        className={`${styles.componentItem} ${selectedComponent?.componentId === component.componentId ? styles.selected : ''}`}
                        onClick={() => setSelectedComponent(component)}
                      >
                        <div className={styles.componentHeader}>
                          <span className={styles.componentName}>{component.componentId}</span>
                          <span className={`${styles.renderCount} ${getRenderCountColor(component.renderCount)}`}>
                            {component.renderCount} renders
                          </span>
                          <span className={`${styles.renderTime} ${getPerformanceColor(component.renderTime)}`}>
                            {component.renderTime.toFixed(1)}ms
                          </span>
                        </div>
                        <div className={styles.componentMeta}>
                          <span className={styles.lastRender}>
                            Last render: {component.lastRender.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {selectedComponent && (
                  <div className={styles.componentDetails}>
                    <div className={styles.detailsHeader}>
                      <h4>{selectedComponent.componentId} Details</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedComponent(null)}
                      >
                        ×
                      </Button>
                    </div>

                    <div className={styles.detailsContent}>
                      <div className={styles.detailSection}>
                        <h5>Props</h5>
                        <pre className={styles.codeBlock}>
                          {JSON.stringify(selectedComponent.props, null, 2)}
                        </pre>
                      </div>

                      <div className={styles.detailSection}>
                        <h5>State</h5>
                        <pre className={styles.codeBlock}>
                          {JSON.stringify(selectedComponent.state, null, 2)}
                        </pre>
                      </div>

                      <div className={styles.detailSection}>
                        <h5>Hooks</h5>
                        <div className={styles.hooksList}>
                          {selectedComponent.hooks.map((hook, index) => (
                            <div key={index} className={styles.hookItem}>
                              <span className={styles.hookName}>{hook.name}:</span>
                              <pre className={styles.hookValue}>
                                {JSON.stringify(hook.value, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={styles.detailSection}>
                        <h5>Performance</h5>
                        <div className={styles.performanceStats}>
                          <div className={styles.stat}>
                            <span className={styles.label}>Render Count:</span>
                            <span className={getRenderCountColor(selectedComponent.renderCount)}>
                              {selectedComponent.renderCount}
                            </span>
                          </div>
                          <div className={styles.stat}>
                            <span className={styles.label}>Render Time:</span>
                            <span className={getPerformanceColor(selectedComponent.renderTime)}>
                              {selectedComponent.renderTime.toFixed(1)}ms
                            </span>
                          </div>
                          <div className={styles.stat}>
                            <span className={styles.label}>Last Render:</span>
                            <span>{selectedComponent.lastRender.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Performance Profiling */}
        {enableProfiling && profilingFeature?.enabled && (
          <div className={styles.profilingSection}>
            <h3>Performance Profiling</h3>
            <div className={styles.profilingControls}>
              <Button
                variant={isProfiling ? 'error' : 'primary'}
                onClick={isProfiling ? stopProfiling : startProfiling}
                disabled={isProfiling}
              >
                {isProfiling ? 'Stop Profiling' : 'Start Profiling'}
              </Button>
              {isProfiling && (
                <div className={styles.profilingStatus}>
                  <LoadingSpinner size="sm" />
                  <span>Profiling in progress...</span>
                </div>
              )}
            </div>

            {profilingData.length > 0 && (
              <div className={styles.profilingResults}>
                <div className={styles.profilesList}>
                  {profilingData.map(profile => (
                    <div
                      key={profile.id}
                      className={`${styles.profileItem} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
                      onClick={() => setSelectedProfile(profile)}
                    >
                      <div className={styles.profileHeader}>
                        <span className={styles.profileName}>{profile.name}</span>
                        <span className={`${styles.profileDuration} ${getPerformanceColor(profile.duration)}`}>
                          {profile.duration.toFixed(1)}ms
                        </span>
                        <span className={`${styles.profileType} ${styles[profile.type]}`}>
                          {profile.type}
                        </span>
                      </div>
                      <div className={styles.profileMeta}>
                        {profile.component && (
                          <span className={styles.profileComponent}>
                            Component: {profile.component}
                          </span>
                        )}
                        <span className={styles.profileTime}>
                          {profile.startTime.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedProfile && (
                  <div className={styles.profileDetails}>
                    <div className={styles.detailsHeader}>
                      <h4>Profile Details</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProfile(null)}
                      >
                        ×
                      </Button>
                    </div>

                    <div className={styles.detailsContent}>
                      <div className={styles.detailRow}>
                        <span className={styles.label}>Name:</span>
                        <span>{selectedProfile.name}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.label}>Type:</span>
                        <span className={`${styles.profileType} ${styles[selectedProfile.type]}`}>
                          {selectedProfile.type}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.label}>Duration:</span>
                        <span className={getPerformanceColor(selectedProfile.duration)}>
                          {selectedProfile.duration.toFixed(1)}ms
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.label}>Start Time:</span>
                        <span>{selectedProfile.startTime.toLocaleString()}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.label}>End Time:</span>
                        <span>{selectedProfile.endTime.toLocaleString()}</span>
                      </div>
                      {selectedProfile.component && (
                        <div className={styles.detailRow}>
                          <span className={styles.label}>Component:</span>
                          <span>{selectedProfile.component}</span>
                        </div>
                      )}

                      {selectedProfile.metrics && (
                        <div className={styles.metricsSection}>
                          <h5>Metrics</h5>
                          <div className={styles.metricsGrid}>
                            {Object.entries(selectedProfile.metrics).map(([key, value]) => (
                              <div key={key} className={styles.metric}>
                                <span className={styles.metricName}>
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                </span>
                                <span className={styles.metricValue}>
                                  {typeof value === 'number' ? value.toFixed(1) : value}
                                  {key === 'memoryUsage' && 'MB'}
                                  {key === 'cpuUsage' && '%'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Testing Tools */}
        <div className={styles.testingSection}>
          <h3>Testing Tools</h3>
          <div className={styles.testingTools}>
            <Button
              variant="error"
              size="sm"
              onClick={simulateError}
            >
              Simulate Error
            </Button>
            <div className={styles.toolDescription}>
              Test error boundaries by simulating a component error
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DevMode;