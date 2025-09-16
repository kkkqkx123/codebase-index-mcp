import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { ApiLogs } from '..';

// Mock common components
jest.mock('../../components/common/Card/Card', () => {
  return function MockCard({ children }: { children: React.ReactNode }) {
    return <div data-testid="card">{children}</div>;
  };
});

jest.mock('../../components/common/Button/Button', () => {
  return function MockButton({ children, variant, size, onClick }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    onClick?: () => void;
  }) {
    return (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        onClick={onClick}
      >
        {children}
      </button>
    );
  };
});

jest.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

jest.mock('../../components/common/ErrorMessage/ErrorMessage', () => {
  return function MockErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
      <div data-testid="error-message">
        <span>{message}</span>
        {onRetry && <button onClick={onRetry}>Retry</button>}
      </div>
    );
  };
});

describe('ApiLogs Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders without crashing', () => {
    render(<ApiLogs />);
    expect(screen.getByText('API Logs')).toBeInTheDocument();
  });

  test('renders loading spinner initially', () => {
    render(<ApiLogs />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('renders logs after loading', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Check that logs are displayed
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/indexing/create')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('/api/v1/indexing/status/test-project')).toBeInTheDocument();
  });

  test('renders log items with correct status colors', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    const successLog = screen.getByText('200').closest('div');
    const errorLog = screen.getByText('404').closest('div');

    expect(successLog).toHaveClass('statusSuccess');
    expect(errorLog).toHaveClass('statusClientError');
  });

  test('filters logs by method', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Initially should show all logs
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();

    // Filter by POST method
    const methodFilter = screen.getByRole('combobox', { name: '' });
    fireEvent.change(methodFilter, { target: { value: 'POST' } });

    // Should only show POST logs
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.queryByText('GET')).not.toBeInTheDocument();
  });

  test('filters logs by success status', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Initially should show all logs
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();

    // Filter by success only
    const statusFilter = screen.getAllByRole('combobox', { name: '' })[1];
    fireEvent.change(statusFilter, { target: { value: 'true' } });

    // Should only show successful logs
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.queryByText('404')).not.toBeInTheDocument();
  });

  test('shows log details when log item is clicked', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Click on a log item
    const logItem = screen.getByText('/api/v1/indexing/create').closest('div');
    fireEvent.click(logItem!);

    // Check that details are shown
    expect(screen.getByText('Request Details')).toBeInTheDocument();
    expect(screen.getByText('Method:')).toBeInTheDocument();
    expect(screen.getByText('URL:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  test('closes log details when close button is clicked', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Click on a log item
    const logItem = screen.getByText('/api/v1/indexing/create').closest('div');
    fireEvent.click(logItem!);

    // Check that details are shown
    expect(screen.getByText('Request Details')).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    // Check that details are hidden
    expect(screen.queryByText('Request Details')).not.toBeInTheDocument();
  });

  test('exports logs in JSON format', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Mock document.createElement and related functions
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL');
    const mockRevokeObjectURL = jest.spyOn(URL, 'revokeObjectURL');

    mockCreateElement.mockReturnValue({} as any);
    mockCreateObjectURL.mockReturnValue('blob:test');
    mockRevokeObjectURL.mockImplementation(() => { });

    // Click export JSON button
    const exportButton = screen.getByText('Export JSON');
    fireEvent.click(exportButton);

    // Verify that export functions were called
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Clean up
    mockCreateElement.mockRestore();
    mockCreateObjectURL.mockRestore();
    mockRevokeObjectURL.mockRestore();
  });

  test('clears logs when clear button is clicked', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Verify logs are present
    expect(screen.getByText('POST')).toBeInTheDocument();

    // Click clear button
    const clearButton = screen.getByText('Clear Logs');
    fireEvent.click(clearButton);

    // Verify logs are cleared
    expect(screen.getByText('No API logs found')).toBeInTheDocument();
  });

  test('toggles auto refresh', async () => {
    render(<ApiLogs />);

    // Wait for loading to complete
    await screen.findByText('API Logs');

    // Find auto refresh button
    const autoRefreshButton = screen.getByText('Auto Refresh On');

    // Click to turn off
    fireEvent.click(autoRefreshButton);
    expect(screen.getByText('Auto Refresh Off')).toBeInTheDocument();

    // Click to turn on
    fireEvent.click(autoRefreshButton);
    expect(screen.getByText('Auto Refresh On')).toBeInTheDocument();
  });
});