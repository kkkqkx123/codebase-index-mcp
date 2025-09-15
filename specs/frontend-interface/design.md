# Frontend Interface Design Document

## Overview

This document outlines the comprehensive design for a web-based frontend interface for the Codebase Index MCP service. The frontend will provide debugging capabilities for existing functionality and serve as an extensible foundation for future natural language query features. The design emphasizes integration with the existing Prometheus+Grafana monitoring infrastructure, modular architecture, and seamless integration with the current MCP service.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Browser (Frontend)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Dashboard     │  │  Project Mgmt   │  │  Code Search    │  │
│  │   Component     │  │   Component     │  │  Component     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Graph Viz      │  │  Debug Tools    │  │  Monitoring     │  │
│  │  Component      │  │  Component      │  │  Integration    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API Calls
                              │
┌─────────────────────────────────────────────────────────────────┐
│                 Backend MCP Service                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   HTTP Server   │  │   MCP Server    │  │  Monitoring     │  │
│  │   (Express)     │  │   (stdio)       │  │  (Prometheus)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Index Service  │  │  Graph Service  │  │  Database       │  │
│  │                 │  │                 │  │  Services       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Metrics/Logs
                              │
┌─────────────────────────────────────────────────────────────────┐
│              External Monitoring Systems                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │    Prometheus   │  │    Grafana      │  │    Logging      │  │
│  │                 │  │    Dashboards   │  │    System       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Changes Based on Analysis

1. **HTTP-to-MCP Adapter Layer**: A new adapter layer is required to bridge frontend HTTP requests with backend MCP services that use stdio protocol.
2. **Backend Proxy for Monitoring**: Direct browser-to-Prometheus access is insecure and should be replaced with backend proxy endpoints.
3. **Authentication System**: Implementation of JWT-based authentication system to secure frontend-backend communication.

### Directory Structure

```
src/frontend/
├── components/                    # React components
│   ├── common/                   # Shared components
│   │   ├── Layout/
│   │   ├── LoadingSpinner/
│   │   ├── ErrorMessage/
│   │   └── StatusBar/
│   ├── dashboard/                # Dashboard components
│   │   ├── SystemHealth/
│   │   ├── MetricsDisplay/
│   │   └── GrafanaIntegration/
│   ├── projects/                 # Project management components
│   │   ├── ProjectList/
│   │   ├── ProjectForm/
│   │   └── IndexingProgress/
│   ├── search/                   # Search interface components
│   │   ├── SearchBar/
│   │   ├── SearchResults/
│   │   └── ResultFilters/
│   ├── graph/                    # Graph visualization components
│   │   ├── GraphViewer/
│   │   ├── NodeDetails/
│   │   └── GraphControls/
│   └── debug/                    # Debugging tools components
│       ├── ApiLogs/
│       ├── PerformanceMetrics/
│       └── ErrorViewer/
├── hooks/                        # Custom React hooks
│   ├── useApi.ts
│   ├── useMetrics.ts
│   ├── useProjects.ts
│   └── useWebSocket.ts
├── services/                     # API and data services
│   ├── api.service.ts
│   ├── metrics.service.ts
│   ├── websocket.service.ts
│   └── grafana.service.ts
├── types/                        # TypeScript type definitions
│   ├── api.types.ts
│   ├── dashboard.types.ts
│   ├── project.types.ts
│   └── graph.types.ts
├── utils/                        # Utility functions
│   ├── formatters.ts
│   ├── validators.ts
│   └── constants.ts
├── store/                        # State management
│   ├── index.ts
│   ├── dashboard.slice.ts
│   ├── projects.slice.ts
│   └── search.slice.ts
├── styles/                       # CSS/SCSS styles
│   ├── globals.css
│   ├── variables.css
│   └── components/
├── __tests__/                    # Test files
│   ├── components/
│   ├── hooks/
│   └── services/
├── config/                       # Configuration files
│   ├── api.config.ts
│   └── monitoring.config.ts
├── App.tsx                       # Main application component
├── main.tsx                      # Application entry point
└── index.html                    # HTML template
```

### Technology Stack

