import React, { useState, useCallback } from 'react';
import { SearchResult, SearchResults as SearchResultsType } from '../../../types/api.types';
import { getSearchResultDetails } from '../../../services/search.service';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
  results: SearchResultsType;
  isLoading?: boolean;
  onResultClick?: (result: SearchResult) => void;
  className?: string;
}

interface ResultItemProps {
  result: SearchResult;
  onResultClick?: (result: SearchResult) => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ result, onResultClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const handleResultClick = useCallback(() => {
    if (onResultClick) {
      onResultClick(result);
    }
  }, [result, onResultClick]);

  const handleToggleDetails = useCallback(async () => {
    if (isExpanded) {
      setIsExpanded(false);
      setDetails(null);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const response = await getSearchResultDetails(result.id);
      if (response.success && response.data) {
        setDetails(response.data);
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('Failed to fetch result details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [result.id, isExpanded]);

  const getLanguageColor = (language: string): string => {
    const colors: Record<string, string> = {
      'typescript': '#3178c6',
      'javascript': '#f7df1e',
      'python': '#3776ab',
      'java': '#007396',
      'go': '#00add8',
      'rust': '#dea584',
      'cpp': '#00599c',
      'c': '#a8b9cc',
      'tsx': '#3178c6',
      'jsx': '#f7df1e'
    };
    return colors[language.toLowerCase()] || '#666';
  };

  const formatScore = (score: number): string => {
    return (score * 100).toFixed(1) + '%';
  };

  const formatSimilarity = (similarity: number): string => {
    return (similarity * 100).toFixed(1) + '%';
  };

  const highlightCode = (code: string): string => {
    // Simple syntax highlighting for common patterns
    // In a real implementation, you would use a library like Prism.js or highlight.js
    return code
      .replace(/(function|const|let|var|return|if|else|for|while|class|interface|import|export|from)\b/g, '<span class="keyword">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
      .replace(/('.*?'|".*?")/g, '<span class="string">$1</span>')
      .replace(/(\d+)/g, '<span class="number">$1</span>');
  };

  return (
    <div className={styles.resultItem}>
      <div className={styles.resultHeader} onClick={handleResultClick}>
        <div className={styles.resultMeta}>
          <div className={styles.filePath}>
            <span className={styles.fileName}>
              {result.filePath.split('/').pop()}
            </span>
            <span className={styles.path}>
              {result.filePath}
            </span>
          </div>
          <div className={styles.resultStats}>
            <span 
              className={styles.languageBadge}
              style={{ backgroundColor: getLanguageColor(result.metadata.language) }}
            >
              {result.metadata.language}
            </span>
            <span className={styles.score}>
              Score: {formatScore(result.score)}
            </span>
            <span className={styles.similarity}>
              Similarity: {formatSimilarity(result.similarity)}
            </span>
            <span className={styles.lineNumbers}>
              Lines {result.metadata.startLine}-{result.metadata.endLine}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.resultContent}>
        <div 
          className={styles.codePreview}
          dangerouslySetInnerHTML={{ 
            __html: highlightCode(result.content)
          }}
        />
      </div>

      <div className={styles.resultActions}>
        <button 
          className={styles.detailsButton}
          onClick={handleToggleDetails}
          disabled={isLoadingDetails}
        >
          {isLoadingDetails ? 'Loading...' : isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {isExpanded && details && (
        <div className={styles.resultDetails}>
          <h4>Additional Details</h4>
          <div className={styles.detailsContent}>
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className={styles.detailItem}>
                <span className={styles.detailKey}>{key}:</span>
                <span className={styles.detailValue}>
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading = false,
  onResultClick,
  className = ''
}) => {
  if (isLoading) {
    return (
      <div className={`${styles.searchResults} ${className}`}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Searching...</p>
        </div>
      </div>
    );
  }

  if (results.results.length === 0) {
    return (
      <div className={`${styles.searchResults} ${className}`}>
        <div className={styles.emptyState}>
          <h3>No results found</h3>
          <p>Try adjusting your search query or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.searchResults} ${className}`}>
      <div className={styles.resultsHeader}>
        <h3>Search Results</h3>
        <span className={styles.resultsCount}>
          {results.results.length} result{results.results.length !== 1 ? 's' : ''} found
        </span>
      </div>

      <div className={styles.resultsList}>
        {results.results.map((result) => (
          <ResultItem 
            key={result.id}
            result={result}
            onResultClick={onResultClick}
          />
        ))}
      </div>

      <div className={styles.resultsFooter}>
        <span className={styles.timestamp}>
          Search completed: {new Date(results.timestamp).toLocaleString()}
        </span>
      </div>
    </div>
  );
};