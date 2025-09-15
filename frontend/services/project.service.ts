// Project Service for Codebase Index Frontend
// This service provides typed methods for project-related API operations

import { apiGet, apiPost, apiDelete } from '@services/api.service';
import {
  Project,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  ProjectReindexResponse,
  IndexingProgress,
  IndexingStats
} from '../types/project.types';
import { ApiResponse } from '../types/api.types';

/**
 * Validate a project path
 * @param path - The path to validate
 * @returns Promise with path validation result
 */
export const validateProjectPath = async (
  path: string
): Promise<ApiResponse<PathValidationResult>> => {
  return apiPost<PathValidationResult>('/projects/validate-path', { path });
};

// Type for path validation result
interface PathValidationResult {
  isValid: boolean;
  exists: boolean;
  isDirectory: boolean;
  fileCount?: number;
  size?: number;
  error?: string;
}

/**
 * Get all projects
 * @returns Promise with list of projects
 */
export const getProjects = async (): Promise<ApiResponse<Project[]>> => {
  return apiGet<Project[]>('/projects');
};

/**
 * Create a new project
 * @param projectData - Project creation data
 * @returns Promise with project creation response
 */
export const createProject = async (
  projectData: any
): Promise<ApiResponse<ProjectCreateResponse>> => {
  return apiPost<ProjectCreateResponse>('/projects', projectData);
};

/**
 * Delete a project
 * @param projectId - The ID of the project to delete
 * @returns Promise with deletion response
 */
export const deleteProject = async (
  projectId: string
): Promise<ApiResponse<ProjectDeleteResponse>> => {
  return apiDelete<ProjectDeleteResponse>(`/projects/${projectId}`);
};

/**
 * Re-index a project
 * @param projectId - The ID of the project to re-index
 * @returns Promise with re-indexing response
 */
export const reindexProject = async (
  projectId: string
): Promise<ApiResponse<ProjectReindexResponse>> => {
  return apiPost<ProjectReindexResponse>(`/projects/${projectId}/reindex`);
};

/**
 * Get project details
 * @param projectId - The ID of the project to get details for
 * @returns Promise with project details
 */
export const getProjectDetails = async (
  projectId: string
): Promise<ApiResponse<Project>> => {
  return apiGet<Project>(`/projects/${projectId}`);
};

/**
 * Update a project
 * @param projectId - The ID of the project to update
 * @param projectData - Project update data
 * @returns Promise with project update response
 */
export const updateProject = async (
  projectId: string,
  projectData: any
): Promise<ApiResponse<Project>> => {
  return apiPost<Project>(`/projects/${projectId}`, projectData);
};

/**
 * Get indexing progress for a project
 * @param projectId - The ID of the project to get progress for
 * @returns Promise with indexing progress data
 */
export const getIndexingProgress = async (
  projectId: string
): Promise<ApiResponse<IndexingProgress>> => {
  return apiGet<IndexingProgress>(`/projects/${projectId}/progress`);
};

/**
 * Get indexing statistics for a project
 * @param projectId - The ID of the project to get stats for
 * @returns Promise with indexing statistics
 */
export const getIndexingStats = async (
  projectId: string
): Promise<ApiResponse<IndexingStats>> => {
  return apiGet<IndexingStats>(`/projects/${projectId}/stats`);
};