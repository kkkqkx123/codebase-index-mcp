// Graph Service for Codebase Index Frontend
// This service provides typed methods for graph-related API operations

import { apiGet, apiPost } from '@services/api.service';
import { 
  GraphData, 
  ApiResponse
} from '@types/api.types';

// Type for graph analysis request
interface GraphAnalysisRequest {
  projectId: string;
  options?: {
    depth?: number;
    nodeTypes?: string[];
    relationshipTypes?: string[];
    includeExternal?: boolean;
  };
}

// Type for graph filtering options
interface GraphFilterOptions {
  nodeTypes?: string[];
  relationshipTypes?: string[];
  searchText?: string;
}

/**
 * Analyze code relationships and generate graph data
 * @param request - The graph analysis request parameters
 * @returns Promise with graph data
 */
export const analyzeGraph = async (
  request: GraphAnalysisRequest
): Promise<ApiResponse<GraphData>> => {
  return apiPost<GraphData>('/graph/analyze', request);
};

/**
 * Get a specific subgraph by node IDs
 * @param projectId - The project ID
 * @param nodeIds - Array of node IDs to include in the subgraph
 * @returns Promise with subgraph data
 */
export const getSubgraph = async (
  projectId: string,
  nodeIds: string[]
): Promise<ApiResponse<GraphData>> => {
  return apiPost<GraphData>('/graph/subgraph', {
    projectId,
    nodeIds
  });
};

/**
 * Filter graph data based on specified criteria
 * @param graphData - The original graph data
 * @param filters - The filter options
 * @returns Promise with filtered graph data
 */
export const filterGraph = async (
  graphData: GraphData,
  filters: GraphFilterOptions
): Promise<ApiResponse<GraphData>> => {
  return apiPost<GraphData>('/graph/filter', {
    graphData,
    filters
  });
};

/**
 * Export graph data in specified format
 * @param projectId - The project ID
 * @param format - The export format (json, png, svg)
 * @returns Promise with export result
 */
export const exportGraph = async (
  projectId: string,
  format: 'json' | 'png' | 'svg'
): Promise<ApiResponse<{ url: string; filename: string }>> => {
  return apiPost<{ url: string; filename: string }>('/graph/export', {
    projectId,
    format
  });
};