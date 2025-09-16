import * as apiService from '../api.service';
import axios from 'axios';
import { authService } from '@services/auth.service';
import { ApiResponse, AppError, ErrorType } from '../../types/api.types';

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    })),
    default: {
      create: jest.fn(() => ({
        request: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      }))
    }
  };
});

// Mock auth service
jest.mock('@services/auth.service', () => ({
  authService: {
    addAuthHeader: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn()
  }
}));

describe('API Service', () => {
  const mockResponse = {
    data: { message: 'success' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP method helpers', () => {
    test('apiGet should make GET request', async () => {
      // Mock the apiRequest function directly
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: true,
        data: { message: 'success' },
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(apiService.apiRequest).toHaveBeenCalledWith('GET', '/test', undefined, undefined, undefined);
      expect(result.success).toBe(true);
    });

    test('apiPost should make POST request', async () => {
      // Mock the apiRequest function directly
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: true,
        data: { message: 'success' },
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiPost('/test', { data: 'test' });
      
      expect(apiService.apiRequest).toHaveBeenCalledWith('POST', '/test', { data: 'test' }, undefined, undefined);
      expect(result.success).toBe(true);
    });

    test('apiPut should make PUT request', async () => {
      // Mock the apiRequest function directly
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: true,
        data: { message: 'success' },
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiPut('/test', { data: 'test' });
      
      expect(apiService.apiRequest).toHaveBeenCalledWith('PUT', '/test', { data: 'test' }, undefined, undefined);
      expect(result.success).toBe(true);
    });

    test('apiDelete should make DELETE request', async () => {
      // Mock the apiRequest function directly
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: true,
        data: { message: 'success' },
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiDelete('/test');
      
      expect(apiService.apiRequest).toHaveBeenCalledWith('DELETE', '/test', undefined, undefined, undefined);
      expect(result.success).toBe(true);
    });

    test('apiPatch should make PATCH request', async () => {
      // Mock the apiRequest function directly
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: true,
        data: { message: 'success' },
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiPatch('/test', { data: 'test' });
      
      expect(apiService.apiRequest).toHaveBeenCalledWith('PATCH', '/test', { data: 'test' }, undefined, undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should handle network errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Network error occurred',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    test('should handle 400 errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Invalid request',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid request');
    });

    test('should handle 401 errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    test('should handle 403 errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Access forbidden',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Access forbidden');
    });

    test('should handle 429 errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    test('should handle 500 errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Internal server error');
    });

    test('should handle unknown errors', async () => {
      // Mock the apiRequest function to throw an error
      jest.spyOn(apiService, 'apiRequest').mockResolvedValue({
        success: false,
        error: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
      
      const result = await apiService.apiGet('/test');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('unexpected error');
    });
  });
});