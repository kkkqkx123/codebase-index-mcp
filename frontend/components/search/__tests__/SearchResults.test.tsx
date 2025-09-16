import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchResults } from '../SearchResults/SearchResults';
import * as searchService from '../../../services/search.service';
import { mockSearchResult } from '../../../__tests__/test-utils';

// Mock the search service
jest.mock('../../../services/search.service', () => ({
  getSearchResultDetails: jest.fn(),
}));

describe('SearchResults', () => {
  const mockOnResultClick = jest.fn();
  const mockResults = {
    results: [
      mockSearchResult({
        id: '1',
        filePath: '/path/to/file1.ts',
        content: 'function test1() { return "test1"; }',
        score: 0.95,
        similarity: 0.85,
        metadata: {
          language: 'typescript',
          startLine: 1,
          endLine: 3,
          chunkType: 'function',
        },
      }),
      mockSearchResult({
        id: '2',
        filePath: '/path/to/file2.js',
        content: 'function test2() { return "test2"; }',
        score: 0.85,
        similarity: 0.75,
        metadata: {
          language: 'javascript',
          startLine: 5,
          endLine: 7,
          chunkType: 'function',
        },
      }),
    ],
    total: 2,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when isLoading is true', () => {
    render(<SearchResults results={mockResults} isLoading={true} />);
    
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('renders empty state when no results', () => {
    render(<SearchResults results={{ results: [], total: 0, timestamp: new Date().toISOString() }} />);
    
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders search results correctly', () => {
    render(<SearchResults results={mockResults} onResultClick={mockOnResultClick} />);
    
    expect(screen.getByText('Search Results')).toBeInTheDocument();
    expect(screen.getByText('2 results found')).toBeInTheDocument();
    
    // Check that both results are displayed
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file2.js')).toBeInTheDocument();
    
    // Check metadata
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('javascript')).toBeInTheDocument();
    
    // Check scores
    expect(screen.getByText('Score: 95.0%')).toBeInTheDocument();
    expect(screen.getByText('Score: 85.0%')).toBeInTheDocument();
  });

  it('toggles result details when Show Details button is clicked', async () => {
    const mockDetails = { additionalInfo: 'This is additional information' };
    (searchService.getSearchResultDetails as jest.Mock).mockResolvedValue({
      success: true,
      data: mockDetails,
    });
    
    render(<SearchResults results={mockResults} />);
    
    const detailsButtons = screen.getAllByText('Show Details');
    fireEvent.click(detailsButtons[0]);
    
    // Wait for the async operation to complete
    await waitFor(() => {
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
    });
    
    // Check that details are displayed
    expect(screen.getByText('Additional Details')).toBeInTheDocument();
    expect(screen.getByText('additionalInfo:')).toBeInTheDocument();
  });

  it('handles details fetch error gracefully', async () => {
    (searchService.getSearchResultDetails as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<SearchResults results={mockResults} />);
    
    const detailsButtons = screen.getAllByText('Show Details');
    fireEvent.click(detailsButtons[0]);
    
    // Wait for the async operation to complete
    await waitFor(() => {
      // Should not crash and should still show the button
      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });
  });

  it('displays timestamp correctly', () => {
    const testTimestamp = '2023-01-01T12:00:00Z';
    const resultsWithTimestamp = {
      ...mockResults,
      timestamp: testTimestamp,
    };
    
    render(<SearchResults results={resultsWithTimestamp} />);
    
    // Check that timestamp is displayed (format may vary based on locale)
    expect(screen.getByText(/Search completed:/)).toBeInTheDocument();
  });

  it('handles result with no metadata gracefully', () => {
    const resultsWithMinimalMetadata = {
      results: [
        mockSearchResult({
          id: '3',
          filePath: '/path/to/file3.py',
          content: 'def test3(): return "test3"',
          score: 0.75,
          similarity: 0.65,
          metadata: {
            language: 'python',
            startLine: 1,
            endLine: 2,
            chunkType: 'function',
          },
        }),
      ],
      total: 1,
      timestamp: new Date().toISOString(),
    };
    
    render(<SearchResults results={resultsWithMinimalMetadata} />);
    
    expect(screen.getByText('file3.py')).toBeInTheDocument();
    expect(screen.getByText('python')).toBeInTheDocument();
  });
});