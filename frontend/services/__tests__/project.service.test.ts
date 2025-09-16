import * as projectService from '../project.service';
import { apiGet, apiPost, apiDelete } from '@services/api.service';
import {
  Project,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  ProjectReindexResponse,
  IndexingProgress,
  IndexingStats
} from '../../types/project.types';
import { ApiResponse } from '../../types/api.types';

// Mock the API service functions
jest.mock('@services/api.service', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiDelete: jest.fn()
}));

describe('Project Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProjectPath', () => {
    test('should call apiPost with correct parameters', async () => {
      const mockResponse: ApiResponse<any> = {
        success: true,
        data: {
          isValid: true,
          exists: true,
          isDirectory: true,
          fileCount: 10,
          size: 1024
        },
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.validateProjectPath('/test/path');

      expect(apiPost).toHaveBeenCalledWith('/projects/validate-path', { path: '/test/path' });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProjects', () => {
    test('should call apiGet with correct endpoint', async () => {
      const mockProjects: Project[] = [
        {
          id: 'project-1',
          name: 'Test Project',
          path: '/test/path',
          status: 'completed',
          progress: 100,
          lastIndexed: new Date(),
          fileCount: 100,
          size: 1024,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockResponse: ApiResponse<Project[]> = {
        success: true,
        data: mockProjects,
        timestamp: new Date().toISOString()
      };

      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.getProjects();

      expect(apiGet).toHaveBeenCalledWith('/projects');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createProject', () => {
    test('should call apiPost with correct parameters', async () => {
      const projectData = {
        name: 'New Project',
        path: '/new/path'
      };

      const mockResponse: ApiResponse<ProjectCreateResponse> = {
        success: true,
        data: {
          success: true,
          projectId: 'project-1'
        },
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.createProject(projectData);

      expect(apiPost).toHaveBeenCalledWith('/projects', projectData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteProject', () => {
    test('should call apiDelete with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockResponse: ApiResponse<ProjectDeleteResponse> = {
        success: true,
        data: {
          message: 'Project deleted successfully',
          success: false
        },
        timestamp: new Date().toISOString()
      };

      (apiDelete as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.deleteProject(projectId);

      expect(apiDelete).toHaveBeenCalledWith(`/projects/${projectId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('reindexProject', () => {
    test('should call apiPost with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockResponse: ApiResponse<ProjectReindexResponse> = {
        success: true,
        data: {
          message: 'Re-indexing started',
          success: false
        },
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.reindexProject(projectId);

      expect(apiPost).toHaveBeenCalledWith(`/projects/${projectId}/reindex`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getProjectDetails', () => {
    test('should call apiGet with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockProject: Project = {
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
        status: 'completed',
        progress: 100,
        lastIndexed: new Date(),
        fileCount: 100,
        size: 1024,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockResponse: ApiResponse<Project> = {
        success: true,
        data: mockProject,
        timestamp: new Date().toISOString()
      };

      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.getProjectDetails(projectId);

      expect(apiGet).toHaveBeenCalledWith(`/projects/${projectId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateProject', () => {
    test('should call apiPost with correct endpoint and data', async () => {
      const projectId = 'project-1';
      const projectData = {
        name: 'Updated Project Name'
      };

      const mockProject: Project = {
        id: projectId,
        name: 'Updated Project Name',
        path: '/test/path',
        status: 'completed',
        progress: 100,
        lastIndexed: new Date(),
        fileCount: 100,
        size: 1024,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockResponse: ApiResponse<Project> = {
        success: true,
        data: mockProject,
        timestamp: new Date().toISOString()
      };

      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.updateProject(projectId, projectData);

      expect(apiPost).toHaveBeenCalledWith(`/projects/${projectId}`, projectData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getIndexingProgress', () => {
    test('should call apiGet with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockProgress: IndexingProgress = {
        projectId,
        status: 'running',
        totalFiles: 100,
        processedFiles: 50,
        currentFile: '/test/file.ts',
        startTime: new Date()
      };

      const mockResponse: ApiResponse<IndexingProgress> = {
        success: true,
        data: mockProgress,
        timestamp: new Date().toISOString()
      };

      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.getIndexingProgress(projectId);

      expect(apiGet).toHaveBeenCalledWith(`/projects/${projectId}/progress`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getIndexingStats', () => {
    test('should call apiGet with correct endpoint', async () => {
      const projectId = 'project-1';
      const mockStats: IndexingStats = {
        processingRate: 50,
        averageFileSize: 1200,
        totalSizeProcessed: 120000,
        errors: 0
      };

      const mockResponse: ApiResponse<IndexingStats> = {
        success: true,
        data: mockStats,
        timestamp: new Date().toISOString()
      };

      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await projectService.getIndexingStats(projectId);

      expect(apiGet).toHaveBeenCalledWith(`/projects/${projectId}/stats`);
      expect(result).toEqual(mockResponse);
    });
  });
});