- **Frontend Framework**: React 19+ with TypeScript
- **State Management**: Redux Toolkit for complex state, React Query for server state
- **Routing**: React Router for SPA navigation
- **Build Tool**: Vite for fast development and building
- **Styling**: CSS Modules + CSS Variables for theming
- **Data Fetching**: React Query + Axios for API calls
- **Testing**: Jest + React Testing Library
- **Graph Visualization**: D3.js or vis.js for interactive graphs
- **Monitoring Integration**: Backend proxy for Prometheus metrics + Grafana embedding
- **WebSocket**: Socket.io or native WebSocket for real-time updates

## Components and Interfaces

### Core Components

#### 1. Dashboard Component
```typescript
interface DashboardProps {
  refreshInterval?: number;
  showDetailedMetrics?: boolean;
}

interface DashboardData {
  systemHealth: HealthStatus;
  projectsSummary: ProjectsSummary;
  databaseConnections: DatabaseConnections;
  performanceMetrics: PerformanceMetrics;
  grafanaDashboards: GrafanaDashboard[];
}
```

**Key Features:**
- System health status from existing monitoring endpoints
- Project count and indexing statistics
- Database connection status (Qdrant, Nebula)
- Performance metrics from backend proxy (not direct Prometheus access)
- Embedded Grafana dashboards for detailed metrics
- Auto-refresh functionality

#### 2. Project Management Component
```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  lastIndexed: Date;
  fileCount: number;
  size: number;
}

interface ProjectFormData {
  path: string;
  options: {
    recursive: boolean;
    includePatterns: string[];
    excludePatterns: string[];
  };
}
```

**Key Features:**
- Project creation form with validation
- Real-time indexing progress tracking
- Project status visualization
- Re-indexing capabilities
- Project deletion and management

#### 3. Code Search Component
```typescript
interface SearchQuery {
  text: string;
  projectId?: string;
  fileTypes?: string[];
  limit: number;
  threshold: number;
  includeGraph: boolean;
}

interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  similarity: number;
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    chunkType: string;
  };
}
```

**Key Features:**
- Advanced search with multiple filters
- Real-time search with debouncing
- Result highlighting and context display
- Pagination and sorting
- Search history and saved queries

#### 4. Graph Visualization Component
```typescript
interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'variable';
  x: number;
  y: number;
  metadata: any;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends' | 'implements';
  weight: number;
}

interface GraphConfig {
  layout: 'force' | 'hierarchical' | 'circular';
  filter: string[];
  zoom: number;
  pan: { x: number; y: number };
}
```

**Key Features:**
- Interactive node-link diagrams
- Zoom, pan, and filter capabilities
- Node details on hover/click
- Multiple layout algorithms
- Export functionality (PNG, SVG, JSON)

### API Integration Layer

#### API Service
```typescript
class ApiService {
  private baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
  }

  async createIndex(projectPath: string, options?: IndexOptions): Promise<IndexResponse> {
    return this.axiosInstance.post('/api/v1/indexing/create', {
      projectPath,
      options
    });
  }

  async search(query: SearchQuery): Promise<SearchResults> {
    return this.axiosInstance.post('/api/v1/search/hybrid', {
      query: query.text,
      projectId: query.projectId,
      limit: query.limit,
      threshold: query.threshold,
      filters: query.filters,
      searchType: query.includeGraph ? 'hybrid' : 'semantic'
    });
  }

  async getGraph(projectPath: string, options?: GraphOptions): Promise<GraphData> {
    return this.axiosInstance.post('/api/v1/graph/analyze', {
      projectPath,
      options
    });
  }

  async getStatus(projectId: string): Promise<ProjectStatus> {
    return this.axiosInstance.get(`/api/v1/indexing/status/${encodeURIComponent(projectId)}`);
  }
}
```

#### Metrics Service (Backend Proxy Integration)
```typescript
class MetricsService {
  private baseUrl: string;

  constructor(config: MetricsConfig) {
    this.baseUrl = config.baseUrl; // Points to backend proxy, not direct Prometheus
  }

  async getMetrics(query: string, timeRange: TimeRange): Promise<PrometheusResponse> {
    // Call backend proxy endpoint, not direct Prometheus
    return this.axiosInstance.post('/api/v1/monitoring/query', {
      query,
      start: timeRange.start,
      end: timeRange.end
    });
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const response = await this.axiosInstance.get('/api/v1/monitoring/health');
    return response.data;
  }

  async getGrafanaDashboardUrl(dashboardId: string): Promise<string> {
    // Use backend-generated signed URLs or tokens
    const response = await this.axiosInstance.get(`/api/v1/monitoring/grafana/${dashboardId}`);
    return response.data.url;
  }
}
```

