import React, { useState, useEffect } from 'react';
import { Project, ProjectConfiguration } from '../../../types/project.types';
import { createProject, updateProject, validateProjectPath } from '../../../services/project.service';
import LoadingSpinner from '@components/common/LoadingSpinner/LoadingSpinner';
import Button from '@components/common/Button/Button';
import Card from '@components/common/Card/Card';
import './ProjectForm.module.css';

interface ProjectFormProps {
  project?: Project; // If provided, we're editing; otherwise creating
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
  showAdvancedOptions?: boolean;
}

interface FormData {
  name: string;
  path: string;
  description: string;
  configuration: ProjectConfiguration;
}

interface FormErrors {
  name?: string;
  path?: string;
  description?: string;
  configuration?: {
    [key: string]: string;
  };
}

interface PathValidationResult {
  isValid: boolean;
  exists: boolean;
  isDirectory: boolean;
  fileCount?: number;
  size?: number;
  error?: string;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  project,
  onSuccess,
  onCancel,
  showAdvancedOptions = false
}) => {
  const isEditing = !!project;

  const [formData, setFormData] = useState<FormData>({
    name: project?.name || '',
    path: project?.path || '',
    description: project?.description || '',
    configuration: project?.configuration || {
      recursive: true,
      fileTypes: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'rs', 'go', 'md'],
      excludePatterns: ['node_modules', '.git', 'dist', 'build', '.vscode', '.idea'],
      includePatterns: [],
      maxFileSize: 1024 * 1024, // 1MB
      followSymlinks: false,
      respectGitignore: true,
      encoding: 'utf-8'
    }
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [pathValidation, setPathValidation] = useState<PathValidationResult | null>(null);
  const [pathValidating, setPathValidating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedOptions);

  // Validate form data
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Project name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    } else if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(formData.name)) {
      newErrors.name = 'Project name contains invalid characters';
    }

    // Path validation
    if (!formData.path.trim()) {
      newErrors.path = 'Project path is required';
    } else if (!pathValidation?.isValid) {
      newErrors.path = pathValidation?.error || 'Invalid project path';
    }

    // Description validation
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Configuration validation
    const configErrors: { [key: string]: string } = {};

    if (formData.configuration.maxFileSize < 1024) {
      configErrors.maxFileSize = 'Max file size must be at least 1KB';
    }

    if (formData.configuration.maxFileSize > 100 * 1024 * 1024) {
      configErrors.maxFileSize = 'Max file size cannot exceed 100MB';
    }

    if (formData.configuration.fileTypes.length === 0) {
      configErrors.fileTypes = 'At least one file type must be selected';
    }

    if (Object.keys(configErrors).length > 0) {
      newErrors.configuration = configErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate path when it changes
  const validatePath = async (path: string) => {
    if (!path.trim()) {
      setPathValidation(null);
      return;
    }

    setPathValidating(true);
    try {
      const response = await validateProjectPath(path);
      if (response.success && response.data) {
        setPathValidation(response.data);
      } else {
        setPathValidation({
          isValid: false,
          exists: false,
          isDirectory: false,
          error: response.error || 'Path validation failed'
        });
      }
    } catch (err) {
      setPathValidation({
        isValid: false,
        exists: false,
        isDirectory: false,
        error: err instanceof Error ? err.message : 'Path validation error'
      });
    } finally {
      setPathValidating(false);
    }
  };

  // Debounced path validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.path !== project?.path) { // Don't validate if path hasn't changed in edit mode
        validatePath(formData.path);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.path, project?.path]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear specific field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleConfigurationChange = (field: keyof ProjectConfiguration, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuration: { ...prev.configuration, [field]: value }
    }));

    // Clear configuration errors for this field
    if (errors.configuration?.[field]) {
      setErrors(prev => {
        const newConfigErrors = { ...prev.configuration };
        delete newConfigErrors[field];
        return {
          ...prev,
          configuration: Object.keys(newConfigErrors).length > 0 ? newConfigErrors : undefined
        };
      });
    }
  };

  const handleArrayFieldChange = (field: 'fileTypes' | 'excludePatterns' | 'includePatterns', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    handleConfigurationChange(field, items);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      let response;

      if (isEditing && project) {
        response = await updateProject(project.id, {
          name: formData.name.trim(),
          path: formData.path.trim(),
          description: formData.description.trim() || undefined,
          configuration: formData.configuration
        });
      } else {
        response = await createProject({
          name: formData.name.trim(),
          path: formData.path.trim(),
          description: formData.description.trim() || undefined,
          configuration: formData.configuration
        });
      }

      if (response.success && response.data) {
        onSuccess?.(response.data);
      } else {
        throw new Error(response.error || `Failed to ${isEditing ? 'update' : 'create'} project`);
      }
    } catch (err) {
      setErrors({
        name: err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} project`
      });
    } finally {
      setLoading(false);
    }
  };

  const getPathValidationDisplay = () => {
    if (pathValidating) {
      return (
        <div className="path-validation validating">
          <LoadingSpinner size="sm" />
          <span>Validating path...</span>
        </div>
      );
    }

    if (!pathValidation) return null;

    if (pathValidation.isValid) {
      return (
        <div className="path-validation valid">
          <span className="validation-icon">✅</span>
          <div className="validation-details">
            <span>Valid directory found</span>
            {pathValidation.fileCount !== undefined && (
              <span className="path-stats">
                {pathValidation.fileCount.toLocaleString()} files, {formatFileSize(pathValidation.size || 0)}
              </span>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="path-validation invalid">
          <span className="validation-icon">❌</span>
          <span>{pathValidation.error || 'Invalid path'}</span>
        </div>
      );
    }
  };

  return (
    <Card className="project-form-container">
      <div className="form-header">
        <h2>{isEditing ? 'Edit Project' : 'Add New Project'}</h2>
        <p className="form-description">
          {isEditing
            ? 'Update project configuration and settings'
            : 'Configure a new project for codebase indexing'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="project-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-group">
            <label htmlFor="project-name" className="required">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter project name..."
              className={errors.name ? 'error' : ''}
              disabled={loading}
              maxLength={100}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="project-path" className="required">
              Project Path
            </label>
            <input
              id="project-path"
              type="text"
              value={formData.path}
              onChange={(e) => handleInputChange('path', e.target.value)}
              placeholder="Enter absolute path to project directory..."
              className={errors.path ? 'error' : ''}
              disabled={loading}
            />
            {getPathValidationDisplay()}
            {errors.path && <span className="error-text">{errors.path}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="project-description">
              Description (Optional)
            </label>
            <textarea
              id="project-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Brief description of the project..."
              className={errors.description ? 'error' : ''}
              disabled={loading}
              maxLength={500}
              rows={3}
            />
            <div className="character-count">
              {formData.description.length}/500 characters
            </div>
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>
        </div>

        {/* Advanced Configuration */}
        <div className="form-section">
          <div className="section-header">
            <h3>Indexing Configuration</h3>
            <button
              type="button"
              className="toggle-advanced"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼ Hide Advanced' : '▶ Show Advanced'}
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="file-types">
              File Types to Index
            </label>
            <input
              id="file-types"
              type="text"
              value={formData.configuration.fileTypes.join(', ')}
              onChange={(e) => handleArrayFieldChange('fileTypes', e.target.value)}
              placeholder="js, ts, py, java, cpp..."
              disabled={loading}
            />
            <div className="field-help">
              Comma-separated list of file extensions (without dots)
            </div>
            {errors.configuration?.fileTypes && (
              <span className="error-text">{errors.configuration.fileTypes}</span>
            )}
          </div>

          {showAdvanced && (
            <>
              <div className="form-group">
                <label htmlFor="exclude-patterns">
                  Exclude Patterns
                </label>
                <input
                  id="exclude-patterns"
                  type="text"
                  value={formData.configuration.excludePatterns.join(', ')}
                  onChange={(e) => handleArrayFieldChange('excludePatterns', e.target.value)}
                  placeholder="node_modules, .git, dist..."
                  disabled={loading}
                />
                <div className="field-help">
                  Comma-separated list of directories/files to exclude
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="include-patterns">
                  Include Patterns (Optional)
                </label>
                <input
                  id="include-patterns"
                  type="text"
                  value={formData.configuration.includePatterns.join(', ')}
                  onChange={(e) => handleArrayFieldChange('includePatterns', e.target.value)}
                  placeholder="src, lib, components..."
                  disabled={loading}
                />
                <div className="field-help">
                  If specified, only these patterns will be included
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="max-file-size">
                  Maximum File Size (bytes)
                </label>
                <input
                  id="max-file-size"
                  type="number"
                  value={formData.configuration.maxFileSize}
                  onChange={(e) => handleConfigurationChange('maxFileSize', parseInt(e.target.value) || 0)}
                  min={1024}
                  max={100 * 1024 * 1024}
                  disabled={loading}
                />
                <div className="field-help">
                  Current: {formatFileSize(formData.configuration.maxFileSize)}
                </div>
                {errors.configuration?.maxFileSize && (
                  <span className="error-text">{errors.configuration.maxFileSize}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="encoding">
                  File Encoding
                </label>
                <select
                  id="encoding"
                  value={formData.configuration.encoding}
                  onChange={(e) => handleConfigurationChange('encoding', e.target.value)}
                  disabled={loading}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="ascii">ASCII</option>
                  <option value="latin1">Latin-1</option>
                  <option value="utf-16">UTF-16</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.configuration.followSymlinks}
                    onChange={(e) => handleConfigurationChange('followSymlinks', e.target.checked)}
                    disabled={loading}
                  />
                  <span>Follow symbolic links</span>
                </label>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.configuration.respectGitignore}
                    onChange={(e) => handleConfigurationChange('respectGitignore', e.target.checked)}
                    disabled={loading}
                  />
                  <span>Respect .gitignore files</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            disabled={loading || !pathValidation?.isValid}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditing ? 'Update Project' : 'Create Project'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProjectForm;