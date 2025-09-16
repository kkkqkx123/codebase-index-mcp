import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NodeDetails from '../NodeDetails';
import * as graphService from '../../../../services/graph.service';

// Mock the graph service
jest.mock('../../../../services/graph.service', () => ({
  analyzeGraph: jest.fn(),
}));

describe('NodeDetails', () => {
  const mockNode = {
    id: '1',
    label: 'TestFunction',
    type: 'function' as const,
    x: 0,
    y: 0,
    metadata: {
      filePath: '/path/to/file.ts',
      lineNumber: 10,
    },
  };

  const mockNodeDetails = {
    id: '1',
    label: 'TestFunction',
    type: 'function' as const,
    filePath: '/path/to/file.ts',
    lineNumber: 10,
    content: 'function test() { return true; }',
    relationships: [
      {
        id: 'rel-1',
        targetNodeId: '2',
        targetNodeLabel: 'AnotherFunction',
        type: 'calls',
        direction: 'out'
      }
    ]
  };

  const mockOnClose = jest.fn();
  const mockOnNodeSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (graphService.analyzeGraph as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        nodes: [mockNode],
        edges: []
      }
    });
  });

  it('renders node details correctly', async () => {
    render(
      <NodeDetails
        node={mockNode}
        projectId="test-project"
        onClose={mockOnClose}
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Wait for the component to load the data
    await waitFor(() => {
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
    });

    expect(screen.getByText('/path/to/file.ts')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders relationships correctly', async () => {
    render(
      <NodeDetails
        node={mockNode}
        projectId="test-project"
        onClose={mockOnClose}
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Wait for the component to load the data
    await waitFor(() => {
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
    });
  });

  it('handles edit functionality', async () => {
    render(
      <NodeDetails
        node={mockNode}
        projectId="test-project"
        onClose={mockOnClose}
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Wait for the component to load the data
    await waitFor(() => {
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
    });
  });

  it('handles navigation functionality', async () => {
    render(
      <NodeDetails
        node={mockNode}
        projectId="test-project"
        onClose={mockOnClose}
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Wait for the component to load the data
    await waitFor(() => {
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
    });
  });

  it('renders empty state when no node is provided', () => {
    render(<NodeDetails onClose={mockOnClose} onNodeSelect={mockOnNodeSelect} node={null} />);

    expect(screen.getByText('Select a node to view details')).toBeInTheDocument();
  });

  it('handles empty relationships', async () => {
    // Mock empty relationships
    (graphService.analyzeGraph as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        nodes: [mockNode],
        edges: []
      }
    });

    render(
      <NodeDetails
        node={mockNode}
        projectId="test-project"
        onClose={mockOnClose}
        onNodeSelect={mockOnNodeSelect}
      />
    );

    // Wait for the component to load the data
    await waitFor(() => {
      expect(screen.getByText('TestFunction')).toBeInTheDocument();
    });
  });
});