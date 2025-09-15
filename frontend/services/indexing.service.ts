// Indexing Service for Codebase Index Frontend
// This service provides typed methods for indexing-related API operations

import { apiGet, apiPost } from '@services/api.service';
import {
  ProjectStatus,
  IndexResponse,
  ApiResponse
} from '../types/api.types';

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
  return apiPost<CreateProjectResponse>('/indexing/create', {
    path,
    options
  });
};

/**
 * Get the status of an indexing project
 * @param projectId - The ID of the project to check
 * @returns Promise with project status
 */
export const getIndexingStatus = async (
  projectId: string
): Promise<ApiResponse<ProjectStatus>> => {
  return apiGet<ProjectStatus>(`/indexing/status/${projectId}`);
};

/**
 * Trigger re-indexing for an existing project
 * @param projectId - The ID of the project to re-index
 * @returns Promise with re-indexing response
 */
export const reindexProject = async (
  projectId: string
): Promise<ApiResponse<IndexResponse>> => {
  return apiPost<IndexResponse>(`/indexing/reindex/${projectId}`);
};

/**
 * Cancel an ongoing indexing process
 * @param projectId - The ID of the project to cancel
 * @returns Promise with cancellation response
 */
export const cancelIndexing = async (
  projectId: string
): Promise<ApiResponse<{ success: boolean; message: string }>> => {
  return apiPost<{ success: boolean; message: string }>(`/indexing/cancel/${projectId}`);
};