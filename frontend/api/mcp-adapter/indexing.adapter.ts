// Indexing Adapter for Codebase Index Service
// This module provides an adapter for indexing-related MCP service operations

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ProjectStatus,
  IndexResponse,
  ApiResponse,
  AppError,
  ErrorType
} from '../../types/api.types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create axios instance for indexing operations
const indexingApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/indexing`,
  timeout: 30000,
});

// Type for project creation request
interface CreateProjectRequest {
  path: string;
  options?: {
    include?: string[];
    exclude?: string[];
    maxDepth?: number;
  };
}

// Type for project creation response
interface CreateProjectResponse {
  projectId: string;
  status: 'created' | 'pending' | 'processing';
  message?: string;
}

/**
 * Create a new indexing project
 * @param path - The file system path to index
 * @param options - Optional indexing options
 * @returns Promise with project creation response
 */
export const createIndexingProject = async (
  path: string,
  options?: CreateProjectRequest['options']
): Promise<ApiResponse<CreateProjectResponse>> => {
  try {
    const response = await indexingApi.post<CreateProjectResponse>('/create', {
      path,
      options
    });
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to create indexing project');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get the status of an indexing project
 * @param projectId - The ID of the project to check
 * @returns Promise with project status
 */
export const getIndexingStatus = async (
  projectId: string
): Promise<ApiResponse<ProjectStatus>> => {
  try {
    const response = await indexingApi.get<ProjectStatus>(`/status/${projectId}`);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to fetch indexing status');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Trigger re-indexing for an existing project
 * @param projectId - The ID of the project to re-index
 * @returns Promise with re-indexing response
 */
export const reindexProject = async (
  projectId: string
): Promise<ApiResponse<IndexResponse>> => {
  try {
    const response = await indexingApi.post<IndexResponse>(`/reindex/${projectId}`);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to re-index project');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Cancel an ongoing indexing process
 * @param projectId - The ID of the project to cancel
 * @returns Promise with cancellation response
 */
export const cancelIndexing = async (
  projectId: string
): Promise<ApiResponse<{ success: boolean; message: string }>> => {
  try {
    const response = await indexingApi.post<{ success: boolean; message: string }>(`/cancel/${projectId}`);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to cancel indexing process');
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
    const responseData = axiosError.response.data as { message?: string };
    switch (axiosError.response.status) {
      case 400:
        return {
          type: ErrorType.VALIDATION_ERROR,
          message: responseData.message || 'Invalid request',
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
          message: responseData.message || axiosError.message || defaultMessage,
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