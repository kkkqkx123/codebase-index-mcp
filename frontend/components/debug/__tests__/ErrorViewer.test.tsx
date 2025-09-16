import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { ErrorViewer } from '..';

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

describe('ErrorViewer Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders without crashing', () => {
    render(<ErrorViewer />);
    expect(screen.getByText('Error Viewer')).toBeInTheDocument();
  });

  test('renders loading spinner initially', () => {
    render(<ErrorViewer />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('renders error items after loading', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Check that errors are displayed
    expect(screen.getByText('Cannot read property \'map\' of undefined')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch: Request timeout')).toBeInTheDocument();
    expect(screen.getByText('Project path is required')).toBeInTheDocument();
  });

  test('filters errors by type', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Initially should show all errors
    expect(screen.getByText('TypeError')).toBeInTheDocument();
    expect(screen.getByText('NetworkError')).toBeInTheDocument();

    // Filter by TypeError
    const typeFilter = screen.getByRole('combobox', { name: '' });
    fireEvent.change(typeFilter, { target: { value: 'TypeError' } });

    // Should only show TypeError errors
    expect(screen.getByText('TypeError')).toBeInTheDocument();
    expect(screen.queryByText('NetworkError')).not.toBeInTheDocument();
  });

  test('filters errors by component', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Filter by component
    const componentFilter = screen.getByPlaceholderText('Filter by component...');
    fireEvent.change(componentFilter, { target: { value: 'Dashboard' } });

    // Should only show Dashboard errors
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('ApiService')).not.toBeInTheDocument();
  });

  test('shows resolved errors when toggled', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Initially should not show resolved errors
    expect(screen.queryByText('Project path is required')).not.toBeInTheDocument();

    // Toggle to show resolved
    const showResolvedButton = screen.getByText('Show Resolved');
    fireEvent.click(showResolvedButton);

    // Should now show resolved errors
    expect(screen.getByText('Project path is required')).toBeInTheDocument();
  });

  test('hides resolved errors when toggled back', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Show resolved errors
    const showResolvedButton = screen.getByText('Show Resolved');
    fireEvent.click(showResolvedButton);

    // Should show resolved errors
    expect(screen.getByText('Project path is required')).toBeInTheDocument();

    // Hide resolved errors
    const hideResolvedButton = screen.getByText('Hide Resolved');
    fireEvent.click(hideResolvedButton);

    // Should hide resolved errors
    expect(screen.queryByText('Project path is required')).not.toBeInTheDocument();
  });

  test('shows error details when error item is clicked', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Show resolved errors to have more options
    const showResolvedButton = screen.getByText('Show Resolved');
    fireEvent.click(showResolvedButton);

    // Click on an error item
    const errorItem = screen.getByText('Project path is required').closest('div');
    fireEvent.click(errorItem!);

    // Check that details are shown
    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Message:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  test('closes error details when close button is clicked', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Show resolved errors
    const showResolvedButton = screen.getByText('Show Resolved');
    fireEvent.click(showResolvedButton);

    // Click on an error item
    const errorItem = screen.getByText('Project path is required').closest('div');
    fireEvent.click(errorItem!);

    // Check that details are shown
    expect(screen.getByText('Error Details')).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    // Check that details are hidden
    expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
  });

  test('marks error as resolved', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Click on an error item
    const errorItem = screen.getByText('Cannot read property \'map\' of undefined').closest('div');
    fireEvent.click(errorItem!);

    // Add resolution notes
    const notesInput = screen.getByPlaceholderText('Add resolution notes...');
    fireEvent.change(notesInput, { target: { value: 'Fixed by adding null check' } });

    // Mark as resolved
    const resolveButton = screen.getByText('Mark as Resolved');
    fireEvent.click(resolveButton);

    // Error should now be marked as resolved
    expect(screen.getByText('✓ Resolved')).toBeInTheDocument();
  });

  test('reopens resolved error', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Show resolved errors
    const showResolvedButton = screen.getByText('Show Resolved');
    fireEvent.click(showResolvedButton);

    // Click on a resolved error
    const errorItem = screen.getByText('Project path is required').closest('div');
    fireEvent.click(errorItem!);

    // Reopen error
    const reopenButton = screen.getByText('Reopen Error');
    fireEvent.click(reopenButton);

    // Error should no longer be marked as resolved
    expect(screen.queryByText('✓ Resolved')).not.toBeInTheDocument();
  });

  test('exports errors', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

    // Mock document.createElement and related functions
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL');
    const mockRevokeObjectURL = jest.spyOn(URL, 'revokeObjectURL');

    mockCreateElement.mockReturnValue({} as any);
    mockCreateObjectURL.mockReturnValue('blob:test');
    mockRevokeObjectURL.mockImplementation(() => { });

    // Click export button
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    // Verify that export functions were called
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Clean up
    mockCreateElement.mockRestore();
    mockCreateObjectURL.mockRestore();
    mockRevokeObjectURL.mockRestore();
  });

  test('toggles auto refresh', async () => {
    render(<ErrorViewer />);

    // Wait for loading to complete
    await screen.findByText('Error Viewer');

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