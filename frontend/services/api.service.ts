// API Service for Codebase Index Frontend
// This service provides a centralized API client with authentication interceptors,
// retry logic, rate limiting handling, and request/response logging for debugging

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { authService } from '@services/auth.service';
import { ApiResponse, AppError, ErrorType } from '@types/api.types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Check if debug mode is enabled
const DEBUG_MODE = import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true';

// Create axios instance with default configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add authentication token and log requests
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication header if user is authenticated
    const modifiedConfig = authService.addAuthHeader(config);
    
    // Log request in debug mode
    if (DEBUG_MODE) {
      console.log('[API Request]', {
        method: modifiedConfig.method?.toUpperCase(),
        url: modifiedConfig.url,
        headers: modifiedConfig.headers,
        data: modifiedConfig.data,
        params: modifiedConfig.params,
        timestamp: new Date().toISOString()
      });
    }
    
    return modifiedConfig;
  },
  (error) => {
    if (DEBUG_MODE) {
      console.error('[API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor to handle authentication errors, rate limiting, and log responses
apiClient.interceptors.response.use(
  (response) => {
    // Log response in debug mode
    if (DEBUG_MODE) {
      console.log('[API Response]', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        config: {
          method: response.config.method?.toUpperCase(),
          url: response.config.url
        },
        timestamp: new Date().toISOString()
      });
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Log error response in debug mode
    if (DEBUG_MODE) {
      console.error('[API Error]', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Try to refresh token
      try {
        const refreshResponse = await authService.refreshToken();
        if (refreshResponse.success && refreshResponse.data) {
          // Retry the original request with new token
          if (originalRequest) {
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${refreshResponse.data.token}`
            };
            return apiClient(originalRequest);
          }
        } else {
          // If refresh failed, logout user
          await authService.logout();
        }
      } catch (refreshError) {
        // If refresh failed, logout user
        await authService.logout();
      }
    }
    
    // Handle rate limiting
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Get retry-after header or default to 1 second
      const retryAfter = error.response.headers['retry-after']
        ? parseInt(error.response.headers['retry-after'], 10) * 1000
        : 1000;
      
      // Wait for the specified time before retrying
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      
      // Retry the request
      return apiClient(originalRequest);
    }
    
    return Promise.reject(error);
  }
);

// Generic API request function with retry logic
export const apiRequest = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
  retries: number = 3
): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<T> = await apiClient({
      method,
      url,
      data,
      ...config,
    });

    return {
      success: true,
      data: response.data,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Handle retry logic for network errors
    if (
      (error.code === 'ECONNABORTED' || error.message === 'Network Error') &&
      retries > 0
    ) {
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
      
      // Retry the request
      return apiRequest<T>(method, url, data, config, retries - 1);
    }
    
    const appError = handleApiError(error);
    return {
      success: false,
      error: appError.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Convenience methods for common HTTP verbs with retry logic
export const apiGet = async <T>(url: string, config?: AxiosRequestConfig, retries?: number): Promise<ApiResponse<T>> => {
  return apiRequest<T>('GET', url, undefined, config, retries);
};

export const apiPost = async <T>(url: string, data?: any, config?: AxiosRequestConfig, retries?: number): Promise<ApiResponse<T>> => {
  return apiRequest<T>('POST', url, data, config, retries);
};

export const apiPut = async <T>(url: string, data?: any, config?: AxiosRequestConfig, retries?: number): Promise<ApiResponse<T>> => {
  return apiRequest<T>('PUT', url, data, config, retries);
};

export const apiDelete = async <T>(url: string, config?: AxiosRequestConfig, retries?: number): Promise<ApiResponse<T>> => {
  return apiRequest<T>('DELETE', url, undefined, config, retries);
};

export const apiPatch = async <T>(url: string, data?: any, config?: AxiosRequestConfig, retries?: number): Promise<ApiResponse<T>> => {
  return apiRequest<T>('PATCH', url, data, config, retries);
};

// Handle API errors and convert them to AppError objects
const handleApiError = (error: any): AppError => {
  // Network error
  if (!error.response) {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: error.message || 'Network error occurred',
      userMessage: 'Unable to connect to the server. Please check your connection.',
      timestamp: new Date(),
    };
  }

  // HTTP error responses
  const status = error.response.status;
  const message = error.response.data?.message || error.message;

  switch (status) {
    case 400:
      return {
        type: ErrorType.VALIDATION_ERROR,
        message: message || 'Invalid request',
        userMessage: 'Please check your input and try again.',
        timestamp: new Date(),
      };
    case 401:
      return {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Authentication required',
        userMessage: 'You need to log in to perform this action.',
        timestamp: new Date(),
      };
    case 403:
      return {
        type: ErrorType.AUTHENTICATION_ERROR,
        message: 'Access forbidden',
        userMessage: 'You do not have permission to perform this action.',
        timestamp: new Date(),
      };
    case 429:
      return {
        type: ErrorType.RATE_LIMIT_ERROR,
        message: 'Rate limit exceeded',
        userMessage: 'Too many requests. Please try again later.',
        timestamp: new Date(),
      };
    case 500:
      return {
        type: ErrorType.API_ERROR,
        message: 'Internal server error',
        userMessage: 'An error occurred on the server. Please try again later.',
        timestamp: new Date(),
      };
    default:
      return {
        type: ErrorType.API_ERROR,
        message: message || 'An unexpected error occurred',
        userMessage: 'An unexpected error occurred. Please try again.',
        timestamp: new Date(),
      };
  }
};

// Export the axios instance for direct use if needed
export { apiClient };

// Export types
export type { AxiosRequestConfig, AxiosResponse };