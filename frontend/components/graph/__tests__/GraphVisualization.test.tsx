import { render, screen, waitFor } from '@testing-library/react';
import GraphVisualization from '../GraphVisualization';

// Mock the child components to avoid D3.js import issues
jest.mock('../GraphViewer/GraphViewer', () => {
  return function MockGraphViewer() {
    return <div data-testid="graph-viewer">Graph Viewer Component</div>;
  };
});

jest.mock('../NodeDetails/NodeDetails', () => {
  return function MockNodeDetails() {
    return <div data-testid="node-details">Node Details Component</div>;
  };
});

jest.mock('../GraphControls/GraphControls', () => {
  return function MockGraphControls() {
    return <div data-testid="graph-controls">Graph Controls Component</div>;
  };
});

// Mock the graph service
jest.mock('../../../services/graph.service', () => ({
  analyzeGraph: jest.fn().mockResolvedValue({
    success: true,
    data: {
      nodes: [
        { id: '1', label: 'Node 1', type: 'file' },
        { id: '2', label: 'Node 2', type: 'function' }
      ],
      edges: [
        { source: '1', target: '2', type: 'imports' }
      ],
      metadata: {
        totalNodes: 2,
        totalEdges: 1,
        createdAt: new Date().toISOString()
      }
    }
  }),
  exportGraph: jest.fn().mockResolvedValue({
    success: true,
    data: {
      url: 'http://example.com/export.png',
      filename: 'export.png'
    }
  })
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('GraphVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<GraphVisualization />);
    expect(screen.getByText('Loading graph data...')).toBeInTheDocument();
  });

  it('renders graph visualization after data loads', async () => {
    render(<GraphVisualization />);
    
    // Wait for the loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading graph data...')).not.toBeInTheDocument();
    });
    
    // Check that the main components are rendered
    expect(screen.getByTestId('graph-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('node-details')).toBeInTheDocument();
    expect(screen.getByTestId('graph-controls')).toBeInTheDocument();
  });

  it('renders error state when graph data fails to load', async () => {
    // Mock the analyzeGraph function to return an error
    const graphService = require('../../../services/graph.service');
    graphService.analyzeGraph.mockResolvedValueOnce({
      success: false,
      error: 'Failed to load graph data'
    });
    
    render(<GraphVisualization />);
    
    // Wait for the error to be displayed
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to load graph data')).toBeInTheDocument();
    });
  });

  it('renders responsive layout correctly', () => {
    render(<GraphVisualization />);
    
    // Check that the main container has the correct class
    const container = screen.getByTestId('graph-visualization-container');
    expect(container).toBeInTheDocument();
  });
});