import { render, screen } from '@testing-library/react';
import { GraphVisualization } from '../index';

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

describe('Graph Components Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders GraphVisualization component without crashing', () => {
    render(<GraphVisualization />);
    expect(screen.getByTestId('graph-visualization-container')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<GraphVisualization />);
    expect(screen.getByText('Loading graph data...')).toBeInTheDocument();
  });
});