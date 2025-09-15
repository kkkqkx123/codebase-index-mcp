// Authentication Service for Codebase Index Frontend
// This service handles JWT authentication, login/logout functionality,
// and request/response interceptors for authentication

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse, AppError, ErrorType } from '../types/api.types';

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create axios instance for authentication operations
const authApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  timeout: 10000,
});

// User interface
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
}

// Login request interface
interface LoginRequest {
  username: string;
  password: string;
}

// Login response interface
interface LoginResponse {
  user: User;
  token: string;
  expiresIn: number;
}

// Authentication service class
class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    // Initialize from localStorage if available
    this.loadFromStorage();
  }

  /**
   * Login user with username and password
   * @param username - User's username
   * @param password - User's password
   * @returns Promise with login response
   */
  async login(username: string, password: string): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await authApi.post<LoginResponse>('/login', { username, password });
      const { user, token, expiresIn } = response.data;

      // Store token and user data
      this.token = token;
      this.user = user;
      this.tokenExpiry = Date.now() + expiresIn * 1000; // Convert to milliseconds

      // Save to localStorage
      this.saveToStorage();

      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const appError = this.handleAxiosError(error, 'Login failed');
      return {
        success: false,
        error: appError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Logout current user
   * @returns Promise with logout response
   */
  async logout(): Promise<ApiResponse<{ message: string }>> {
    try {
      // If we have a token, try to logout on the server
      if (this.token) {
        await authApi.post('/logout', {}, {
          headers: { Authorization: `Bearer ${this.token}` }
        });
      }

      // Clear local data
      this.clearAuthData();

      return {
        success: true,
        data: { message: 'Successfully logged out' },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Even if server logout fails, clear local data
      this.clearAuthData();
      
      // Return success since local logout succeeded
      return {
        success: true,
        data: { message: 'Successfully logged out' },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Refresh authentication token
   * @returns Promise with refresh response
   */
  async refreshToken(): Promise<ApiResponse<{ token: string; expiresIn: number }>> {
    try {
      if (!this.token) {
        throw new Error('No token available for refresh');
      }

      const response = await authApi.post<{ token: string; expiresIn: number }>('/refresh', {}, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const { token, expiresIn } = response.data;

      // Update token
      this.token = token;
      this.tokenExpiry = Date.now() + expiresIn * 1000;

      // Save to localStorage
      this.saveToStorage();

      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const appError = this.handleAxiosError(error, 'Token refresh failed');
      return {
        success: false,
        error: appError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get current user
   * @returns Current user or null if not authenticated
   */
  getCurrentUser(): User | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.user;
  }

  /**
   * Get authentication token
   * @returns Authentication token or null if not authenticated
   */
  getToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.token;
  }

  /**
   * Check if user is authenticated
   * @returns True if user is authenticated and token is not expired
   */
  isAuthenticated(): boolean {
    if (!this.token || !this.tokenExpiry) {
      return false;
    }

    // Check if token is expired
    return Date.now() < this.tokenExpiry;
  }

  /**
   * Check if current user has required role
   * @param role - Required role
   * @returns True if user has required role
   */
  hasRole(role: 'admin' | 'user' | 'viewer'): boolean {
    if (!this.user) {
      return false;
    }
    return this.user.role === role || (role === 'user' && this.user.role === 'admin');
  }

  /**
   * Add authentication header to axios request config
   * @param config - Axios request config
   * @returns Modified axios request config with authentication header
   */
  addAuthHeader(config: any): any {
    const token = this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }
    return config;
  }

  /**
   * Handle authentication error response
   * @param error - Axios error
   * @returns True if error was handled as authentication error
   */
  handleAuthError(error: AxiosError): boolean {
    if (error.response?.status === 401) {
      // Clear auth data on 401 Unauthorized
      this.clearAuthData();
      return true;
    }
    return false;
  }

  /**
   * Load authentication data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('authUser');
      const expiry = localStorage.getItem('authExpiry');

      if (token && user && expiry) {
        this.token = token;
        this.user = JSON.parse(user);
        this.tokenExpiry = parseInt(expiry, 10);

        // Check if token is expired
        if (Date.now() >= this.tokenExpiry) {
          this.clearAuthData();
        }
      }
    } catch (error) {
      // If there's an error parsing, clear auth data
      this.clearAuthData();
    }
  }

  /**
   * Save authentication data to localStorage
   */
  private saveToStorage(): void {
    if (this.token && this.user && this.tokenExpiry) {
      localStorage.setItem('authToken', this.token);
      localStorage.setItem('authUser', JSON.stringify(this.user));
      localStorage.setItem('authExpiry', this.tokenExpiry.toString());
    }
  }

  /**
   * Clear authentication data from memory and localStorage
   */
  private clearAuthData(): void {
    this.token = null;
    this.user = null;
    this.tokenExpiry = null;

    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('authExpiry');
  }

  /**
   * Handle axios errors and convert them to AppError objects
   * @param error - The axios error
   * @param defaultMessage - Default message to use if none is provided
   * @returns AppError object
   */
  private handleAxiosError(error: unknown, defaultMessage: string): AppError {
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
            message: 'Authentication failed',
            userMessage: 'Invalid username or password.',
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
  }
}

// Create and export singleton instance
export const authService = new AuthService();

// Export types
export type { LoginRequest, LoginResponse };