// Search Adapter for Codebase Index Service
// This module provides an adapter for search-related MCP service operations

import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  SearchQuery, 
  SearchResults, 
  ApiResponse,
  AppError,
  ErrorType 
} from '@types/api.types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create axios instance for search operations
const searchApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/search`,
  timeout: 30000,
});

/**
 * Perform a hybrid search across indexed codebases
 * @param query - The search query parameters
 * @returns Promise with search results
 */
export const performHybridSearch = async (
  query: SearchQuery
): Promise<ApiResponse<SearchResults>> => {
  try {
    const response = await searchApi.post<SearchResults>('/hybrid', query);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to perform search');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get search suggestions based on partial query
 * @param partialQuery - The partial query string
 * @param projectId - Optional project ID to scope suggestions
 * @returns Promise with search suggestions
 */
export const getSearchSuggestions = async (
  partialQuery: string,
  projectId?: string
): Promise<ApiResponse<string[]>> => {
  try {
    const params: { query: string; projectId?: string } = { query: partialQuery };
    if (projectId) {
      params.projectId = projectId;
    }
    
    const response = await searchApi.get<string[]>('/suggestions', { params });
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to fetch search suggestions');
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get detailed information about a search result
 * @param resultId - The ID of the search result
 * @returns Promise with detailed search result information
 */
export const getSearchResultDetails = async (
  resultId: string
): Promise<ApiResponse<any>> => {
  try {
    const response = await searchApi.get<any>(`/result/${resultId}`);
    
    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const appError = handleAxiosError(error, 'Failed to fetch search result details');
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