import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SearchQuery } from '../../../types/api.types';
import { performHybridSearch } from '../../../services/search.service';
import styles from './SearchHistory.module.css';

interface SearchHistoryItem {
  id: string;
  query: SearchQuery;
  timestamp: Date;
  resultsCount: number;
  executionTime: number;
}

interface SearchHistoryProps {
  onHistoryItemClick?: (query: SearchQuery) => void;
  className?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  description?: string;
  createdAt: Date;
}

// Forward ref for imperative handle
export interface SearchHistoryRef {
  addToHistory: (query: SearchQuery, resultsCount: number, executionTime: number) => void;
}

const MAX_HISTORY_ITEMS = 50;

const SearchHistoryComponent = forwardRef<SearchHistoryRef, SearchHistoryProps>(({
  onHistoryItemClick,
  className = ''
}, ref) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [selectedTab, setSelectedTab] = useState<'history' | 'saved'>('history');
  const [isComparing, setIsComparing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [comparisonResults, setComparisonResults] = useState<{
    [queryId: string]: any;
  }>({});

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (error) {
        console.error('Failed to parse search history:', error);
      }
    }

    const savedSearchesData = localStorage.getItem('savedSearches');
    if (savedSearchesData) {
      try {
        const parsed = JSON.parse(savedSearchesData);
        setSavedSearches(parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt)
        })));
      } catch (error) {
        console.error('Failed to parse saved searches:', error);
      }
    }
  }, []);

  const addToHistory = useCallback((query: SearchQuery, resultsCount: number, executionTime: number) => {
    const newItem: SearchHistoryItem = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      timestamp: new Date(),
      resultsCount,
      executionTime
    };

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const saveSearch = useCallback((historyItem: SearchHistoryItem, name: string, description?: string) => {
    const savedSearch: SavedSearch = {
      id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      query: historyItem.query,
      description,
      createdAt: new Date()
    };

    setSavedSearches(prev => {
      const updated = [...prev, savedSearch];
      localStorage.setItem('savedSearches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteSavedSearch = useCallback((id: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('savedSearches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
  }, []);

  const handleItemClick = useCallback((query: SearchQuery) => {
    if (onHistoryItemClick) {
      onHistoryItemClick(query);
    }
  }, [onHistoryItemClick]);

  const handleItemSelect = useCallback((id: string) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const performComparison = useCallback(async () => {
    if (selectedItems.length < 2) return;

    const results: { [queryId: string]: any } = {};
    
    for (const itemId of selectedItems) {
      const historyItem = history.find(item => item.id === itemId);
      if (historyItem) {
        try {
          const startTime = Date.now();
          const response = await performHybridSearch(historyItem.query);
          const endTime = Date.now();
          
          results[itemId] = {
            originalResults: historyItem.resultsCount,
            originalTime: historyItem.executionTime,
            newResults: response.success ? response.data?.results?.length || 0 : 0,
            newTime: endTime - startTime,
            query: historyItem.query,
            timestamp: new Date()
          };
        } catch (error) {
          results[itemId] = {
            error: 'Failed to execute search',
            query: historyItem.query
          };
        }
      }
    }

    setComparisonResults(results);
  }, [selectedItems, history]);

  const exportHistory = useCallback(() => {
    const exportData = {
      history,
      savedSearches,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
 }, [history, savedSearches]);

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatQuery = (query: SearchQuery): string => {
    let text = query.text;
    if (query.projectId) {
      text += ` (${query.projectId})`;
    }
    if (query.fileTypes && query.fileTypes.length > 0) {
      text += ` [${query.fileTypes.join(', ')}]`;
    }
    return text;
  };

  // Expose addToHistory method for parent components
  useImperativeHandle(ref, () => ({
    addToHistory
  }));

 return (
    <div className={`${styles.searchHistory} ${className}`}>
      <div className={styles.historyHeader}>
        <h3>Search History</h3>
        <div className={styles.headerActions}>
          <button 
            className={styles.exportButton}
            onClick={exportHistory}
            title="Export history"
          >
            📥
          </button>
          {selectedTab === 'history' && history.length > 0 && (
            <button 
              className={styles.clearButton}
              onClick={clearHistory}
              title="Clear history"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${selectedTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => setSelectedTab('history')}
        >
          Recent Searches ({history.length})
        </button>
        <button
          className={`${styles.tab} ${selectedTab === 'saved' ? styles.activeTab : ''}`}
          onClick={() => setSelectedTab('saved')}
        >
          Saved Searches ({savedSearches.length})
        </button>
      </div>

      {selectedTab === 'history' && (
        <div className={styles.historyContent}>
          {history.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No search history yet</p>
              <p className={styles.emptyStateSubtext}>Your searches will appear here</p>
            </div>
          ) : (
            <>
              <div className={styles.historyActions}>
                <button
                  className={`${styles.compareButton} ${selectedItems.length >= 2 ? styles.activeCompareButton : ''}`}
                  onClick={() => setIsComparing(!isComparing)}
                  disabled={selectedItems.length < 2}
                >
                  {isComparing ? 'Cancel Compare' : 'Compare Selected'}
                </button>
                {isComparing && selectedItems.length >= 2 && (
                  <button
                    className={styles.executeCompareButton}
                    onClick={performComparison}
                  >
                    Run Comparison
                  </button>
                )}
              </div>

              <div className={styles.historyList}>
                {history.map(item => (
                  <div
                    key={item.id}
                    className={`${styles.historyItem} ${selectedItems.includes(item.id) ? styles.selectedItem : ''}`}
                  >
                    {isComparing && (
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleItemSelect(item.id)}
                        className={styles.itemCheckbox}
                      />
                    )}
                    <div
                      className={styles.itemContent}
                      onClick={() => handleItemClick(item.query)}
                    >
                      <div className={styles.itemQuery}>
                        {formatQuery(item.query)}
                      </div>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemTime}>
                          {formatTime(item.timestamp)}
                        </span>
                        <span className={styles.itemResults}>
                          {item.resultsCount} results
                        </span>
                        <span className={styles.itemTime}>
                          {item.executionTime}ms
                        </span>
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        className={styles.saveButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          const name = prompt('Enter a name for this saved search:');
                          if (name) {
                            saveSearch(item, name);
                          }
                        }}
                        title="Save search"
                      >
                        💾
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        title="Delete from history"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {selectedTab === 'saved' && (
        <div className={styles.savedContent}>
          {savedSearches.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No saved searches yet</p>
              <p className={styles.emptyStateSubtext}>Save searches from your history for quick access</p>
            </div>
          ) : (
            <div className={styles.savedList}>
              {savedSearches.map(search => (
                <div
                  key={search.id}
                  className={styles.savedItem}
                  onClick={() => handleItemClick(search.query)}
                >
                  <div className={styles.savedItemContent}>
                    <div className={styles.savedItemName}>{search.name}</div>
                    {search.description && (
                      <div className={styles.savedItemDescription}>{search.description}</div>
                    )}
                    <div className={styles.savedItemMeta}>
                      <span className={styles.savedItemQuery}>
                        {formatQuery(search.query)}
                      </span>
                      <span className={styles.savedItemTime}>
                        Saved {formatTime(search.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.savedItemActions}>
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedSearch(search.id);
                      }}
                      title="Delete saved search"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison Results */}
      {Object.keys(comparisonResults).length > 0 && (
        <div className={styles.comparisonResults}>
          <h4>Comparison Results</h4>
          <div className={styles.comparisonTable}>
            {Object.entries(comparisonResults).map(([itemId, result]) => {
              const historyItem = history.find(item => item.id === itemId);
              return (
                <div key={itemId} className={styles.comparisonRow}>
                  <div className={styles.comparisonQuery}>
                    {historyItem ? formatQuery(historyItem.query) : 'Unknown query'}
                  </div>
                  <div className={styles.comparisonData}>
                    {result.error ? (
                      <div className={styles.comparisonError}>{result.error}</div>
                    ) : (
                      <>
                        <div className={styles.comparisonMetric}>
                          <span className={styles.metricLabel}>Results:</span>
                          <span className={styles.metricValue}>
                            {result.originalResults} → {result.newResults}
                          </span>
                        </div>
                        <div className={styles.comparisonMetric}>
                          <span className={styles.metricLabel}>Time:</span>
                          <span className={styles.metricValue}>
                            {result.originalTime}ms → {result.newTime}ms
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default SearchHistoryComponent;