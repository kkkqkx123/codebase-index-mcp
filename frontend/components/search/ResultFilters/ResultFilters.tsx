import React, { useState, useCallback } from 'react';
import { SearchQuery } from '../../../types/api.types';
import styles from './ResultFilters.module.css';

interface ResultFiltersProps {
  projects?: Array<{ id: string; name: string }>;
  onFiltersChange: (filters: Partial<SearchQuery>) => void;
  currentFilters: Partial<SearchQuery>;
  className?: string;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: Partial<SearchQuery>;
}

const DEFAULT_FILE_TYPES = ['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h'];

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'typescript-only',
    name: 'TypeScript Only',
    filters: {
      fileTypes: ['ts', 'tsx'],
      threshold: 0.8
    }
  },
  {
    id: 'high-confidence',
    name: 'High Confidence',
    filters: {
      threshold: 0.9
    }
  },
  {
    id: 'include-graph',
    name: 'Include Graph Analysis',
    filters: {
      includeGraph: true
    }
  },
  {
    id: 'recent-files',
    name: 'Recent Files',
    filters: {
      limit: 20,
      threshold: 0.7
    }
  }
];

export const ResultFilters: React.FC<ResultFiltersProps> = ({
  projects = [],
  onFiltersChange,
  currentFilters,
  className = ''
}) => {
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>(
    currentFilters.fileTypes || []
  );
  const [selectedProject, setSelectedProject] = useState<string>(
    currentFilters.projectId || ''
  );
  const [threshold, setThreshold] = useState<number>(
    currentFilters.threshold || 0.7
  );
  const [includeGraph, setIncludeGraph] = useState<boolean>(
    currentFilters.includeGraph || false
  );
  const [limit, setLimit] = useState<number>(
    currentFilters.limit || 50
  );
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  }>({
    start: '',
    end: ''
  });

  const handleFileTypeToggle = useCallback((fileType: string) => {
    const newFileTypes = selectedFileTypes.includes(fileType)
      ? selectedFileTypes.filter(ft => ft !== fileType)
      : [...selectedFileTypes, fileType];
    
    setSelectedFileTypes(newFileTypes);
    onFiltersChange({ fileTypes: newFileTypes.length > 0 ? newFileTypes : undefined });
  }, [selectedFileTypes, onFiltersChange]);

  const handleProjectChange = useCallback((projectId: string) => {
    setSelectedProject(projectId);
    onFiltersChange({ projectId: projectId || undefined });
  }, [onFiltersChange]);

  const handleThresholdChange = useCallback((value: number) => {
    setThreshold(value);
    onFiltersChange({ threshold: value });
  }, [onFiltersChange]);

  const handleIncludeGraphChange = useCallback((checked: boolean) => {
    setIncludeGraph(checked);
    onFiltersChange({ includeGraph: checked });
  }, [onFiltersChange]);

  const handleLimitChange = useCallback((value: number) => {
    setLimit(value);
    onFiltersChange({ limit: value });
  }, [onFiltersChange]);

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);
    
    // In a real implementation, you would convert these dates to the format expected by your API
    if (newDateRange.start || newDateRange.end) {
      onFiltersChange({
        // This would need to be adapted based on your actual API requirements
        // For now, we'll just pass the date strings as part of the filters
        // dateRange: newDateRange
      } as Partial<SearchQuery>);
    }
  }, [dateRange, onFiltersChange]);

  const handlePresetSelect = useCallback((preset: FilterPreset) => {
    const filters = preset.filters;
    
    if (filters.fileTypes) {
      setSelectedFileTypes(filters.fileTypes);
    }
    if (filters.projectId !== undefined) {
      setSelectedProject(filters.projectId || '');
    }
    if (filters.threshold !== undefined) {
      setThreshold(filters.threshold);
    }
    if (filters.includeGraph !== undefined) {
      setIncludeGraph(filters.includeGraph);
    }
    if (filters.limit !== undefined) {
      setLimit(filters.limit);
    }
    
    onFiltersChange(filters);
  }, [onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    setSelectedFileTypes([]);
    setSelectedProject('');
    setThreshold(0.7);
    setIncludeGraph(false);
    setLimit(50);
    setDateRange({ start: '', end: '' });
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = selectedFileTypes.length > 0 || 
                          selectedProject || 
                          threshold !== 0.7 || 
                          includeGraph || 
                          limit !== 50 ||
                          dateRange.start || 
                          dateRange.end;

  return (
    <div className={`${styles.resultFilters} ${className}`}>
      <div className={styles.filtersHeader}>
        <h3>Filters</h3>
        {hasActiveFilters && (
          <button 
            className={styles.clearButton}
            onClick={clearAllFilters}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filter Presets */}
      <div className={styles.filterSection}>
        <h4>Quick Presets</h4>
        <div className={styles.presetsList}>
          {DEFAULT_PRESETS.map(preset => (
            <button
              key={preset.id}
              className={styles.presetButton}
              onClick={() => handlePresetSelect(preset)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Project Filter */}
      <div className={styles.filterSection}>
        <h4>Project</h4>
        <select
          className={styles.selectInput}
          value={selectedProject}
          onChange={(e) => handleProjectChange(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* File Types Filter */}
      <div className={styles.filterSection}>
        <h4>File Types</h4>
        <div className={styles.fileTypesGrid}>
          {DEFAULT_FILE_TYPES.map(fileType => (
            <label key={fileType} className={styles.fileTypeLabel}>
              <input
                type="checkbox"
                checked={selectedFileTypes.includes(fileType)}
                onChange={() => handleFileTypeToggle(fileType)}
                className={styles.checkbox}
              />
              <span className={styles.fileTypeName}>{fileType}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className={styles.filterSection}>
        <h4>Date Range</h4>
        <div className={styles.dateRangeInputs}>
          <div className={styles.dateInput}>
            <label>From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className={styles.datePicker}
            />
          </div>
          <div className={styles.dateInput}>
            <label>To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className={styles.datePicker}
            />
          </div>
        </div>
      </div>

      {/* Threshold Filter */}
      <div className={styles.filterSection}>
        <h4>
          Similarity Threshold: {Math.round(threshold * 100)}%
        </h4>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={threshold}
          onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.sliderLabels}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Results Limit Filter */}
      <div className={styles.filterSection}>
        <h4>Results Limit</h4>
        <select
          className={styles.selectInput}
          value={limit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value))}
        >
          <option value="10">10 results</option>
          <option value="20">20 results</option>
          <option value="50">50 results</option>
          <option value="100">100 results</option>
          <option value="200">200 results</option>
        </select>
      </div>

      {/* Graph Analysis Filter */}
      <div className={styles.filterSection}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={includeGraph}
            onChange={(e) => handleIncludeGraphChange(e.target.checked)}
            className={styles.checkbox}
          />
          <span>Include Graph Analysis</span>
        </label>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className={styles.activeFiltersSummary}>
          <h4>Active Filters</h4>
          <div className={styles.activeFiltersList}>
            {selectedFileTypes.length > 0 && (
              <span className={styles.activeFilter}>
                File types: {selectedFileTypes.join(', ')}
              </span>
            )}
            {selectedProject && (
              <span className={styles.activeFilter}>
                Project: {projects.find(p => p.id === selectedProject)?.name || selectedProject}
              </span>
            )}
            {threshold !== 0.7 && (
              <span className={styles.activeFilter}>
                Threshold: {Math.round(threshold * 100)}%
              </span>
            )}
            {includeGraph && (
              <span className={styles.activeFilter}>
                Graph analysis enabled
              </span>
            )}
            {limit !== 50 && (
              <span className={styles.activeFilter}>
                Limit: {limit} results
              </span>
            )}
            {(dateRange.start || dateRange.end) && (
              <span className={styles.activeFilter}>
                Date range: {dateRange.start || 'Any'} to {dateRange.end || 'Any'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};