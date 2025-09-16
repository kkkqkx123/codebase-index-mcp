import * as indexingService from '../indexing.service';
import { apiGet, apiPost } from '@services/api.service';
import { ProjectStatus, IndexResponse, ApiResponse } from '../../types/api.types';

// Mock the API service functions
jest.mock('@services/api.service', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

describe('Indexing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createIndexingProject', () => {
    test('should call apiPost with correct parameters including options', async () => {
      const path = '/test/project/path';
      const options = {
        include: ['*.ts', '*.tsx'],
        exclude: ['node_modules', '*.test.ts'],
        maxDepth: 5
      };
      
      const mockResponse: ApiResponse<any> = {
        success: true,
        data: {
          projectId: 'project-1',
          status: 'created',
          message: 'Project created successfully'
        },
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await indexingService.createIndexingProject(path, options);

      expect(apiPost).toHaveBeenCalledWith('/indexing/create', {
        path,
        options
      });
      expect(result).toEqual(mockResponse);
    });

    test('should call apiPost with correct parameters without options', async () => {
      const path = '/test/project/path';
      
      const mockResponse: ApiResponse<any> = {
        success: true,
        data: {
          projectId: 'project-1',
          status: 'created'
        },
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await indexingService.createIndexingProject(path);

      expect(apiPost).toHaveBeenCalledWith('/indexing/create', {
        path,
        options: undefined
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getIndexingStatus', () => {
    test('should call apiGet with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockStatus: ProjectStatus = {
        projectId,
        status: 'indexing',
        progress: 75,
        totalFiles: 100,
        processedFiles: 75,
        lastUpdated: new Date(),
        estimatedCompletion: new Date(Date.now() + 300000) // 5 minutes from now
      };
      
      const mockResponse: ApiResponse<ProjectStatus> = {
        success: true,
        data: mockStatus,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await indexingService.getIndexingStatus(projectId);

      expect(apiGet).toHaveBeenCalledWith(`/indexing/status/${projectId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('reindexProject', () => {
    test('should call apiPost with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockResponseData: IndexResponse = {
        success: true,
        filesProcessed: 0,
        filesSkipped: 0,
        processingTime: 0,
        errors: []
      };
      
      const mockResponse: ApiResponse<IndexResponse> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await indexingService.reindexProject(projectId);

      expect(apiPost).toHaveBeenCalledWith(`/indexing/reindex/${projectId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('cancelIndexing', () => {
    test('should call apiPost with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockResponseData = {
        success: true,
        message: 'Indexing process cancelled'
      };
      
      const mockResponse: ApiResponse<{ success: boolean; message: string }> = {
        success: true,
        data: mockResponseData,
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await indexingService.cancelIndexing(projectId);

      expect(apiPost).toHaveBeenCalledWith(`/indexing/cancel/${projectId}`);
      expect(result).toEqual(mockResponse);
    });
  });
});