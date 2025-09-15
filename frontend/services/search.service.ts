// Search Service for Codebase Index Frontend
// This service provides typed methods for search-related API operations

import { apiGet, apiPost } from '@services/api.service';
import { 
  SearchQuery, 
  SearchResults, 
  ApiResponse
} from '@types/api.types';

/**
 * Perform a hybrid search across indexed codebases
 * @param query - The search query parameters
 * @returns Promise with search results
 */
export const performHybridSearch = async (
  query: SearchQuery
): Promise<ApiResponse<SearchResults>> => {
  return apiPost<SearchResults>('/search/hybrid', query);
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
  const params = new URLSearchParams();
  params.append('query', partialQuery);
  if (projectId) {
    params.append('projectId', projectId);
  }
  
  return apiGet<string[]>(`/search/suggestions?${params.toString()}`);
};

/**
 * Get detailed information about a search result
 * @param resultId - The ID of the search result
 * @returns Promise with detailed search result information
 */
export const getSearchResultDetails = async (
  resultId: string
): Promise<ApiResponse<any>> => {
  return apiGet<any>(`/search/result/${resultId}`);
};