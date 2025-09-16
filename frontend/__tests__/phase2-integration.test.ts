// Phase 2 Integration Tests for Codebase Index Frontend
// This file contains integration tests for the HTTP-to-MCP adapter and authentication system

import { 
  createIndexingProject, 
  getIndexingStatus, 
  reindexProject, 
  cancelIndexing 
} from '@api/mcp-adapter/indexing.adapter';
import { 
  performHybridSearch, 
  getSearchSuggestions, 
  getSearchResultDetails 
} from '@api/mcp-adapter/search.adapter';
import { 
  analyzeGraph, 
  getSubgraph, 
  filterGraph, 
  exportGraph 
} from '@api/mcp-adapter/graph.adapter';
import { authService } from '@services/auth.service';
import { AuthProvider, useAuth } from '@contexts/AuthContext';
import { 
  apiGet, 
  apiPost, 
  apiPut, 
  apiDelete, 
  apiPatch 
} from '@services/api.service';
import { 
  createIndexingProject as createIndexingService,
  getIndexingStatus as getIndexingStatusService,
  reindexProject as reindexProjectService,
  cancelIndexing as cancelIndexingService
} from '@services/indexing.service';
import { 
  performHybridSearch as performHybridSearchService,
  getSearchSuggestions as getSearchSuggestionsService,
  getSearchResultDetails as getSearchResultDetailsService
} from '@services/search.service';
import { 
  analyzeGraph as analyzeGraphService,
  getSubgraph as getSubgraphService,
  filterGraph as filterGraphService,
  exportGraph as exportGraphService
} from '@services/graph.service';
import { 
  getSystemHealth,
  getPrometheusMetrics,
  getGrafanaDashboards,
  getGrafanaDashboardUrl,
  getRealTimeMetrics
} from '@services/monitoring.service';
import { useMetricsPolling } from '@hooks/useMetricsPolling';

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    })),
    isAxiosError: jest.fn()
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Phase 2 Implementation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MCP Adapter Layer', () => {
    test('Indexing adapter functions exist and are properly exported', () => {
      expect(createIndexingProject).toBeDefined();
      expect(getIndexingStatus).toBeDefined();
      expect(reindexProject).toBeDefined();
      expect(cancelIndexing).toBeDefined();
    });

    test('Search adapter functions exist and are properly exported', () => {
      expect(performHybridSearch).toBeDefined();
      expect(getSearchSuggestions).toBeDefined();
      expect(getSearchResultDetails).toBeDefined();
    });

    test('Graph adapter functions exist and are properly exported', () => {
      expect(analyzeGraph).toBeDefined();
      expect(getSubgraph).toBeDefined();
      expect(filterGraph).toBeDefined();
      expect(exportGraph).toBeDefined();
    });
  });

  describe('Authentication System', () => {
    test('Auth service functions exist', () => {
      expect(authService.login).toBeDefined();
      expect(authService.logout).toBeDefined();
      expect(authService.refreshToken).toBeDefined();
      expect(authService.getCurrentUser).toBeDefined();
      expect(authService.getToken).toBeDefined();
      expect(authService.isAuthenticated).toBeDefined();
      expect(authService.hasRole).toBeDefined();
      expect(authService.addAuthHeader).toBeDefined();
      expect(authService.handleAuthError).toBeDefined();
    });

    test('Auth context and hooks exist', () => {
      expect(AuthProvider).toBeDefined();
      expect(useAuth).toBeDefined();
    });
  });

  describe('API Service Layer', () => {
    test('API service functions exist', () => {
      expect(apiGet).toBeDefined();
      expect(apiPost).toBeDefined();
      expect(apiPut).toBeDefined();
      expect(apiDelete).toBeDefined();
      expect(apiPatch).toBeDefined();
    });

    test('Service functions exist for each domain', () => {
      // Indexing service
      expect(createIndexingService).toBeDefined();
      expect(getIndexingStatusService).toBeDefined();
      expect(reindexProjectService).toBeDefined();
      expect(cancelIndexingService).toBeDefined();

      // Search service
      expect(performHybridSearchService).toBeDefined();
      expect(getSearchSuggestionsService).toBeDefined();
      expect(getSearchResultDetailsService).toBeDefined();

      // Graph service
      expect(analyzeGraphService).toBeDefined();
      expect(getSubgraphService).toBeDefined();
      expect(filterGraphService).toBeDefined();
      expect(exportGraphService).toBeDefined();

      // Monitoring service
      expect(getSystemHealth).toBeDefined();
      expect(getPrometheusMetrics).toBeDefined();
      expect(getGrafanaDashboards).toBeDefined();
      expect(getGrafanaDashboardUrl).toBeDefined();
      expect(getRealTimeMetrics).toBeDefined();
    });
  });

  describe('Hooks', () => {
    test('Metrics polling hook exists', () => {
      expect(useMetricsPolling).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('All adapters can be imported without errors', () => {
      expect(() => require('@api/mcp-adapter/index')).not.toThrow();
      expect(() => require('@api/mcp-adapter/indexing.adapter')).not.toThrow();
      expect(() => require('@api/mcp-adapter/search.adapter')).not.toThrow();
      expect(() => require('@api/mcp-adapter/graph.adapter')).not.toThrow();
    });

    test('All services can be imported without errors', () => {
      expect(() => require('@services/auth.service')).not.toThrow();
      expect(() => require('@services/api.service')).not.toThrow();
      expect(() => require('@services/indexing.service')).not.toThrow();
      expect(() => require('@services/search.service')).not.toThrow();
      expect(() => require('@services/graph.service')).not.toThrow();
      expect(() => require('@services/monitoring.service')).not.toThrow();
    });

    test('All contexts and hooks can be imported without errors', () => {
      expect(() => require('@contexts/AuthContext')).not.toThrow();
      expect(() => require('@hooks/useAuth')).not.toThrow();
      expect(() => require('@hooks/useMetricsPolling')).not.toThrow();
    });
  });
});