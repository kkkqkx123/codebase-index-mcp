import React, { useState, useCallback } from 'react';
import { GraphConfig, GraphData, GraphExportOptions, GraphLayoutAlgorithm } from '../../../types/graph.types';
import { exportGraph } from '../../../services/graph.service';
import styles from './GraphControls.module.css';

interface GraphControlsProps {
  config: GraphConfig;
  data: GraphData;
  projectId?: string;
  onConfigChange: (config: GraphConfig) => void;
  onDataFilter: (filteredData: GraphData) => void;
  onLayoutChange: (layout: string) => void;
  onPerformanceChange: (settings: PerformanceSettings) => void;
}

interface PerformanceSettings {
  enableVirtualization: boolean;
  enableProgressiveRendering: boolean;
  maxNodes: number;
  renderQuality: 'low' | 'medium' | 'high';
}

interface FilterSettings {
  nodeTypes: string[];
  edgeTypes: string[];
  searchText: string;
  minWeight: number;
}

const GraphControls: React.FC<GraphControlsProps> = ({
  config,
  data,
  projectId,
  onConfigChange,
  onDataFilter,
  onLayoutChange,
  onPerformanceChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    nodeTypes: [],
    edgeTypes: [],
    searchText: '',
    minWeight: 0
  });
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>({
    enableVirtualization: true,
    enableProgressiveRendering: true,
    maxNodes: 1000,
    renderQuality: 'medium'
  });

  // Layout options
  const layoutOptions = [
    { value: 'force', label: 'Force-Directed', icon: '🌐' },
    { value: 'circular', label: 'Circular', icon: '⭕' },
    { value: 'hierarchical', label: 'Hierarchical', icon: '🏗️' },
    { value: 'tree', label: 'Tree', icon: '🌳' }
  ];

  // Node type options
  const nodeTypeOptions = [
    { value: 'file', label: 'Files', icon: '📄' },
    { value: 'function', label: 'Functions', icon: '⚡' },
    { value: 'class', label: 'Classes', icon: '🏗️' },
    { value: 'variable', label: 'Variables', icon: '🔧' }
  ];

  // Edge type options
  const edgeTypeOptions = [
    { value: 'imports', label: 'Imports', icon: '📥' },
    { value: 'calls', label: 'Calls', icon: '📞' },
    { value: 'extends', label: 'Extends', icon: '🔗' },
    { value: 'implements', label: 'Implements', icon: '🔧' }
  ];

  // Export format options
  const exportOptions = [
    { value: 'png', label: 'PNG Image', icon: '🖼️' },
    { value: 'svg', label: 'SVG Vector', icon: '🎨' },
    { value: 'json', label: 'JSON Data', icon: '📄' }
  ];

  // Handle layout change
  const handleLayoutChange = useCallback((layout: string) => {
    onLayoutChange(layout);
    onConfigChange({ ...config, layout: layout as GraphConfig['layout'] });
  }, [config, onConfigChange, onLayoutChange]);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof FilterSettings, value: any) => {
    const newFilters = { ...filterSettings, [key]: value };
    setFilterSettings(newFilters);
    applyFilters(newFilters);
  }, [filterSettings, data]);

  // Apply filters to graph data
  const applyFilters = useCallback((filters: FilterSettings) => {
    let filteredNodes = [...data.nodes];
    let filteredEdges = [...data.edges];

    // Filter by node types
    if (filters.nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => filters.nodeTypes.includes(node.type));
    }

    // Filter by edge types
    if (filters.edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => filters.edgeTypes.includes(edge.type));
    }

    // Filter by search text
    if (filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase();
      filteredNodes = filteredNodes.filter(node => 
        node.label.toLowerCase().includes(searchLower) ||
        node.id.toLowerCase().includes(searchLower)
      );
    }

    // Filter by minimum weight
    if (filters.minWeight > 0) {
      filteredEdges = filteredEdges.filter(edge => (edge.weight || 0) >= filters.minWeight);
    }

    // Remove edges that reference filtered-out nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    onDataFilter({
      nodes: filteredNodes,
      edges: filteredEdges,
      metadata: {
        ...data.metadata,
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length
      }
    });
  }, [data, onDataFilter]);

  // Handle export
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'json') => {
    if (!projectId) return;

    setExportLoading(true);
    try {
      const response = await exportGraph(projectId, format);
      if (response.success && response.data) {
        // Create download link
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        console.error('Export failed:', response.error);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExportLoading(false);
    }
  }, [projectId]);

  // Handle performance settings change
  const handlePerformanceChange = useCallback((key: keyof PerformanceSettings, value: any) => {
    const newSettings = { ...performanceSettings, [key]: value };
    setPerformanceSettings(newSettings);
    onPerformanceChange(newSettings);
  }, [performanceSettings, onPerformanceChange]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    const resetFilters: FilterSettings = {
      nodeTypes: [],
      edgeTypes: [],
      searchText: '',
      minWeight: 0
    };
    setFilterSettings(resetFilters);
    onDataFilter(data);
  }, [data, onDataFilter]);

  return (
    <div className={`${styles.graphControls} ${isExpanded ? styles.expanded : styles.collapsed}`}>
      <div className={styles.header}>
        <button 
          className={styles.toggleButton}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '◀' : '▶'}
        </button>
        <h3>Graph Controls</h3>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {/* Layout Selection */}
          <div className={styles.section}>
            <h4>Layout Algorithm</h4>
            <div className={styles.layoutOptions}>
              {layoutOptions.map(option => (
                <button
                  key={option.value}
                  className={`${styles.layoutButton} ${config.layout === option.value ? styles.active : ''}`}
                  onClick={() => handleLayoutChange(option.value)}
                  title={option.label}
                >
                  <span className={styles.layoutIcon}>{option.icon}</span>
                  <span className={styles.layoutLabel}>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search and Filter */}
          <div className={styles.section}>
            <h4>Search & Filter</h4>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Search nodes..."
                value={filterSettings.searchText}
                onChange={(e) => handleFilterChange('searchText', e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Node Types:</label>
              <div className={styles.checkboxGroup}>
                {nodeTypeOptions.map(option => (
                  <label key={option.value} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filterSettings.nodeTypes.includes(option.value)}
                      onChange={(e) => {
                        const current = filterSettings.nodeTypes;
                        const updated = e.target.checked
                          ? [...current, option.value]
                          : current.filter(t => t !== option.value);
                        handleFilterChange('nodeTypes', updated);
                      }}
                    />
                    <span>{option.icon} {option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label>Edge Types:</label>
              <div className={styles.checkboxGroup}>
                {edgeTypeOptions.map(option => (
                  <label key={option.value} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filterSettings.edgeTypes.includes(option.value)}
                      onChange={(e) => {
                        const current = filterSettings.edgeTypes;
                        const updated = e.target.checked
                          ? [...current, option.value]
                          : current.filter(t => t !== option.value);
                        handleFilterChange('edgeTypes', updated);
                      }}
                    />
                    <span>{option.icon} {option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label>Minimum Weight: {filterSettings.minWeight}</label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={filterSettings.minWeight}
                onChange={(e) => handleFilterChange('minWeight', parseFloat(e.target.value))}
                className={styles.rangeSlider}
              />
            </div>

            <button onClick={resetFilters} className={styles.resetButton}>
              Reset Filters
            </button>
          </div>

          {/* Export Options */}
          <div className={styles.section}>
            <h4>Export Graph</h4>
            <div className={styles.exportOptions}>
              {exportOptions.map(option => (
                <button
                  key={option.value}
                  className={styles.exportButton}
                  onClick={() => handleExport(option.value as any)}
                  disabled={exportLoading || !projectId}
                >
                  <span className={styles.exportIcon}>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Performance Settings */}
          <div className={styles.section}>
            <h4>Performance</h4>
            <div className={styles.performanceSettings}>
              <div className={styles.settingRow}>
                <label className={styles.settingLabel}>
                  <input
                    type="checkbox"
                    checked={performanceSettings.enableVirtualization}
                    onChange={(e) => handlePerformanceChange('enableVirtualization', e.target.checked)}
                  />
                  Virtualization
                </label>
              </div>
              
              <div className={styles.settingRow}>
                <label className={styles.settingLabel}>
                  <input
                    type="checkbox"
                    checked={performanceSettings.enableProgressiveRendering}
                    onChange={(e) => handlePerformanceChange('enableProgressiveRendering', e.target.checked)}
                  />
                  Progressive Rendering
                </label>
              </div>

              <div className={styles.settingRow}>
                <label>Max Nodes:</label>
                <select
                  value={performanceSettings.maxNodes}
                  onChange={(e) => handlePerformanceChange('maxNodes', parseInt(e.target.value))}
                  className={styles.selectInput}
                >
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={2000}>2000</option>
                  <option value={5000}>5000</option>
                </select>
              </div>

              <div className={styles.settingRow}>
                <label>Quality:</label>
                <select
                  value={performanceSettings.renderQuality}
                  onChange={(e) => handlePerformanceChange('renderQuality', e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Graph Statistics */}
          <div className={styles.section}>
            <h4>Statistics</h4>
            <div className={styles.stats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Nodes:</span>
                <span className={styles.statValue}>{data.metadata.totalNodes}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Edges:</span>
                <span className={styles.statValue}>{data.metadata.totalEdges}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Layout:</span>
                <span className={styles.statValue}>{config.layout}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Zoom:</span>
                <span className={styles.statValue}>{Math.round(config.zoom * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphControls;