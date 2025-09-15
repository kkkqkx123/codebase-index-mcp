// Graph Adapter for Codebase Index Service
// This module provides an adapter for graph-related MCP service operations

import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  GraphData, 
  ApiResponse,
  AppError,
  ErrorType 
} from '@types/api.types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create axios instance for graph operations
const graphApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/graph`,
  timeout: 30000,
});

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
  try {
    const response = await graphApi.post<GraphData>('/analyze', request);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to analyze graph');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
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
  try {
    const response = await graphApi.post<GraphData>('/subgraph', {
      projectId,
      nodeIds
    });
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to fetch subgraph');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
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
  try {
    const response = await graphApi.post<GraphData>('/filter', {
      graphData,
      filters
    });
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to filter graph');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
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
  try {
    const response = await graphApi.post<{ url: string; filename: string }>('/export', {
      projectId,
      format
    });
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to export graph');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Handle axios errors and convert them to AppError objects
 * @param error - The axios error
 * @param defaultMessage - Default message to use if none is provided
 * @returns AppError object
 */
const handleAxiosError = (error: unknown, defaultMessage: string): AppError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Network error
    if (!axiosError.response) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: axiosError.message || 'Network error occurred',
        userMessage: 'Unable to connect to the server. Please check your connection.',
        timestamp: new Date()
      };
    }
    
    // HTTP error responses
    switch (axiosError.response.status) {
      case 400:
        return {
          type: ErrorType.VALIDATION_ERROR,
          message: axiosError.response.data?.message || 'Invalid request',
          userMessage: 'Please check your input and try again.',
          timestamp: new Date()
        };
      case 401:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication required',
          userMessage: 'You need to log in to perform this action.',
          timestamp: new Date()
        };
      case 403:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Access forbidden',
          userMessage: 'You do not have permission to perform this action.',
          timestamp: new Date()
        };
      case 429:
        return {
          type: ErrorType.RATE_LIMIT_ERROR,
          message: 'Rate limit exceeded',
          userMessage: 'Too many requests. Please try again later.',
          timestamp: new Date()
        };
      case 500:
        return {
          type: ErrorType.API_ERROR,
          message: 'Internal server error',
          userMessage: 'An error occurred on the server. Please try again later.',
          timestamp: new Date()
        };
      default:
        return {
          type: ErrorType.API_ERROR,
          message: axiosError.response.data?.message || axiosError.message || defaultMessage,
          userMessage: 'An unexpected error occurred. Please try again.',
          timestamp: new Date()
        };
    }
  }
  
  // Non-axios errors
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: defaultMessage,
    userMessage: 'An unexpected error occurred. Please try again.',
    timestamp: new Date()
  };
};