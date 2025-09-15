import React, { useState, useCallback } from 'react';
import { Project } from '../../types/project.types';
import ProjectList from './ProjectList/ProjectList';
import ProjectForm from './ProjectForm/ProjectForm';
import ProjectDetails from './ProjectDetails/ProjectDetails';
import IndexingProgress from './IndexingProgress/IndexingProgress';
import Button from '@components/common/Button/Button';
import Card from '@components/common/Card/Card';
import './ProjectManagement.module.css';

interface ProjectManagementProps {
  initialView?: 'list' | 'form' | 'details';
  initialProjectId?: string;
  showBreadcrumbs?: boolean;
}

type ViewType = 'list' | 'form' | 'details' | 'progress';

interface ViewState {
  type: ViewType;
  project?: Project;
  projectId?: string;
  isEditing?: boolean;
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({
  initialView = 'list',
  initialProjectId,
  showBreadcrumbs = true
}) => {
  const [viewState, setViewState] = useState<ViewState>({
    type: initialView,
    projectId: initialProjectId
  });

  const [activeIndexingProjects, setActiveIndexingProjects] = useState<Set<string>>(new Set());

  // Navigation handlers
  const navigateToList = useCallback(() => {
    setViewState({ type: 'list' });
  }, []);

  const navigateToForm = useCallback((project?: Project) => {
    setViewState({
      type: 'form',
      project,
      isEditing: !!project
    });
  }, []);

  const navigateToDetails = useCallback((project: Project) => {
    setViewState({
      type: 'details',
      project,
      projectId: project.id
    });
  }, []);

  const navigateToProgress = useCallback((projectId: string) => {
    setViewState({
      type: 'progress',
      projectId
    });
    setActiveIndexingProjects(prev => new Set(prev).add(projectId));
  }, []);

  // Project action handlers
  const handleProjectCreated = useCallback((project: Project) => {
    // If the project starts indexing immediately, navigate to progress
    if (project.status === 'indexing') {
      navigateToProgress(project.id);
    } else {
      navigateToList();
    }
  }, [navigateToProgress, navigateToList]);


  const handleProjectReindex = useCallback((project: Project) => {
    navigateToProgress(project.id);
  }, [navigateToProgress]);

  const handleIndexingComplete = useCallback((projectId: string) => {
    setActiveIndexingProjects(prev => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });

    // If we're currently viewing this project's progress, navigate back to list
    if (viewState.type === 'progress' && viewState.projectId === projectId) {
      navigateToList();
    }
  }, [viewState, navigateToList]);

  const handleIndexingError = useCallback((projectId: string, error: string) => {
    setActiveIndexingProjects(prev => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });

    console.error(`Indexing failed for project ${projectId}:`, error);
    // You might want to show a notification here
  }, []);

  // Breadcrumb generation
  const getBreadcrumbs = (): Array<{ label: string; onClick?: () => void }> => {
    const breadcrumbs = [{ label: 'Projects', onClick: navigateToList }];

    switch (viewState.type) {
      case 'form':
        breadcrumbs.push({
          label: viewState.isEditing ? 'Edit Project' : 'Add Project',
          onClick: () => {} // No navigation needed for current form
        });
        break;
      case 'details':
        breadcrumbs.push({
          label: viewState.project?.name || 'Project Details',
          onClick: () => {} // No navigation needed for current details
        });
        break;
      case 'progress':
        breadcrumbs.push({
          label: 'Indexing Progress',
          onClick: () => {} // No navigation needed for current progress
        });
        break;
    }

    return breadcrumbs;
  };

  const renderBreadcrumbs = () => {
    if (!showBreadcrumbs) return null;

    const breadcrumbs = getBreadcrumbs();

    return (
      <nav className="breadcrumbs" aria-label="Project navigation">
        <ol className="breadcrumb-list">
          {breadcrumbs.map((crumb, index) => (
            <li key={index} className="breadcrumb-item">
              {index < breadcrumbs.length - 1 ? (
                <>
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={crumb.onClick}
                  >
                    {crumb.label}
                  </button>
                  <span className="breadcrumb-separator">/</span>
                </>
              ) : (
                <span className="breadcrumb-current">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  };

  const renderActiveIndexingIndicator = () => {
    if (activeIndexingProjects.size === 0) return null;

    return (
      <Card className="indexing-indicator">
        <div className="indicator-content">
          <div className="indicator-info">
            <span className="indicator-icon">🔄</span>
            <span className="indicator-text">
              {activeIndexingProjects.size} project{activeIndexingProjects.size !== 1 ? 's' : ''} currently indexing
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const firstProject = Array.from(activeIndexingProjects)[0];
              if (firstProject) {
                navigateToProgress(firstProject);
              }
            }}
          >
            View Progress
          </Button>
        </div>
      </Card>
    );
  };

  const renderCurrentView = () => {
    switch (viewState.type) {
      case 'list':
        return (
          <ProjectList
            onEditProject={navigateToForm}
            onViewProject={navigateToDetails}
            onAddProject={() => navigateToForm()}
            showActions={true}
            refreshInterval={30000}
          />
        );

      case 'form':
        return (
          <ProjectForm
            project={viewState.project}
            onSuccess={handleProjectCreated}
            onCancel={navigateToList}
            showAdvancedOptions={true}
          />
        );

      case 'details':
        if (!viewState.projectId) {
          navigateToList();
          return null;
        }
        return (
          <ProjectDetails
            projectId={viewState.projectId}
            onEdit={navigateToForm}
            onDelete={() => {
              // Handle delete confirmation and then navigate to list
              navigateToList();
            }}
            onReindex={(project) => handleProjectReindex(project)}
            onBack={navigateToList}
            showActions={true}
          />
        );

      case 'progress':
        if (!viewState.projectId) {
          navigateToList();
          return null;
        }
        return (
          <div className="progress-view">
            <div className="progress-header">
              <Button
                variant="secondary"
                size="sm"
                onClick={navigateToList}
              >
                ← Back to Projects
              </Button>
            </div>
            <IndexingProgress
              projectId={viewState.projectId}
              autoRefresh={true}
              refreshInterval={2000}
              onComplete={handleIndexingComplete}
              onError={handleIndexingError}
              showDetailedStats={true}
            />
          </div>
        );

      default:
        return (
          <div className="error-view">
            <h2>Unknown View</h2>
            <p>The requested view could not be found.</p>
            <Button variant="primary" onClick={navigateToList}>
              Return to Projects
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="project-management-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Project Management</h1>
          <p className="header-description">
            Manage your codebase projects, configure indexing settings, and monitor progress
          </p>
        </div>

        {viewState.type === 'list' && (
          <div className="header-actions">
            <Button
              variant="primary"
              onClick={() => navigateToForm()}
              aria-label="Add new project"
            >
              + Add Project
            </Button>
          </div>
        )}
      </div>

      {/* Breadcrumbs */}
      {renderBreadcrumbs()}

      {/* Active Indexing Indicator */}
      {viewState.type === 'list' && renderActiveIndexingIndicator()}

      {/* Main Content */}
      <div className="main-content">
        {renderCurrentView()}
      </div>

      {/* Quick Stats Footer (only on list view) */}
      {viewState.type === 'list' && (
        <div className="quick-stats">
          <div className="stats-item">
            <span className="stats-label">Total Projects</span>
            <span className="stats-value">-</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Currently Indexing</span>
            <span className="stats-value">{activeIndexingProjects.size}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Last Updated</span>
            <span className="stats-value">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;