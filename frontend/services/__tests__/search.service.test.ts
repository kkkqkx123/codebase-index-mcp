import * as searchService from '../search.service';
import { apiGet, apiPost } from '@services/api.service';
import { SearchQuery, SearchResults, ApiResponse } from '../../types/api.types';

// Mock the API service functions
jest.mock('@services/api.service', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

describe('Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performHybridSearch', () => {
    test('should call apiPost with correct parameters', async () => {
      const mockQuery: SearchQuery = {
        text: 'test search',
        projectId: 'project-1',
        limit: 10,
        threshold: 0.5,
        includeGraph: false,
        fileTypes: undefined
      };
      
      const mockResults: SearchResults = {
        results: [
          {
            id: 'result-1',
            filePath: '/path/to/file.ts',
            content: 'function test() { return "test"; }',
            score: 0.95,
            similarity: 0.85,
            metadata: {
              language: 'typescript',
              startLine: 1,
              endLine: 1,
              chunkType: 'function'
            }
          }
        ],
        total: 1,
        timestamp: new Date().toISOString()
      };
      
      const mockResponse: ApiResponse<SearchResults> = {
        success: true,
        data: mockResults,
        timestamp: new Date().toISOString()
      };
      
      (apiPost as jest.Mock).mockResolvedValue(mockResponse);

      const result = await searchService.performHybridSearch(mockQuery);

      expect(apiPost).toHaveBeenCalledWith('/search/hybrid', mockQuery);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSearchSuggestions', () => {
    test('should call apiGet with correct parameters including project ID', async () => {
      const partialQuery = 'test';
      const projectId = 'project-1';
      const mockSuggestions = ['test', 'testing', 'tester'];
      
      const mockResponse: ApiResponse<string[]> = {
        success: true,
        data: mockSuggestions,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await searchService.getSearchSuggestions(partialQuery, projectId);

      expect(apiGet).toHaveBeenCalledWith('/search/suggestions?query=test&projectId=project-1');
      expect(result).toEqual(mockResponse);
    });

    test('should call apiGet with correct parameters without project ID', async () => {
      const partialQuery = 'test';
      const mockSuggestions = ['test', 'testing', 'tester'];
      
      const mockResponse: ApiResponse<string[]> = {
        success: true,
        data: mockSuggestions,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await searchService.getSearchSuggestions(partialQuery);

      expect(apiGet).toHaveBeenCalledWith('/search/suggestions?query=test');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSearchResultDetails', () => {
    test('should call apiGet with correct endpoint', async () => {
      const resultId = 'result-1';
      const mockDetails = {
        id: resultId,
        filePath: '/path/to/file.ts',
        content: 'function test() { return "test"; }',
        score: 0.95,
        similarity: 0.85,
        metadata: {
          language: 'typescript',
          startLine: 1,
          endLine: 1,
          chunkType: 'function'
        }
      };
      
      const mockResponse: ApiResponse<any> = {
        success: true,
        data: mockDetails,
        timestamp: new Date().toISOString()
      };
      
      (apiGet as jest.Mock).mockResolvedValue(mockResponse);

      const result = await searchService.getSearchResultDetails(resultId);

      expect(apiGet).toHaveBeenCalledWith(`/search/result/${resultId}`);
      expect(result).toEqual(mockResponse);
    });
  });
});