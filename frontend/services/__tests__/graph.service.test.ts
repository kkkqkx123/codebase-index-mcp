import * as graphService from '../graph.service';
import { apiPost } from '@services/api.service';
import { GraphData, ApiResponse } from '../../types/api.types';

// Mock the API service functions
jest.mock('@services/api.service', () => ({
  apiPost: jest.fn()
}));

describe('Graph Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeGraph', () => {
    test('should call apiPost with correct parameters', async () => {
      const mockRequest = {
        projectId: 'project-1',
        options: {
          depth: 2,
          nodeTypes: ['function', 'class'],
          relationshipTypes: ['calls', 'inherits'],
          includeExternal: true
        }
      };

      const mockGraphData: GraphData = {
        nodes: [
          {
            id: 'node-1',
            label: 'TestFunction',
            type: 'function',
            x: 0,
            y: 0,
            metadata: {
              filePath: '/path/to/file.ts',
              startLine: 10,
              endLine: 20
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'calls',
            weight: 1
          }
        ],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          layout: '',
          renderingTime: 0
        }
      };

      const mockResponse: ApiResponse<GraphData> = {
        success: true,
        data: mockGraphData,
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await graphService.analyzeGraph(mockRequest);

      expect(apiPost).toHaveBeenCalledWith('/graph/analyze', mockRequest);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSubgraph', () => {
    test('should call apiPost with correct parameters', async () => {
      const projectId = 'project-1';
      const nodeIds = ['node-1', 'node-2', 'node-3'];

      const mockGraphData: GraphData = {
        nodes: [
          {
            id: 'node-1',
            label: 'TestFunction',
            type: 'function',
            x: 0,
            y: 0,
            metadata: {
              filePath: '/path/to/file.ts',
              startLine: 10,
              endLine: 20
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'calls',
            weight: 1
          }
        ],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          layout: '',
          renderingTime: 0
        }
      };

      const mockResponse: ApiResponse<GraphData> = {
        success: true,
        data: mockGraphData,
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await graphService.getSubgraph(projectId, nodeIds);

      expect(apiPost).toHaveBeenCalledWith('/graph/subgraph', {
        projectId,
        nodeIds
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('filterGraph', () => {
    test('should call apiPost with correct parameters', async () => {
      const mockGraphData: GraphData = {
        nodes: [
          {
            id: 'node-1',
            label: 'TestFunction',
            type: 'function',
            x: 0,
            y: 0,
            metadata: {
              filePath: '/path/to/file.ts',
              startLine: 10,
              endLine: 20
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'calls',
            weight: 1
          }
        ],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          layout: '',
          renderingTime: 0
        }
      };

      const mockFilters = {
        nodeTypes: ['function'],
        relationshipTypes: ['calls'],
        searchText: 'Test'
      };

      const mockResponse: ApiResponse<GraphData> = {
        success: true,
        data: mockGraphData,
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await graphService.filterGraph(mockGraphData, mockFilters);

      expect(apiPost).toHaveBeenCalledWith('/graph/filter', {
        graphData: mockGraphData,
        filters: mockFilters
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('exportGraph', () => {
    test('should call apiPost with correct parameters', async () => {
      const projectId = 'project-1';
      const format: 'json' | 'png' | 'svg' = 'json';

      const mockExportResult = {
        url: 'http://example.com/export.json',
        filename: 'graph-export.json'
      };

      const mockResponse: ApiResponse<{ url: string; filename: string }> = {
        success: true,
        data: mockExportResult,
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await graphService.exportGraph(projectId, format);

      expect(apiPost).toHaveBeenCalledWith('/graph/export', {
        projectId,
        format
      });
      expect(result).toEqual(mockResponse);
    });
  });
});