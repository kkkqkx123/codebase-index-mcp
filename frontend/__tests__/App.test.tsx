import { render, screen, within } from './test-utils';
import App from '../App';

// Mock the graph components to avoid D3.js import issues
jest.mock('../components/graph', () => ({
  GraphVisualization: () => <div>Graph Visualization</div>,
  GraphViewer: () => <div>Graph Viewer</div>,
  NodeDetails: () => <div>Node Details</div>,
  GraphControls: () => <div>Graph Controls</div>
}));

describe('App Component', () => {
  test('renders welcome message', () => {
    render(<App />);
    const welcomeElement = screen.getByText(/Codebase Index Dashboard/i);
    expect(welcomeElement).toBeInTheDocument();
  });

  test('renders header with correct title', () => {
    render(<App />);
    const headerElement = screen.getByRole('banner');
    expect(within(headerElement).getByText(/Codebase Index MCP/i)).toBeInTheDocument();
  });

  test('renders main content area', () => {
    render(<App />);
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();
  });
});