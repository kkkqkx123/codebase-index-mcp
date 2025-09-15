// Graph Visualization Types

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'variable';
  x: number;
  y: number;
  metadata: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends' | 'implements';
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    layout: string;
    renderingTime: number;
  };
}

export interface GraphConfig {
  layout: 'force' | 'hierarchical' | 'circular';
  filter: string[];
  zoom: number;
  pan: { x: number; y: number };
}

export interface GraphAnalysisRequest {
  projectPath: string;
  options?: GraphOptions;
}

export interface GraphOptions {
  depth?: number;
  nodeTypes?: string[];
  edgeTypes?: string[];
  includeExternal?: boolean;
}

export interface GraphAnalysisResponse {
  success: boolean;
  graph?: GraphData;
  error?: string;
}

export interface GraphNodeDetails {
  id: string;
  label: string;
  type: string;
  filePath?: string;
  lineNumber?: number;
  content?: string;
  relationships: GraphNodeRelationship[];
}

export interface GraphNodeRelationship {
  id: string;
  targetNodeId: string;
  targetNodeLabel: string;
  type: string;
  direction: 'in' | 'out';
}

export interface GraphExportOptions {
  format: 'png' | 'svg' | 'json';
  width?: number;
  height?: number;
  includeMetadata?: boolean;
}

export interface GraphLayoutAlgorithm {
  name: 'force' | 'hierarchical' | 'circular' | 'tree';
  options?: ForceLayoutOptions | HierarchicalLayoutOptions;
}

export interface ForceLayoutOptions {
  iterations?: number;
  strength?: number;
  distanceMin?: number;
  distanceMax?: number;
}

export interface HierarchicalLayoutOptions {
  direction?: 'LR' | 'RL' | 'TB' | 'BT';
  sortMethod?: 'directed' | 'hubsize';
}