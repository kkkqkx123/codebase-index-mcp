import { render, screen, within } from '../../../__tests__/test-utils';
import { DebugTools } from '..';

// Mock child components to avoid complex dependencies
jest.mock('../ApiLogs/ApiLogs', () => ({
  __esModule: true,
  default: () => <div data-testid="api-logs">API Logs Component</div>
}));

jest.mock('../PerformanceMetrics/PerformanceMetrics', () => ({
  __esModule: true,
  default: () => <div data-testid="performance-metrics">Performance Metrics Component</div>
}));

jest.mock('../ErrorViewer/ErrorViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="error-viewer">Error Viewer Component</div>
}));

jest.mock('../DevMode/DevMode', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-mode">Dev Mode Component</div>
}));

// Mock common components
jest.mock('../../../components/common/Card/Card', () => {
  return function MockCard({ children }: { children: React.ReactNode }) {
    return <div data-testid="card">{children}</div>;
  };
});

jest.mock('../../../components/common/Button/Button', () => {
  return function MockButton({ children, variant, size }: { children: React.ReactNode; variant?: string; size?: string }) {
    return (
      <button data-testid="button" data-variant={variant} data-size={size}>
        {children}
      </button>
    );
  };
});

describe('DebugTools Component', () => {
  test('renders without crashing', () => {
    render(<DebugTools />);
    expect(screen.getByText('Debugging Tools')).toBeInTheDocument();
  });

  test('renders header with description', () => {
    render(<DebugTools />);
    const header = screen.getByText('Debugging Tools');
    const description = screen.getByText(
      'Monitor and debug MCP service functionality with comprehensive debugging tools'
    );

    expect(header).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  test('renders all tabs', () => {
    render(<DebugTools />);
    const tabs = screen.getByText('API Logs').parentElement;

    expect(within(tabs!).getByText('API Logs')).toBeInTheDocument();
    expect(within(tabs!).getByText('Performance')).toBeInTheDocument();
    expect(within(tabs!).getByText('Error Viewer')).toBeInTheDocument();
    expect(within(tabs!).getByText('Dev Mode')).toBeInTheDocument();
  });

  test('renders API Logs tab by default', () => {
    render(<DebugTools />);
    expect(screen.getByTestId('api-logs')).toBeInTheDocument();
  });

  test('switches to Performance tab when clicked', () => {
    render(<DebugTools />);
    const performanceTab = screen.getByText('Performance');

    performanceTab.click();

    // Check that the Performance tab is active
    expect(performanceTab.parentElement?.querySelector('.active')).toBeInTheDocument();
  });

  test('switches to Error Viewer tab when clicked', () => {
    render(<DebugTools />);
    const errorTab = screen.getByText('Error Viewer');

    errorTab.click();

    // Check that the Error Viewer tab is active
    expect(errorTab.parentElement?.querySelector('.active')).toBeInTheDocument();
  });

  test('switches to Dev Mode tab when clicked', () => {
    render(<DebugTools />);
    const devModeTab = screen.getByText('Dev Mode');

    devModeTab.click();

    // Check that the Dev Mode tab is active
    expect(devModeTab.parentElement?.querySelector('.active')).toBeInTheDocument();
  });

  test('renders documentation section', () => {
    render(<DebugTools />);
    expect(screen.getByText('Debugging Documentation')).toBeInTheDocument();

    const docLinks = screen.getAllByRole('link');
    expect(docLinks).toHaveLength(4);

    expect(screen.getByText('API Logs Guide')).toBeInTheDocument();
    expect(screen.getByText('Performance Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Error Resolution')).toBeInTheDocument();
    expect(screen.getByText('Development Mode')).toBeInTheDocument();
  });

  test('renders help section', () => {
    render(<DebugTools />);
    expect(screen.getByText('Need Help?')).toBeInTheDocument();

    const buttons = screen.getAllByTestId('button');
    expect(buttons).toHaveLength(2); // 2 help buttons

    expect(screen.getByText('View Documentation')).toBeInTheDocument();
    expect(screen.getByText('Report Issue')).toBeInTheDocument();
  });

  test('renders with defaultTab prop', () => {
    render(<DebugTools defaultTab="metrics" />);
    expect(screen.getByTestId('performance-metrics')).toBeInTheDocument();
  });
});