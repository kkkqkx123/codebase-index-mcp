import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { DevMode } from '..';

// Mock common components
jest.mock('../../components/common/Card/Card', () => {
  return function MockCard({ children }: { children: React.ReactNode }) {
    return <div data-testid="card">{children}</div>;
  };
});

jest.mock('../../components/common/Button/Button', () => {
  return function MockButton({ children, variant, size, onClick, disabled }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) {
    return (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        onClick={onClick}
        disabled={disabled}
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
  return function MockErrorMessage({ message }: { message: string }) {
    return <div data-testid="error-message">{message}</div>;
  };
});

describe('DevMode Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders without crashing', () => {
    render(<DevMode />);
    expect(screen.getByText('Development Mode')).toBeInTheDocument();
  });

  test('renders all feature cards', () => {
    render(<DevMode />);

    const features = [
      'Enhanced Logging',
      'Component Inspection',
      'Performance Profiling',
      'Route Logging',
      'API Request Logging',
      'Error Boundary Testing'
    ];

    features.forEach(feature => {
      expect(screen.getByText(feature)).toBeInTheDocument();
    });
  });

  test('toggles features on/off', () => {
    render(<DevMode />);

    // Find the Enhanced Logging feature
    const loggingFeature = screen.getByText('Enhanced Logging');
    const enableButton = loggingFeature.closest('div')?.querySelector('button');

    // Initially should be enabled
    expect(enableButton).toHaveTextContent('Disable');

    // Click to disable
    fireEvent.click(enableButton!);
    expect(enableButton).toHaveTextContent('Enable');

    // Click to enable again
    fireEvent.click(enableButton!);
    expect(enableButton).toHaveTextContent('Disable');
  });

  test('creates and ends debug session', () => {
    render(<DevMode />);

    // Initially no session
    expect(screen.queryByText('Debug Session')).not.toBeInTheDocument();

    // Start session
    const startButton = screen.getByText('Start Session');
    fireEvent.click(startButton);

    // Session should be active
    expect(screen.getByText(/Debug Session/)).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // End session
    const endButton = screen.getByText('End Session');
    fireEvent.click(endButton);

    // Session should be ended
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  test('exports session data', () => {
    render(<DevMode />);

    // Start session first
    const startButton = screen.getByText('Start Session');
    fireEvent.click(startButton);

    // Mock document.createElement and related functions
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockCreateObjectURL = jest.spyOn(URL, 'createObjectURL');
    const mockRevokeObjectURL = jest.spyOn(URL, 'revokeObjectURL');

    mockCreateElement.mockReturnValue({} as any);
    mockCreateObjectURL.mockReturnValue('blob:test');
    mockRevokeObjectURL.mockImplementation(() => { });

    // Export session
    const exportButton = screen.getByText('Export Session');
    fireEvent.click(exportButton);

    // Verify that export functions were called
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();

    // Clean up
    mockCreateElement.mockRestore();
    mockCreateObjectURL.mockRestore();
    mockRevokeObjectURL.mockRestore();
  });

  test('shows component inspection when enabled', () => {
    render(<DevMode />);

    // Enable component inspection
    const inspectionFeature = screen.getByText('Component Inspection');
    const enableButton = inspectionFeature.closest('div')?.querySelector('button');
    fireEvent.click(enableButton!);

    // Should show component inspection section
    expect(screen.getByText('Component Inspection')).toBeInTheDocument();
  });

  test('shows performance profiling when enabled', () => {
    render(<DevMode />);

    // Enable performance profiling
    const profilingFeature = screen.getByText('Performance Profiling');
    const enableButton = profilingFeature.closest('div')?.querySelector('button');
    fireEvent.click(enableButton!);

    // Should show performance profiling section
    expect(screen.getByText('Performance Profiling')).toBeInTheDocument();
  });

  test('starts and stops profiling', () => {
    render(<DevMode />);

    // Enable performance profiling
    const profilingFeature = screen.getByText('Performance Profiling');
    const enableButton = profilingFeature.closest('div')?.querySelector('button');
    fireEvent.click(enableButton!);

    // Start profiling
    const startButton = screen.getByText('Start Profiling');
    fireEvent.click(startButton);

    // Should show profiling in progress
    expect(screen.getByText('Profiling in progress...')).toBeInTheDocument();

    // Advance timers to complete profiling
    jest.advanceTimersByTime(2000);

    // Should show profiling results
    expect(screen.getByText('Dashboard Render')).toBeInTheDocument();
  });

  test('simulates error for testing', () => {
    render(<DevMode />);

    // Find simulate error button
    const errorButton = screen.getByText('Simulate Error');

    // We expect this to throw an error
    expect(() => {
      fireEvent.click(errorButton);
    }).toThrow('This is a simulated error for testing error boundaries');
  });

  test('renders with disabled features', () => {
    render(<DevMode enableProfiling={false} enableInspection={false} />);

    // Should not show inspection or profiling sections
    expect(screen.queryByText('Component Inspection')).not.toBeInTheDocument();
    expect(screen.queryByText('Performance Profiling')).not.toBeInTheDocument();
  });
});