import React, { useState, useEffect, useCallback } from 'react';
import { Project } from '../../../types/project.types';
import { getProjects, deleteProject, reindexProject } from '@services/project.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Button from '@components/common/Button/Button';
import Card from '@components/common/Card/Card';
import './ProjectList.module.css';

interface ProjectListProps {
  onEditProject?: (project: Project) => void;
  onViewProject?: (project: Project) => void;
  onAddProject?: () => void;
  showActions?: boolean;
  refreshInterval?: number;
}

interface FilterOptions {
  status: 'pending' | 'indexing' | 'completed' | 'error' | 'all';
  sortBy: 'name' | 'created' | 'updated' | 'size' | 'files';
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
}

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onView?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onReindex?: (project: Project) => void;
  showActions?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  onView,
  onDelete,
  onReindex,
  showActions = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<'delete' | 'reindex' | null>(null);

  const getStatusColor = (status: Project['status']): string => {
    switch (status) {
      case 'indexing': return '#f59e0b'; // yellow
      case 'completed': return '#10b981'; // green
      case 'error': return '#ef4444'; // red
      case 'pending': return '#6b7280'; // gray
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: Project['status']): string => {
    switch (status) {
      case 'indexing': return '🔄';
      case 'completed': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (date: Date | string): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    if (!window.confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setActionType('delete');
    try {
      await onDelete(project);
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleReindex = async () => {
    if (!onReindex) return;

    setIsLoading(true);
    setActionType('reindex');
    try {
      await onReindex(project);
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  return (
    <Card className="project-card">
      <div className="project-card-header">
        <div className="project-info">
          <h3
            className="project-name"
            onClick={() => onView?.(project)}
            style={{ cursor: onView ? 'pointer' : 'default' }}
          >
            {project.name}
          </h3>
          <div className="project-path">{project.path}</div>
        </div>

        <div className="project-status">
          <span
            className="status-indicator"
            style={{ color: getStatusColor(project.status) }}
            title={`Status: ${project.status}`}
          >
            {getStatusIcon(project.status)}
          </span>
          <span className="status-text">{project.status}</span>
        </div>
      </div>

      <div className="project-stats">
        <div className="stat-item">
          <span className="stat-label">Files</span>
          <span className="stat-value">{project.fileCount?.toLocaleString() || 0}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Size</span>
          <span className="stat-value">{formatFileSize(project.size || 0)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Created</span>
          <span className="stat-value">{formatDate(project.createdAt)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Updated</span>
          <span className="stat-value">{formatDate(project.updatedAt)}</span>
        </div>
      </div>

      {project.description && (
        <div className="project-description">
          {project.description}
        </div>
      )}

      {showActions && (
        <div className="project-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onView?.(project)}
            disabled={isLoading}
          >
            View
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit?.(project)}
            disabled={isLoading}
          >
            Edit
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            disabled={isLoading || project.status === 'indexing'}
            aria-label={`Re-index ${project.name}`}
          >
            {isLoading && actionType === 'reindex' ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Re-index'
            )}
          </Button>

          <Button
            variant="error"
            size="sm"
            onClick={handleDelete}
            disabled={isLoading}
            aria-label={`Delete ${project.name}`}
          >
            {isLoading && actionType === 'delete' ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      )}
    </Card>
  );
};

const ProjectList: React.FC<ProjectListProps> = ({
  onEditProject,
  onViewProject,
  onAddProject,
  showActions = true,
  refreshInterval = 30000
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    sortBy: 'updated',
    sortOrder: 'desc',
    searchQuery: ''
  });

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const response = await getProjects();
      if (response.success && response.data) {
        // 确保数据是数组类型
        if (Array.isArray(response.data)) {
          setProjects(response.data);
        } else {
          console.error('Projects API response data is not an array:', response.data);
          setError('Invalid project data format received from server');
          setProjects([]);
        }
      } else {
        setError(response.error || 'Failed to fetch projects');
        setProjects([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteProject = async (project: Project) => {
    try {
      const response = await deleteProject(project.id);
      if (response.success) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== project.id));
      } else {
        throw new Error(response.error || 'Failed to delete project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      throw err; // Re-throw to handle loading state in ProjectCard
    }
  };

  const handleReindexProject = async (project: Project) => {
    try {
      const response = await reindexProject(project.id);
      if (response.success) {
        // Update project status to indexing
        setProjects(prev => prev.map(p =>
          p.id === project.id
            ? { ...p, status: 'indexing' as Project['status'], updatedAt: new Date() }
            : p
        ));
      } else {
        throw new Error(response.error || 'Failed to re-index project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-index project');
      throw err; // Re-throw to handle loading state in ProjectCard
    }
  };

  const getFilteredAndSortedProjects = (): Project[] => {
    // 防御性检查：确保projects是数组
    if (!Array.isArray(projects)) {
      console.error('Projects is not an array:', projects);
      return [];
    }

    let filtered = projects;

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(project => project.status === (filters.status as Project['status']));
    }

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting - 确保filtered是数组
    if (!Array.isArray(filtered)) {
      console.error('Filtered projects is not an array:', filtered);
      return [];
    }

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updated':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'size':
          aValue = a.size || 0;
          bValue = b.size || 0;
          break;
        case 'files':
          aValue = a.fileCount || 0;
          bValue = b.fileCount || 0;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  };

  const updateFilter = (updates: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  const getStatusCounts = () => {
    const counts = {
      all: projects.length,
      completed: 0,
      indexing: 0,
      error: 0,
      pending: 0
    };

    projects.forEach(project => {
      if (project.status === 'completed') {
        counts.completed++;
      } else if (project.status === 'indexing') {
        counts.indexing++;
      } else if (project.status === 'error') {
        counts.error++;
      } else if (project.status === 'pending') {
        counts.pending++;
      }
    });

    return counts;
  };

  useEffect(() => {
    fetchProjects();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchProjects, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchProjects, refreshInterval]);

  if (loading) {
    return (
      <div className="project-list-container">
        <div className="loading-container">
          <LoadingSpinner size="md" />
          <span>Loading projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-list-container">
        <ErrorMessage
          message={error}
          onRetry={fetchProjects}
          showRetry={true}
        />
      </div>
    );
  }

  const filteredProjects = getFilteredAndSortedProjects();
  const statusCounts = getStatusCounts();

  return (
    <div className="project-list-container">
      <div className="project-list-header">
        <div className="header-title">
          <h2>Projects</h2>
          <span className="project-count">
            {filteredProjects.length} of {projects.length} projects
          </span>
        </div>

        <div className="header-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchProjects}
            aria-label="Refresh project list"
          >
            ↻ Refresh
          </Button>

          {onAddProject && (
            <Button
              variant="primary"
              onClick={onAddProject}
              aria-label="Add new project"
            >
              + Add Project
            </Button>
          )}
        </div>
      </div>

      <div className="project-filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as FilterOptions['status'] })}
          >
            <option value="all">All ({statusCounts.all})</option>
            <option value="completed">Completed ({statusCounts.completed})</option>
            <option value="indexing">Indexing ({statusCounts.indexing})</option>
            <option value="error">Error ({statusCounts.error})</option>
            <option value="pending">Pending ({statusCounts.pending})</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-filter">Sort by:</label>
          <select
            id="sort-filter"
            value={filters.sortBy}
            onChange={(e) => updateFilter({ sortBy: e.target.value as FilterOptions['sortBy'] })}
          >
            <option value="updated">Last Updated</option>
            <option value="created">Created Date</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="files">File Count</option>
          </select>

          <button
            className="sort-order-button"
            onClick={() => updateFilter({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
            title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="filter-group search-group">
          <label htmlFor="search-input">Search:</label>
          <input
            id="search-input"
            type="text"
            placeholder="Search projects..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter({ searchQuery: e.target.value })}
            className="search-input"
          />
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="no-projects">
          {projects.length === 0 ? (
            <div className="empty-state">
              <h3>No projects found</h3>
              <p>Get started by adding your first project to the index.</p>
              {onAddProject && (
                <Button variant="primary" onClick={onAddProject}>
                  Add Your First Project
                </Button>
              )}
            </div>
          ) : (
            <div className="no-results">
              <h3>No matching projects</h3>
              <p>Try adjusting your filters or search query.</p>
              <Button
                variant="secondary"
                onClick={() => setFilters({
                  status: 'all',
                  sortBy: 'updated',
                  sortOrder: 'desc',
                  searchQuery: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="project-grid">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={onEditProject}
              onView={onViewProject}
              onDelete={handleDeleteProject}
              onReindex={handleReindexProject}
              showActions={showActions}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;