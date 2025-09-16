import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchQuery, SearchResults as SearchResultsType, SearchResult } from '../../types/api.types';
import { performHybridSearch } from '../../services/search.service';
import { getProjects } from '../../services/project.service';
import { SearchBar } from './SearchBar/SearchBar';
import { SearchResults } from './SearchResults/SearchResults';
import { ResultFilters } from './ResultFilters/ResultFilters';
import SearchHistory from './SearchHistory/SearchHistory';
import type { SearchHistoryRef } from './SearchHistory/SearchHistory';
import styles from './CodeSearch.module.css';

interface Project {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
}

export const CodeSearch: React.FC = () => {
  const [searchResults, setSearchResults] = useState<SearchResultsType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentFilters, setCurrentFilters] = useState<Partial<SearchQuery>>({});
  const [lastSearchQuery, setLastSearchQuery] = useState<SearchQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const searchHistoryRef = useRef<SearchHistoryRef>(null);

  // Load projects on component mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await getProjects();
        if (response.success && response.data) {
          setProjects(response.data);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };

    loadProjects();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('.searchInput');
        searchInput?.focus();
      }
      
      // Ctrl/Cmd + F to toggle filters
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFilters(prev => !prev);
      }
      
      // Ctrl/Cmd + H to toggle history
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowHistory(prev => !prev);
      }
      
      // Escape to close sidebar
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = useCallback(async (query: SearchQuery) => {
    setIsLoading(true);
    setError(null);
    setLastSearchQuery(query);
    
    const startTime = Date.now();
    
    try {
      const response = await performHybridSearch(query);
      const endTime = Date.now();
      
      if (response.success && response.data) {
        setSearchResults(response.data);
        
        // Add to search history
        if (searchHistoryRef.current) {
          searchHistoryRef.current.addToHistory(
            query,
            response.data.results.length,
            endTime - startTime
          );
        }
      } else {
        setError(response.error || 'Search failed');
        setSearchResults(null);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setError('An unexpected error occurred during search');
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFiltersChange = useCallback((filters: Partial<SearchQuery>) => {
    setCurrentFilters(prev => ({ ...prev, ...filters }));
    
    // If we have a previous search, re-run it with new filters
    if (lastSearchQuery) {
      const updatedQuery = { ...lastSearchQuery, ...filters };
      handleSearch(updatedQuery);
    }
  }, [lastSearchQuery, handleSearch]);

  const handleHistoryItemClick = useCallback((query: SearchQuery) => {
    // Apply current filters to the history item
    const finalQuery = { ...query, ...currentFilters };
    handleSearch(finalQuery);
  }, [currentFilters, handleSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    // In a real implementation, this could open the file in an editor
    // or navigate to a detailed view
    console.log('Result clicked:', result);
    
    // For now, we'll just log the result and show a notification
    const notification = document.createElement('div');
    notification.className = 'result-notification';
    notification.textContent = `Opened: ${result.filePath}`;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--color-primary);
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setError(null);
    setLastSearchQuery(null);
  }, []);

  return (
    <div className={styles.codeSearch}>
      {/* Add CSS animations for notifications */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <button
          className={styles.menuButton}
          onClick={toggleSidebar}
        >
          ☰
        </button>
        <h1 className={styles.mobileTitle}>Code Search</h1>
      </div>

      <div className={styles.searchContainer}>
        {/* Sidebar */}
        <div className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <h2>Search Tools</h2>
            <button
              className={styles.closeSidebar}
              onClick={toggleSidebar}
            >
              ×
            </button>
          </div>

          <div className={styles.sidebarContent}>
            {/* Filters Section */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionHeader}>
                <h3>Filters</h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? '▲' : '▼'}
                </button>
              </div>
              {showFilters && (
                <ResultFilters
                  projects={projects}
                  onFiltersChange={handleFiltersChange}
                  currentFilters={currentFilters}
                />
              )}
            </div>

            {/* History Section */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionHeader}>
                <h3>History</h3>
                <button
                  className={styles.toggleButton}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? '▲' : '▼'}
                </button>
              </div>
              {showHistory && (
                <SearchHistory
                  ref={searchHistoryRef}
                  onHistoryItemClick={handleHistoryItemClick}
                />
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Search Bar */}
          <div className={styles.searchBarSection}>
            <SearchBar
              onSearch={handleSearch}
              projects={projects}
            />
            
            {/* Quick Actions */}
            <div className={styles.quickActions}>
              <button
                className={styles.actionButton}
                onClick={() => setShowFilters(!showFilters)}
                title="Toggle Filters (Ctrl+F)"
              >
                <span className={styles.actionIcon}>🔍</span>
                <span className={styles.actionText}>Filters</span>
              </button>
              <button
                className={styles.actionButton}
                onClick={() => setShowHistory(!showHistory)}
                title="Toggle History (Ctrl+H)"
              >
                <span className={styles.actionIcon}>📚</span>
                <span className={styles.actionText}>History</span>
              </button>
              {searchResults && (
                <button
                  className={styles.actionButton}
                  onClick={clearSearch}
                  title="Clear Results"
                >
                  <span className={styles.actionIcon}>🗑️</span>
                  <span className={styles.actionText}>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className={styles.errorDisplay}>
              <h3>Error</h3>
              <p>{error}</p>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {/* Search Results */}
          <div className={styles.resultsSection}>
            {searchResults ? (
              <SearchResults
                results={searchResults}
                isLoading={isLoading}
                onResultClick={handleResultClick}
              />
            ) : (
              <div className={styles.welcomeSection}>
                <div className={styles.welcomeContent}>
                  <h2>Search Your Codebase</h2>
                  <p>Enter a search query above to find code across your indexed projects.</p>
                  
                  <div className={styles.welcomeFeatures}>
                    <div className={styles.feature}>
                      <h4>🔍 Smart Search</h4>
                      <p>Semantic search with syntax highlighting</p>
                    </div>
                    <div className={styles.feature}>
                      <h4>🎯 Advanced Filters</h4>
                      <p>Filter by project, file type, and more</p>
                    </div>
                    <div className={styles.feature}>
                      <h4>📊 Search History</h4>
                      <p>Save and compare previous searches</p>
                    </div>
                  </div>

                  <div className={styles.keyboardShortcuts}>
                    <h4>Keyboard Shortcuts</h4>
                    <div className={styles.shortcutList}>
                      <div className={styles.shortcut}>
                        <kbd>Ctrl</kbd> + <kbd>K</kbd>
                        <span>Focus search</span>
                      </div>
                      <div className={styles.shortcut}>
                        <kbd>Ctrl</kbd> + <kbd>F</kbd>
                        <span>Toggle filters</span>
                      </div>
                      <div className={styles.shortcut}>
                        <kbd>Ctrl</kbd> + <kbd>H</kbd>
                        <span>Toggle history</span>
                      </div>
                      <div className={styles.shortcut}>
                        <kbd>Esc</kbd>
                        <span>Close sidebar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};