## Data Models

### Type Definitions

#### Core Types
```typescript
// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Health Status Types
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'error';
  components: {
    database: 'healthy' | 'degraded' | 'error';
    indexing: 'healthy' | 'degraded' | 'error';
    api: 'healthy' | 'degraded' | 'error';
  };
  lastChecked: Date;
  issues: HealthIssue[];
}

interface IndexResponse {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  processingTime: number;
  errors: string[];
}

interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  similarity: number;
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    chunkType: string;
  };
}

// Project Types
interface ProjectSummary {
  totalProjects: number;
  activeProjects: number;
  totalFiles: number;
  totalSize: number;
  lastUpdated: Date;
}

// Search Types
interface SearchFilters {
  projectIds: string[];
  fileTypes: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  scoreThreshold: number;
}

// Graph Types
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    layout: string;
    renderingTime: number;
  };
}
```

#### Configuration Types
```typescript
interface FrontendConfig {
  api: {
    baseUrl: string;
    apiKey?: string;
    timeout: number;
    retryAttempts: number;
  };
  monitoring: {
    baseUrl: string; // Backend proxy base URL
    grafanaDashboards: {
      system: string;
      performance: string;
      database: string;
    };
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    refreshInterval: number;
    pagination: {
      defaultPageSize: number;
      maxPageSize: number;
    };
  };
  features: {
    enableDebugMode: boolean;
    enableExperimental: boolean;
    enableWebSocket: boolean;
  };
}
```

## Error Handling

### Error Classification
```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  userMessage: string;
  action?: string;
}

class ErrorHandler {
  static handle(error: Error | AppError): AppError {
    if (axios.isAxiosError(error)) {
      return this.handleApiError(error);
    }

    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: error.message,
      timestamp: new Date(),
      userMessage: 'An unexpected error occurred'
    };
  }

  private static handleApiError(error: AxiosError): AppError {
    const status = error.response?.status;

    switch (status) {
      case 401:
        return {
          type: ErrorType.AUTHENTICATION_ERROR,
          message: 'Authentication required',
          timestamp: new Date(),
          userMessage: 'Please log in to continue',
          action: 'redirect_to_login'
        };
      case 429:
        return {
          type: ErrorType.RATE_LIMIT_ERROR,
          message: 'Rate limit exceeded',
          timestamp: new Date(),
          userMessage: 'Too many requests. Please try again later.',
          action: 'retry_after_delay'
        };
      default:
        return {
          type: ErrorType.API_ERROR,
          message: error.message,
          timestamp: new Date(),
          userMessage: 'Service temporarily unavailable'
        };
    }
  }
}
```

### Error Boundaries
```typescript
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Log to monitoring service
    monitoringService.logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Testing Strategy

### Unit Testing
```typescript
// Component Testing Example
describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders system health status correctly', () => {
    const mockHealthStatus: HealthStatus = {
      overall: 'healthy',
      components: {
        database: 'healthy',
        indexing: 'healthy',
        api: 'healthy'
      },
      lastChecked: new Date(),
      issues: []
    };

    render(<Dashboard healthStatus={mockHealthStatus} />);

    expect(screen.getByText('System Status: Healthy')).toBeInTheDocument();
    expect(screen.getByText('Database: Healthy')).toBeInTheDocument();
  });

  it('handles loading state correctly', () => {
    render(<Dashboard loading={true} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('System Status')).not.toBeInTheDocument();
  });
});

