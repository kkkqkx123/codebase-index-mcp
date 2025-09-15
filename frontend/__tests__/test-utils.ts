import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Custom render function with providers if needed
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'queries'>
) => render(ui, { ...options });

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock data generators
export const mockProject = (overrides = {}) => ({
  id: 'project-1',
  name: 'Test Project',
  path: '/path/to/project',
  status: 'completed',
  progress: 100,
  lastIndexed: new Date(),
  fileCount: 100,
  size: 1024,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockProjectList = (count = 3) => 
  Array.from({ length: count }, (_, i) => mockProject({ 
    id: `project-${i + 1}`,
    name: `Test Project ${i + 1}`,
    path: `/path/to/project-${i + 1}`,
  }));

export const mockHealthStatus = (overrides = {}) => ({
  overall: 'healthy',
  components: {
    database: 'healthy',
    indexing: 'healthy',
    api: 'healthy',
  },
  lastChecked: new Date(),
  issues: [],
  ...overrides,
});

export const mockSearchResult = (overrides = {}) => ({
  id: 'result-1',
  filePath: '/path/to/file.ts',
  content: 'function test() { return "test"; }',
  score: 0.95,
  similarity: 0.85,
  metadata: {
    language: 'typescript',
    startLine: 1,
    endLine: 1,
    chunkType: 'function',
  },
  ...overrides,
});

export const mockGraphNode = (overrides = {}) => ({
  id: 'node-1',
  label: 'TestNode',
  type: 'function',
  x: 0,
  y: 0,
  metadata: {},
  ...overrides,
});

export const mockGraphEdge = (overrides = {}) => ({
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'calls',
  weight: 1,
  ...overrides,
});

export const mockApiError = (overrides = {}) => ({
  type: 'API_ERROR',
  message: 'An error occurred',
  timestamp: new Date(),
  userMessage: 'Something went wrong',
  ...overrides,
});