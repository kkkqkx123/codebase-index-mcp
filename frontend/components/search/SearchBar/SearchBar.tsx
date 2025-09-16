import React, { useState, useCallback, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { SearchQuery } from '../../../types/api.types';
import { getSearchSuggestions } from '../../../services/search.service';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearch: (query: SearchQuery) => void;
  projects?: Array<{ id: string; name: string }>;
  className?: string;
}

interface AdvancedSearchOptions {
  projectId?: string;
  fileTypes: string[];
  threshold: number;
  includeGraph: boolean;
}

const DEFAULT_FILE_TYPES = ['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h'];

export const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  projects = [], 
  className = '' 
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedSearchOptions>({
    projectId: undefined,
    fileTypes: [],
    threshold: 0.7,
    includeGraph: false
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced function to fetch suggestions
  const debouncedFetchSuggestions = useDebouncedCallback(async (searchText: string) => {
    if (searchText.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await getSearchSuggestions(searchText, advancedOptions.projectId);
      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, 300);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim()) {
      debouncedFetchSuggestions(value);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [debouncedFetchSuggestions]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const searchQuery: SearchQuery = {
      text: query,
      projectId: advancedOptions.projectId,
      fileTypes: advancedOptions.fileTypes.length > 0 ? advancedOptions.fileTypes : undefined,
      limit: 50,
      threshold: advancedOptions.threshold,
      includeGraph: advancedOptions.includeGraph
    };

    onSearch(searchQuery);
    setShowSuggestions(false);
  }, [query, advancedOptions, onSearch]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    
    const searchQuery: SearchQuery = {
      text: suggestion,
      projectId: advancedOptions.projectId,
      fileTypes: advancedOptions.fileTypes.length > 0 ? advancedOptions.fileTypes : undefined,
      limit: 50,
      threshold: advancedOptions.threshold,
      includeGraph: advancedOptions.includeGraph
    };

    onSearch(searchQuery);
  }, [advancedOptions, onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    } else if (e.key === '/' && e.ctrlKey) {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  }, [handleSubmit]);

  const toggleFileType = useCallback((fileType: string) => {
    setAdvancedOptions(prev => ({
      ...prev,
      fileTypes: prev.fileTypes.includes(fileType)
        ? prev.fileTypes.filter(ft => ft !== fileType)
        : [...prev.fileTypes, fileType]
    }));
  }, []);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`${styles.searchBar} ${className}`}>
      <form onSubmit={handleSubmit} className={styles.searchForm}>
        <div className={styles.searchInputContainer}>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search code... (Ctrl+/ to focus)"
            className={styles.searchInput}
            onFocus={() => query.trim() && setShowSuggestions(true)}
          />
          <button type="submit" className={styles.searchButton} disabled={!query.trim()}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
          <div ref={suggestionsRef} className={styles.suggestionsContainer}>
            {isLoadingSuggestions ? (
              <div className={styles.suggestionItem}>Loading suggestions...</div>
            ) : (
              suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))
            )}
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          type="button"
          className={styles.advancedToggle}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className={styles.advancedOptions}>
            <div className={styles.advancedOption}>
              <label className={styles.optionLabel}>Project:</label>
              <select
                className={styles.optionSelect}
                value={advancedOptions.projectId || ''}
                onChange={(e) => setAdvancedOptions(prev => ({
                  ...prev,
                  projectId: e.target.value || undefined
                }))}
              >
                <option value="">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.advancedOption}>
              <label className={styles.optionLabel}>File Types:</label>
              <div className={styles.fileTypesContainer}>
                {DEFAULT_FILE_TYPES.map(fileType => (
                  <label key={fileType} className={styles.fileTypeLabel}>
                    <input
                      type="checkbox"
                      checked={advancedOptions.fileTypes.includes(fileType)}
                      onChange={() => toggleFileType(fileType)}
                      className={styles.fileTypeCheckbox}
                    />
                    {fileType}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.advancedOption}>
              <label className={styles.optionLabel}>
                Similarity Threshold: {Math.round(advancedOptions.threshold * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={advancedOptions.threshold}
                onChange={(e) => setAdvancedOptions(prev => ({
                  ...prev,
                  threshold: parseFloat(e.target.value)
                }))}
                className={styles.thresholdSlider}
              />
            </div>

            <div className={styles.advancedOption}>
              <label className={styles.fileTypeLabel}>
                <input
                  type="checkbox"
                  checked={advancedOptions.includeGraph}
                  onChange={(e) => setAdvancedOptions(prev => ({
                    ...prev,
                    includeGraph: e.target.checked
                  }))}
                  className={styles.fileTypeCheckbox}
                />
                Include Graph Analysis
              </label>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};