import React, { useState, useEffect, useCallback } from 'react';
import { analyzeGraph } from '../../services/graph.service';
import { GraphData, GraphConfig, GraphNode } from '../../types/graph.types';
import GraphViewer from './GraphViewer/GraphViewer';
import NodeDetails from './NodeDetails/NodeDetails';
import GraphControls from './GraphControls/GraphControls';
import styles from './GraphVisualization.module.css';

const GraphVisualization: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [filteredData, setFilteredData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<GraphConfig>({
    layout: 'force',
    filter: [],
    zoom: 1,
    pan: { x: 0, y: 0 }
  });

  // Load graph data on component mount
 useEffect(() => {
    const loadGraphData = async () => {
      try {
        setLoading(true);
        const response = await analyzeGraph({
          projectId: 'default-project', // In a real app, this would come from route params or context
          options: {
            depth: 3,
            includeExternal: true
          }
        });

        if (response.success && response.data) {
          setGraphData(response.data);
          setFilteredData(response.data);
        } else {
          setError(response.error || 'Failed to load graph data');
        }
      } catch (err) {
        setError('An unexpected error occurred while loading graph data');
      } finally {
        setLoading(false);
      }
    };

    loadGraphData();
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  // Handle configuration changes
  const handleConfigChange = useCallback((newConfig: GraphConfig) => {
    setConfig(newConfig);
  }, []);

  // Handle data filtering
  const handleDataFilter = useCallback((filteredData: GraphData) => {
    setFilteredData(filteredData);
  }, []);

  // Handle layout change
  const handleLayoutChange = useCallback((layout: string) => {
    setConfig(prev => ({ ...prev, layout: layout as GraphConfig['layout'] }));
  }, []);

  // Handle performance settings change
  const handlePerformanceChange = useCallback((settings: any) => {
    // In a real implementation, this would update performance settings
    console.log('Performance settings changed:', settings);
  }, []);

  // Handle configuration persistence
  useEffect(() => {
    // Load configuration from localStorage
    const savedConfig = localStorage.getItem('graphConfig');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to parse saved graph configuration');
      }
    }
  }, []);

  useEffect(() => {
    // Save configuration to localStorage
    localStorage.setItem('graphConfig', JSON.stringify(config));
  }, [config]);

  if (loading) {
    return (
      <div className={styles.graphVisualization} data-testid="graph-visualization-container">
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.graphVisualization} data-testid="graph-visualization-container">
        <div className={styles.error}>
          <h2>Error</h2>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!graphData || !filteredData) {
    return (
      <div className={styles.graphVisualization} data-testid="graph-visualization-container">
        <div className={styles.empty}>
          <h2>No Graph Data</h2>
          <p>No graph data available to display.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.graphVisualization} data-testid="graph-visualization-container">
      <div className={styles.mainContent}>
        <div className={styles.graphArea}>
          <GraphViewer
            data={filteredData}
            config={config}
            onNodeSelect={handleNodeSelect}
            onConfigChange={handleConfigChange}
          />
        </div>
        <div className={styles.sidebar}>
          <NodeDetails
            node={selectedNode}
            onNavigate={(nodeId) => {
              // In a real implementation, this would navigate to the specified node
              console.log('Navigate to node:', nodeId);
            }}
            onEdit={(nodeId, updates) => {
              // In a real implementation, this would edit the node
              console.log('Edit node:', nodeId, updates);
            }}
          />
        </div>
      </div>
      <div className={styles.controls}>
        <GraphControls
          config={config}
          data={graphData}
          projectId="default-project"
          onConfigChange={handleConfigChange}
          onDataFilter={handleDataFilter}
          onLayoutChange={handleLayoutChange}
          onPerformanceChange={handlePerformanceChange}
        />
      </div>
    </div>
  );
};

export default GraphVisualization;