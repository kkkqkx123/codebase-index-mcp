import React, { useState, useEffect, useCallback } from 'react';
import { Project, ProjectConfiguration } from '../../../types/project.types';
import { getProjectDetails } from '../../../services/project.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '@components/common/ErrorMessage/ErrorMessage';
import Button from '@components/common/Button/Button';
import Card from '@components/common/Card/Card';
import './ProjectDetails.module.css';
interface ProjectDetailsProps {
  projectId: string;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onReindex?: (project: Project) => void;
  onBack?: () => void;
  showActions?: boolean;
}

interface ConfigurationSectionProps {
  configuration: ProjectConfiguration;
  isEditing: boolean;
  onUpdate: (config: ProjectConfiguration) => void;
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
}

const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  configuration,
  isEditing,
  onUpdate,
  onCancel,
  onSave,
  loading
}) => {
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

  const handleArrayFieldChange = (field: 'fileTypes' | 'excludePatterns' | 'includePatterns', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    onUpdate({ ...configuration, [field]: items });
  };

  if (!isEditing) {
    return (
      <div className="configuration-display">
        <div className="config-item">
          <span className="config-label">File Types:</span>
          <span className="config-value">{configuration.fileTypes.join(', ')}</span>
        </div>

        <div className="config-item">
          <span className="config-label">Exclude Patterns:</span>
          <span className="config-value">{configuration.excludePatterns.join(', ')}</span>
        </div>

        {configuration.includePatterns.length > 0 && (
          <div className="config-item">
            <span className="config-label">Include Patterns:</span>
            <span className="config-value">{configuration.includePatterns.join(', ')}</span>
          </div>
        )}

        <div className="config-item">
          <span className="config-label">Max File Size:</span>
          <span className="config-value">{formatFileSize(configuration.maxFileSize)}</span>
        </div>

        <div className="config-item">
          <span className="config-label">Encoding:</span>
          <span className="config-value">{configuration.encoding}</span>
        </div>

        <div className="config-item">
          <span className="config-label">Follow Symlinks:</span>
          <span className="config-value">{configuration.followSymlinks ? 'Yes' : 'No'}</span>
        </div>

        <div className="config-item">
          <span className="config-label">Respect .gitignore:</span>
          <span className="config-value">{configuration.respectGitignore ? 'Yes' : 'No'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="configuration-editor">
      <div className="config-form-group">
        <label>File Types:</label>
        <input
          type="text"
          value={configuration.fileTypes.join(', ')}
          onChange={(e) => handleArrayFieldChange('fileTypes', e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="config-form-group">
        <label>Exclude Patterns:</label>
        <input
          type="text"
          value={configuration.excludePatterns.join(', ')}
          onChange={(e) => handleArrayFieldChange('excludePatterns', e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="config-form-group">
        <label>Include Patterns:</label>
        <input
          type="text"
          value={configuration.includePatterns.join(', ')}
          onChange={(e) => handleArrayFieldChange('includePatterns', e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="config-form-group">
        <label>Max File Size (bytes):</label>
        <input
          type="number"
          value={configuration.maxFileSize}
          onChange={(e) => onUpdate({ ...configuration, maxFileSize: parseInt(e.target.value) || 0 })}
          min={1024}
          max={100 * 1024 * 1024}
          disabled={loading}
        />
        <span className="field-help">{formatFileSize(configuration.maxFileSize)}</span>
      </div>

      <div className="config-form-group">
        <label>Encoding:</label>
        <select
          value={configuration.encoding}
          onChange={(e) => onUpdate({ ...configuration, encoding: e.target.value })}
          disabled={loading}
        >
          <option value="utf-8">UTF-8</option>
          <option value="ascii">ASCII</option>
          <option value="latin1">Latin-1</option>
          <option value="utf-16">UTF-16</option>
        </select>
      </div>

      <div className="config-form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={configuration.followSymlinks}
            onChange={(e) => onUpdate({ ...configuration, followSymlinks: e.target.checked })}
            disabled={loading}
          />
          Follow Symlinks
        </label>
      </div>

      <div className="config-form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={configuration.respectGitignore}
            onChange={(e) => onUpdate({ ...configuration, respectGitignore: e.target.checked })}
            disabled={loading}
          />
          Respect .gitignore
        </label>
      </div>

      <div className="config-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={loading}
        >
          {loading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};


const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  projectId,
  onEdit,
  onDelete,
  onReindex,
  onBack,
  showActions = true
}) => {
  const [project, setProject] = useState<Project | null>(null);
  // const [history, setHistory] = useState<IndexingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [tempConfiguration, setTempConfiguration] = useState<ProjectConfiguration | null>(null);
const fetchProject = useCallback(async () => {
  try {
    setError(null);
    const response = await getProjectDetails(projectId);
    if (response.success && response.data) {
      setProject(response.data);
    } else {
      throw new Error(response.error || 'Failed to fetch project details');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error occurred');
  } finally {
    setLoading(false);
  }
}, [projectId]);

const fetchHistory = useCallback(async () => {
  try {
    // const response = await getIndexingHistory(projectId);
    // if (response.success && response.data) {
    //   setHistory(response.data);
    // }
  } catch (err) {
    console.warn('Failed to fetch indexing history:', err);
  }
}, [projectId]);

const handleConfigurationSave = async () => {
  if (!tempConfiguration || !project) return;

  setConfigLoading(true);
  try {
    // const response = await updateProjectConfiguration(projectId, tempConfiguration);
    // if (response.success && response.data) {
    //   setProject({ ...project, configuration: response.data });
    //   setIsEditingConfig(false);
    //   setTempConfiguration(null);
    // } else {
    //   throw new Error(response.error || 'Failed to update configuration');
    // }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to update configuration');
  } finally {
    setConfigLoading(false);
    setIsEditingConfig(false);
    setTempConfiguration(null);
  }
};


  const handleConfigurationCancel = () => {
    setIsEditingConfig(false);
    setTempConfiguration(null);
  };
const handleStartEditing = () => {
  if (!project) return;
  setIsEditingConfig(true);
  setTempConfiguration(project.configuration ? { ...project.configuration } : {
    recursive: true,
    fileTypes: [],
    excludePatterns: [],
    includePatterns: [],
    maxFileSize: 1024 * 1024,
    encoding: 'utf-8',
    followSymlinks: false,
    respectGitignore: true
  });
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'indexed': return '#10b981'; // green
      case 'indexing': return '#f59e0b'; // yellow
      case 'error': return '#ef4444'; // red
      case 'pending': return '#6b7280'; // gray
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'indexed': return '✅';
      case 'indexing': return '🔄';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  useEffect(() => {
    fetchProject();
    fetchHistory();
  }, [fetchProject, fetchHistory]);

  if (loading) {
    return (
      <div className="project-details-container">
        <div className="loading-container">
          <LoadingSpinner size="md" />
          <span>Loading project details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-details-container">
        <ErrorMessage
          message={error}
          onRetry={fetchProject}
          showRetry={true}
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details-container">
        <ErrorMessage message="Project not found" />
      </div>
    );
  }

  return (
    <div className="project-details-container">
      {/* Header */}
      <div className="details-header">
        <div className="header-content">
          {onBack && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
              className="back-button"
            >
              ← Back
            </Button>
          )}

          <div className="project-title-section">
            <h1>{project.name}</h1>
            <div className="project-status">
              <span
                className="status-icon"
                style={{ color: getStatusColor(project.status) }}
              >
                {getStatusIcon(project.status)}
              </span>
              <span className="status-text">{project.status}</span>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="header-actions">
            <Button
              variant="secondary"
              onClick={() => onEdit?.(project)}
            >
              Edit Project
            </Button>

            <Button
              variant="secondary"
              onClick={() => onReindex?.(project)}
              disabled={project.status === 'indexing'}
            >
              Re-index
            </Button>

            <Button
              variant="error"
              onClick={() => onDelete?.(project)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Project Information */}
      <Card className="project-info-card">
        <h2>Project Information</h2>

        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Path:</span>
            <span className="info-value path">{project.path}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Created:</span>
            <span className="info-value">{new Date(project.createdAt).toLocaleString()}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Last Updated:</span>
            <span className="info-value">{new Date(project.updatedAt).toLocaleString()}</span>
          </div>

          <div className="info-item">
            <span className="info-label">File Count:</span>
            <span className="info-value">{project.fileCount?.toLocaleString() || 'N/A'}</span>
          </div>

          <div className="info-item">
            <span className="info-label">Total Size:</span>
            <span className="info-value">{formatFileSize(project.size || 0)}</span>
          </div>
        </div>

        {project.description && (
          <div className="project-description">
            <h3>Description</h3>
            <p>{project.description}</p>
          </div>
        )}
      </Card>

      {/* Configuration */}
      <Card className="configuration-card">
        <div className="card-header">
          <h2>Configuration</h2>
          {!isEditingConfig && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStartEditing}
            >
              Edit Configuration
            </Button>
          )}
        </div>
<ConfigurationSection
  configuration={tempConfiguration || project.configuration || {
    recursive: true,
    fileTypes: [],
    excludePatterns: [],
    includePatterns: [],
    maxFileSize: 1024 * 1024,
    encoding: 'utf-8',
    followSymlinks: false,
    respectGitignore: true
  }}
  isEditing={isEditingConfig}
  onUpdate={setTempConfiguration}
  onCancel={handleConfigurationCancel}
  onSave={handleConfigurationSave}
  loading={configLoading}
/>

      </Card>

      {/* Indexing History */}
      <Card className="history-card">
        <div className="card-header">
          <h2>Indexing History</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchHistory}
          >
            ↻ Refresh
          </Button>
        </div>

        {
          <div className="no-history">
            <p>No indexing history available</p>
          </div>
        }
      </Card>
    </div>
  );
};

export default ProjectDetails;