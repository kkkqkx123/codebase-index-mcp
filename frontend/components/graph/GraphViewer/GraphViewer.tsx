import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphEdge, GraphConfig } from '../../../types/graph.types';
import styles from './GraphViewer.module.css';

interface GraphViewerProps {
  data: GraphData;
  config?: GraphConfig;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onGraphChange?: (config: GraphConfig) => void;
  width?: number;
  height?: number;
}

interface GraphViewerState {
  zoom: number;
  pan: { x: number; y: number };
  selectedNode: GraphNode | null;
  hoveredNode: GraphNode | null;
  isDragging: boolean;
}

const GraphViewer: React.FC<GraphViewerProps> = ({
  data,
  config = { layout: 'force', filter: [], zoom: 1, pan: { x: 0, y: 0 } },
  onNodeClick,
  onNodeHover,
  onGraphChange,
  width = 800,
  height = 600
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GraphViewerState>({
    zoom: config.zoom,
    pan: config.pan,
    selectedNode: null,
    hoveredNode: null,
    isDragging: false
  });

  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  // Initialize D3.js simulation and rendering
  useEffect(() => {
    if (!svgRef.current || !data || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setState(prev => ({
          ...prev,
          zoom: event.transform.k,
          pan: { x: event.transform.x, y: event.transform.y }
        }));
        if (onGraphChange) {
          onGraphChange({
            ...config,
            zoom: event.transform.k,
            pan: { x: event.transform.x, y: event.transform.y }
          });
        }
      });

    svg.call(zoom as any);

    // Apply initial transform
    const initialTransform = d3.zoomIdentity
      .translate(config.pan.x, config.pan.y)
      .scale(config.zoom);
    svg.call(zoom.transform, initialTransform);

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(data.nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(data.edges)
        .id(d => d.id)
        .distance(d => 100 / (d.weight || 1)))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(data.edges)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight || 1));

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', styles.node)
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
          setState(prev => ({ ...prev, isDragging: true }));
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
          setState(prev => ({ ...prev, isDragging: false }));
        }) as any);

    // Add circles to nodes
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add labels to nodes
    node.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('fill', '#333');

    // Add event handlers
    node
      .on('click', (event, d) => {
        event.stopPropagation();
        setState(prev => ({ ...prev, selectedNode: d }));
        if (onNodeClick) onNodeClick(d);
      })
      .on('mouseenter', (event, d) => {
        setState(prev => ({ ...prev, hoveredNode: d }));
        if (onNodeHover) onNodeHover(d);
      })
      .on('mouseleave', () => {
        setState(prev => ({ ...prev, hoveredNode: null }));
        if (onNodeHover) onNodeHover(null);
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [data, width, height, config, onNodeClick, onNodeHover, onGraphChange]);

  // Get node color based on type
  const getNodeColor = useCallback((type: string): string => {
    const colors = {
      file: '#4CAF50',
      function: '#2196F3',
      class: '#FF9800',
      variable: '#9C27B0'
    };
    return colors[type as keyof typeof colors] || '#607D8B';
  }, []);

  // Apply layout algorithm
  const applyLayout = useCallback((layoutType: string) => {
    if (!simulationRef.current || !data) return;

    const simulation = simulationRef.current;

    switch (layoutType) {
      case 'force':
        simulation
          .force('charge', d3.forceManyBody().strength(-300))
          .force('link', d3.forceLink(data.edges).id(d => d.id).distance(100))
          .alpha(1).restart();
        break;
      case 'circular':
        const angleStep = (2 * Math.PI) / data.nodes.length;
        data.nodes.forEach((node, i) => {
          node.fx = width / 2 + Math.cos(i * angleStep) * Math.min(width, height) * 0.4;
          node.fy = height / 2 + Math.sin(i * angleStep) * Math.min(width, height) * 0.4;
        });
        simulation.alpha(1).restart();
        setTimeout(() => {
          data.nodes.forEach(node => {
            node.fx = null;
            node.fy = null;
          });
          simulation.alpha(1).restart();
        }, 1000);
        break;
      case 'hierarchical':
        // Simple hierarchical layout - could be enhanced with proper tree layout
        const levels: { [key: string]: GraphNode[] } = {};
        data.nodes.forEach(node => {
          const level = node.type === 'file' ? '0' : node.type === 'class' ? '1' : '2';
          if (!levels[level]) levels[level] = [];
          levels[level].push(node);
        });

        Object.keys(levels).forEach((level, levelIndex) => {
          const nodesInLevel = levels[level];
          const levelWidth = width / (Object.keys(levels).length + 1);
          const nodeSpacing = height / (nodesInLevel.length + 1);

          nodesInLevel.forEach((node, nodeIndex) => {
            node.fx = (levelIndex + 1) * levelWidth;
            node.fy = (nodeIndex + 1) * nodeSpacing;
          });
        });

        simulation.alpha(1).restart();
        setTimeout(() => {
          data.nodes.forEach(node => {
            node.fx = null;
            node.fy = null;
          });
          simulation.alpha(1).restart();
        }, 1000);
        break;
    }
  }, [data, width, height]);

  // Handle layout changes
  useEffect(() => {
    if (config.layout) {
      applyLayout(config.layout);
    }
  }, [config.layout, applyLayout]);

  return (
    <div 
      ref={containerRef} 
      className={styles.graphViewer}
      style={{ width, height }}
    >
      <svg 
        ref={svgRef} 
        width={width} 
        height={height}
        className={styles.svg}
      >
        {/* Graph will be rendered here by D3.js */}
      </svg>
      
      {/* Loading overlay */}
      {!data && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}>Loading graph...</div>
        </div>
      )}
      
      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button 
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const zoom = d3.zoom<SVGSVGElement, unknown>();
            svg.transition().call(zoom.scaleBy as any, 1.2);
          }}
          className={styles.zoomButton}
        >
          +
        </button>
        <button 
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const zoom = d3.zoom<SVGSVGElement, unknown>();
            svg.transition().call(zoom.scaleBy as any, 0.8);
          }}
          className={styles.zoomButton}
        >
          -
        </button>
        <button 
          onClick={() => {
            const svg = d3.select(svgRef.current);
            const zoom = d3.zoom<SVGSVGElement, unknown>();
            svg.transition().call(zoom.transform as any, d3.zoomIdentity);
          }}
          className={styles.zoomButton}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default GraphViewer;