// Service Testing Example
describe('ApiService', () => {
  let apiService: ApiService;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAxios = axios as jest.Mocked<typeof axios>;
    apiService = new ApiService({ baseUrl: 'http://localhost:3000' });
  });

  it('makes successful API call for search', async () => {
    const mockResponse = {
      data: {
        success: true,
        results: [],
        total: 0,
        timestamp: new Date().toISOString()
      }
    };

    mockAxios.create.mockReturnValue({
      post: jest.fn().mockResolvedValue(mockResponse)
    } as any);

    const result = await apiService.search({ text: 'test', limit: 10 });

    expect(result).toEqual(mockResponse.data);
  });
});
```

### Integration Testing
```typescript
describe('Frontend-Backend Integration', () => {
  let server: setupServer;

  beforeAll(() => {
    server = setupServer(
      rest.post('/api/v1/search/hybrid', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            results: [
              {
                id: '1',
                filePath: 'test.ts',
                content: 'function test() {}',
                score: 0.9,
                similarity: 0.85,
                metadata: {
                  language: 'typescript',
                  startLine: 1,
                  endLine: 1,
                  chunkType: 'function'
                }
              }
            ],
            total: 1,
            timestamp: new Date().toISOString()
          })
        );
      })
    );
    server.listen();
  });

  afterAll(() => server.close());

  it('performs search and displays results', async () => {
    render(<SearchComponent />);

    const searchInput = screen.getByPlaceholderText('Search code...');
    await userEvent.type(searchInput, 'test');
    await userEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('function test() {}')).toBeInTheDocument();
    });
  });
});
```

### E2E Testing
```typescript
describe('End-to-End Testing', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('completes full project indexing workflow', () => {
    // Navigate to projects page
    cy.get('[data-testid="nav-projects"]').click();

    // Add new project
    cy.get('[data-testid="add-project-btn"]').click();
    cy.get('[data-testid="project-path-input"]').type('/path/to/project');
    cy.get('[data-testid="submit-form"]').click();

    // Verify project appears in list
    cy.get('[data-testid="project-list"]').should('contain', '/path/to/project');

    // Start indexing
    cy.get('[data-testid="start-indexing"]').click();

    // Wait for indexing to complete
    cy.get('[data-testid="indexing-progress"]', { timeout: 30000 })
      .should('contain', '100%');

    // Verify search functionality
    cy.get('[data-testid="nav-search"]').click();
    cy.get('[data-testid="search-input"]').type('function');
    cy.get('[data-testid="search-btn"]').click();

    cy.get('[data-testid="search-results"]').should('be.visible');
  });
});
```

## Performance Optimization

### Code Splitting and Lazy Loading
```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const ProjectManagement = lazy(() => import('./components/projects/ProjectManagement'));
const CodeSearch = lazy(() => import('./components/search/CodeSearch'));
const GraphVisualization = lazy(() => import('./components/graph/GraphVisualization'));

const App = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<ProjectManagement />} />
        <Route path="/search" element={<CodeSearch />} />
        <Route path="/graph" element={<GraphVisualization />} />
      </Routes>
    </Suspense>
  </Router>
);
```

### Virtualization for Large Lists
```typescript
// Using react-window for virtualized lists
import { FixedSizeList as List } from 'react-window';

const VirtualizedSearchResults = ({ results }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <SearchResultItem result={results[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={results.length}
      itemSize={100}
      itemData={results}
    >
      {Row}
    </List>
  );
};
```

### Memoization and Optimization
```typescript
// Using React.memo for component optimization
const GraphNode = React.memo(({ node, onClick, onHover }) => {
  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      <circle
        r={node.radius}
        fill={node.color}
        onClick={() => onClick(node)}
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
      />
      <text textAnchor="middle" dy=".35em" fontSize={12}>
        {node.label}
      </text>
    </g>
  );
});

// Custom hooks for expensive operations
const useDebouncedSearch = (query: string, delay: number) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return debouncedQuery;
};
```

## Security Considerations

### Authentication and Authorization
```typescript
// JWT Token Management
class AuthService {
  private static instance: AuthService;
  private token: string | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }
}

// API Interceptor for Authentication
const api = axios.create();

