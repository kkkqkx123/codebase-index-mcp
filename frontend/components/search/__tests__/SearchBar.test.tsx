import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBar } from '../SearchBar/SearchBar';
import * as searchService from '../../../services/search.service';
import { mockProject } from '../../../__tests__/test-utils';

// Mock the search service
jest.mock('../../../services/search.service', () => ({
  getSearchSuggestions: jest.fn(),
}));

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();
  const mockProjects = [
    mockProject({ id: '1', name: 'Project 1' }),
    mockProject({ id: '2', name: 'Project 2' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with basic elements', () => {
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    expect(screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Advanced' })).toBeInTheDocument();
  });

  it('calls onSearch when form is submitted with valid query', () => {
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    const form = screen.getByRole('form');
    
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.submit(form);
    
    expect(mockOnSearch).toHaveBeenCalledWith({
      text: 'test query',
      limit: 50,
      threshold: 0.7,
      includeGraph: false,
    });
  });

  it('does not call onSearch when form is submitted with empty query', () => {
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    
    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  it('fetches and displays suggestions when typing', async () => {
    const mockSuggestions = ['test suggestion 1', 'test suggestion 2'];
    (searchService.getSearchSuggestions as jest.Mock).mockResolvedValue({
      success: true,
      data: mockSuggestions,
    });
    
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    fireEvent.change(input, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText('test suggestion 1')).toBeInTheDocument();
      expect(screen.getByText('test suggestion 2')).toBeInTheDocument();
    });
  });

  it('handles suggestion click correctly', async () => {
    const mockSuggestions = ['test suggestion'];
    (searchService.getSearchSuggestions as jest.Mock).mockResolvedValue({
      success: true,
      data: mockSuggestions,
    });
    
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    fireEvent.change(input, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText('test suggestion')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('test suggestion'));
    
    expect(mockOnSearch).toHaveBeenCalledWith({
      text: 'test suggestion',
      limit: 50,
      threshold: 0.7,
      includeGraph: false,
    });
  });

  it('toggles advanced options visibility', () => {
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const toggleButton = screen.getByRole('button', { name: 'Show Advanced' });
    expect(screen.queryByText('Project:')).not.toBeInTheDocument();
    
    fireEvent.click(toggleButton);
    expect(screen.getByText('Project:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Advanced' })).toBeInTheDocument();
    
    fireEvent.click(screen.getByRole('button', { name: 'Hide Advanced' }));
    expect(screen.queryByText('Project:')).not.toBeInTheDocument();
  });

  it('updates advanced options correctly', () => {
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    // Show advanced options
    fireEvent.click(screen.getByRole('button', { name: 'Show Advanced' }));
    
    // Select a project
    const projectSelect = screen.getByRole('combobox');
    fireEvent.change(projectSelect, { target: { value: '1' } });
    
    // Select a file type
    const tsCheckbox = screen.getByLabelText('ts');
    fireEvent.click(tsCheckbox);
    
    // Submit form
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    fireEvent.change(input, { target: { value: 'test query' } });
    
    const form = screen.getByRole('form');
    fireEvent.submit(form);
    
    expect(mockOnSearch).toHaveBeenCalledWith({
      text: 'test query',
      projectId: '1',
      fileTypes: ['ts'],
      limit: 50,
      threshold: 0.7,
      includeGraph: false,
    });
  });

  it('handles suggestion loading state', async () => {
    (searchService.getSearchSuggestions as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] }), 100))
    );
    
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();
  });

  it('handles suggestion fetch errors gracefully', async () => {
    (searchService.getSearchSuggestions as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<SearchBar onSearch={mockOnSearch} projects={mockProjects} />);
    
    const input = screen.getByPlaceholderText('Search code... (Ctrl+/ to focus)');
    fireEvent.change(input, { target: { value: 'test' } });
    
    await waitFor(() => {
      // Should not crash and should not show suggestions
      expect(screen.queryByText('Loading suggestions...')).not.toBeInTheDocument();
    });
  });
});