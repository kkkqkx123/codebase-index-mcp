import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import GraphViewer from './GraphViewer/GraphViewer';
import NodeDetails from './NodeDetails/NodeDetails';
import GraphControls from './GraphControls/GraphControls';
import { analyzeGraph } from '../../services/graph.service';
import { GraphData, GraphConfig, GraphNode } from '../../types/graph.types';
import { useAuth } from '../../hooks/useAuth';
import { useMetricsPolling } from '../../hooks/useMetricsPolling';
import styles from './GraphVisualization.module.css';

interface GraphVisualizationState {
  graphData: GraphData | null;
  filteredData: GraphData | null;
  config: GraphConfig;
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  nodeDetailsPosition: { x: number; y: number };
  loading: boolean;
  error: string | null;
  performanceMetrics: {
    renderTime: number;
    fps: number;
    memoryUsage: number;
  };
}

const defaultGraphData: GraphData = {
  nodes: [],
  edges: [],
  metadata: {
    totalNodes: 0,
    totalEdges: 0,
    layout: 'force',
    renderingTime: 0
  }
};

const defaultConfig: GraphConfig = {
  layout: 'force',
  filter: [],
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const GraphVisualization: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<GraphVisualizationState>({
    graphData: null,
    filteredData: null,
    config: defaultConfig,
    selectedNode: null,
    hoveredNode: null,
    nodeDetailsPosition: { x: 0, y: 0 },
    loading: true,
    error: null,
    performanceMetrics: {
      renderTime: 0,
      fps: 60,
      memoryUsage: 0
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const renderStartTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);

  // Load graph data
  const { data: queryData, error: queryError, isLoading: queryLoading } = useQuery(
    ['graph', projectId],
    () => {
      if (!projectId || !isAuthenticated) {
        return Promise.resolve({ success: false, error: 'Project ID required' });
      }
      return analyzeGraph({
        projectId,
        options: {
          depth: 2,
          includeExternal: false
        }
      });
    },
    {
      enabled: !!projectId && isAuthenticated,
      retry: 2,
      retryDelay: 1000,
      onSuccess: (response) => {
        if (response.success && response.data) {
          setState(prev => ({
            ...prev,
            graphData: response.data!,
            filteredData: response.data!,
            loading: false,
            error: null
          }));
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error: response.error || 'Failed to load graph data'
          }));
        }
      },
      onError: (error) => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }));
      }
    }
  );

  // Performance monitoring
  useEffect(() => {
    if (!state.loading && state.graphData) {
      const measurePerformance = () => {
        const now = performance.now();
        frameCount.current++;

        // Calculate FPS every second
        if (now - lastFrameTime.current >= 1000) {
          const fps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current));
          
          setState(prev => ({
            ...prev,
            performanceMetrics: {
              ...prev.performanceMetrics,
              fps,
              renderTime: now - renderStartTime.current,
              memoryUsage: (performance as any).memory ? 
                (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0
            }
          }));

          frameCount.current = 0;
          lastFrameTime.current = now;
        }

        requestAnimationFrame(measurePerformance);
      };

      renderStartTime.current = performance.now();
      lastFrameTime.current = performance.now();
      frameCount.current = 0;
      const animationId = requestAnimationFrame(measurePerformance);

      return () => cancelAnimationFrame(animationId);
    }
  }, [state.loading, state.graphData]);

  // Handle configuration persistence
  useEffect(() => {
    const savedConfig = localStorage.getItem('graphConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setState(prev => ({
          ...prev,
          config: { ...defaultConfig, ...parsed }
        }));
      } catch (error) {
        console.error('Failed to load saved config:', error);
      }
    }
  }, []);

  // Save configuration to localStorage
  const saveConfig = useCallback((config: GraphConfig) => {
    try {
      localStorage.setItem('graphConfig', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }, []);

  // Handle graph configuration changes
  const handleConfigChange = useCallback((config: GraphConfig) => {
    setState(prev => ({
      ...prev,
      config
    }));
    saveConfig(config);
  }, [saveConfig]);

  // Handle data filtering
  const handleDataFilter = useCallback((filteredData: GraphData) => {
    setState(prev => ({
      ...prev,
      filteredData
    }));
  }, []);

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: string) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, layout: layout as GraphConfig['layout'] }
    }));
    saveConfig({ ...state.config, layout: layout as GraphConfig['layout'] });
  }, [state.config, saveConfig]);

  // Handle performance settings changes
  const handlePerformanceChange = useCallback((settings: any) => {
    console.log('Performance settings changed:', settings);
    // In a real implementation, this would apply performance optimizations
  }, []);

  // Handle node clicks
  const handleNodeClick = useCallback((node: GraphNode) => {
    setState(prev => ({
      ...prev,
      selectedNode: node
    }));
  }, []);

  // Handle node hover
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setState(prev => ({
      ...prev,
      hoveredNode: node
    }));
  }, []);

  // Handle node selection for navigation
  const handleNodeSelect = useCallback((nodeId: string) => {
    if (state.filteredData) {
      const node = state.filteredData.nodes.find(n => n.id === nodeId);
      if (node) {
        setState(prev => ({
          ...prev,
          selectedNode: node
        }));
      }
    }
  }, [state.filteredData]);

  // Handle mouse move for node details positioning
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setState(prev => ({
        ...prev,
        nodeDetailsPosition: {
          x: event.clientX - rect.left + 20,
          y: event.clientY - rect.top + 20
        }
      }));
    }
  }, []);

  // Close node details
  const handleCloseNodeDetails = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedNode: null
    }));
  }, []);

  // Calculate responsive dimensions
  const getDimensions = useCallback(() => {
    if (!containerRef.current) {
      return { width: 800, height: 600 };
    }

    const container = containerRef.current;
    const controlsWidth = 320; // Width of GraphControls
    const padding = 20;
    
    return {
      width: container.clientWidth - controlsWidth - padding,
      height: Math.max(600, container.clientHeight - padding)
    };
  }, []);

  const [dimensions, setDimensions] = useState(getDimensions());

  // Update dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getDimensions());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getDimensions]);

  // Display data for rendering
  const displayData = state.filteredData || state.graphData || defaultGraphData;

  return (
    <div 
      ref={containerRef}
      className={styles.graphVisualization}
      onMouseMove={handleMouseMove}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Graph Visualization</h1>
          <p className={styles.subtitle}>
            {projectId ? `Project: ${projectId}` : 'Select a project to visualize'}
          </p>
        </div>
        
        {/* Performance metrics */}
        <div className={styles.performanceMetrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>FPS:</span>
            <span className={styles.metricValue}>{state.performanceMetrics.fps}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Render:</span>
            <span className={styles.metricValue}>
              {state.performanceMetrics.renderTime.toFixed(1)}ms
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Memory:</span>
            <span className={styles.metricValue}>
              {state.performanceMetrics.memoryUsage.toFixed(1)}MB
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className={styles.mainContent}>
        {/* Graph Controls */}
        <GraphControls
          config={state.config}
          data={displayData}
          projectId={projectId}
          onConfigChange={handleConfigChange}
          onDataFilter={handleDataFilter}
          onLayoutChange={handleLayoutChange}
          onPerformanceChange={handlePerformanceChange}
        />

        {/* Graph Viewer */}
        <div className={styles.graphViewerContainer}>
          {state.loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingContent}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading graph visualization...</p>
              </div>
            </div>
          )}

          {state.error && (
            <div className={styles.errorOverlay}>
              <div className={styles.errorContent}>
                <h3>Error</h3>
                <p>{state.error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className={styles.retryButton}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!state.loading && !state.error && (
            <GraphViewer
              data={displayData}
              config={state.config}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onGraphChange={handleConfigChange}
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>
      </div>

      {/* Node Details Panel */}
      {(state.selectedNode || state.hoveredNode) && (
        <NodeDetails
          node={state.selectedNode || state.hoveredNode}
          projectId={projectId}
          onClose={handleCloseNodeDetails}
          onNodeSelect={handleNodeSelect}
          position={state.nodeDetailsPosition}
        />
      )}

      {/* Status bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusInfo}>
          <span>Nodes: {displayData.metadata.totalNodes}</span>
          <span>Edges: {displayData.metadata.totalEdges}</span>
          <span>Layout: {state.config.layout}</span>
          <span>Zoom: {Math.round(state.config.zoom * 100)}%</span>
        </div>
        <div className={styles.statusActions}>
          <button 
            onClick={() => {
              setState(prev => ({
                ...prev,
                config: defaultConfig
              }));
              saveConfig(defaultConfig);
            }}
            className={styles.resetViewButton}
          >
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
};

export default GraphVisualization;