api.interceptors.request.use((config) => {
  const token = AuthService.getInstance().getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AuthService.getInstance().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Input Validation and Sanitization
```typescript
// Form validation
const validateProjectPath = (path: string): ValidationResult => {
  if (!path || path.trim().length === 0) {
    return { isValid: false, error: 'Project path is required' };
  }

  if (!path.startsWith('/')) {
    return { isValid: false, error: 'Path must be absolute' };
  }

  // Basic path validation
  const pathRegex = /^[a-zA-Z0-9_\-\/\\]+$/;
  if (!pathRegex.test(path)) {
    return { isValid: false, error: 'Invalid path characters' };
  }

  return { isValid: true };
};

// Search query sanitization
const sanitizeSearchQuery = (query: string): string => {
  return query
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[{}]/g, '') // Remove potential template literals
    .trim();
};
```

### CORS and Security Headers
```typescript
// CORS configuration in development proxy
const setupProxy = () => {
  app.use('/api', createProxyMiddleware({
    target: process.env.API_BASE_URL,
    changeOrigin: true,
    secure: true,
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('X-Forwarded-For', req.ip);
    },
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers['X-Content-Type-Options'] = 'nosniff';
      proxyRes.headers['X-Frame-Options'] = 'DENY';
      proxyRes.headers['X-XSS-Protection'] = '1; mode=block';
    }
  }));
};
```

## Design Decisions and Rationale

### 1. React + TypeScript Stack
**Decision**: Using React 19+ with TypeScript for the frontend.

**Rationale**:
- React provides excellent component reusability and large ecosystem
- TypeScript ensures type safety and better developer experience
- React 19's concurrent features improve performance for complex UIs
- Aligns with existing backend TypeScript stack

### 2. Modular Component Architecture
**Decision**: Organizing components by feature domain (dashboard, projects, search, graph).

**Rationale**:
- Promotes single responsibility principle
- Easier to maintain and test individual features
- Supports team development with clear boundaries
- Facilitates future extensibility for new features

### 3. Integration with Existing Monitoring
**Decision**: Leveraging existing Prometheus+Grafana infrastructure through backend proxy instead of direct access.

**Rationale**:
- Avoids duplication of monitoring effort
- Maintains consistency with existing DevOps practices
- Reduces maintenance overhead
- Provides comprehensive metrics without additional setup
- Addresses security concerns with direct Prometheus access

### 4. State Management Strategy
**Decision**: Using Redux Toolkit for complex state, React Query for server state.

**Rationale**:
- Redux Toolkit provides predictable state management for complex UI state
- React Query excels at managing server state with caching and synchronization
- Separation of concerns between UI state and server state
- Excellent TypeScript support and developer experience

### 5. API-First Integration
**Decision**: Communicating through HTTP API endpoints with backend adapter for MCP services.

**Rationale**:
- Maintains separation between frontend and backend concerns
- Leverages existing business logic and validation
- Supports future scalability with microservices
- Enables proper authentication and authorization
- Bridges frontend HTTP requirements with backend MCP stdio protocol

### 6. Progressive Enhancement Approach
**Decision**: Building core functionality first, then adding advanced features.

**Rationale**:
- Faster time-to-market for essential features
- Allows iterative testing and refinement
- Reduces complexity and risk
- Enables user feedback early in development process

## Implementation Roadmap

### Phase 1: Core Infrastructure and HTTP-MCP Adapter (Week 1-3)
- Setup project structure and build configuration
- Implement HTTP-to-MCP adapter layer for backend communication
- Create foundational components (layout, navigation, error handling)
- Setup testing framework and CI/CD pipeline
- Implement authentication system with JWT tokens

### Phase 2: Dashboard and Project Management (Week 4-5)
- Implement dashboard with health status and metrics via backend proxy
- Create project management interface
- Integrate with backend proxy for monitoring endpoints
- Add real-time status updates
- Implement project CRUD operations

### Phase 3: Search and Graph Visualization (Week 6-7)
- Implement code search functionality with corrected API endpoints
- Create graph visualization components
- Add filtering and advanced search options
- Optimize performance for large datasets

### Phase 4: Debugging Tools and Monitoring Integration (Week 8-9)
- Add comprehensive debugging features
- Implement secure monitoring integration via backend proxy
- Optimize component rendering and API calls
- Add comprehensive testing coverage

### Phase 5: Optimization and Extensibility Features (Week 10-12)
- Performance optimization passes
- Create plugin system for future enhancements
- Prepare for natural language query integration
- Add theming and customization options
- Complete documentation and deployment guides

## Conclusion

This design provides a comprehensive blueprint for building a frontend interface for the Codebase Index MCP service. The architecture emphasizes integration with existing infrastructure, modular design for extensibility, and robust error handling. 

Key changes from the original design based on analysis:
1. Implementation of HTTP-to-MCP adapter layer to bridge protocol mismatch
2. Secure monitoring integration through backend proxy instead of direct access
3. Updated API endpoints to match actual backend implementation
4. Revised implementation timeline to account for architectural work
5. Alignment of TypeScript types with actual API responses

The design follows SOLID principles and best practices for React development, ensuring maintainability and scalability. The component-based architecture allows for easy extension and customization, particularly for future natural language query capabilities.