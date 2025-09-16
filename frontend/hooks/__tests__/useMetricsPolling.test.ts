import { renderHook, act } from '@testing-library/react';
import { useMetricsPolling } from '../useMetricsPolling';
import { getRealTimeMetrics } from '@services/monitoring.service';
import { ApiResponse } from '../../types/api.types';

// Mock the monitoring service
jest.mock('@services/monitoring.service', () => ({
  getRealTimeMetrics: jest.fn()
}));

// Mock document visibility API
Object.defineProperty(document, 'visibilityState', {
  writable: true,
 value: 'visible'
});

describe('useMetricsPolling Hook', () => {
  const mockMetrics = ['cpu_usage', 'memory_usage'];
  const mockResponse: ApiResponse<Record<string, any>> = {
    success: true,
    data: {
      cpu_usage: 45.2,
      memory_usage: 67.8
    },
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
 });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should fetch metrics on mount when enabled', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics));

    // Initial loading state
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for the async operation to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(getRealTimeMetrics).toHaveBeenCalledWith(mockMetrics);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockResponse.data);
    expect(result.current.error).toBeNull();
  });

  test('should not fetch metrics when disabled', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { enabled: false }));

    // Should not be loading
    expect(result.current.loading).toBe(false);
    expect(getRealTimeMetrics).not.toHaveBeenCalled();
  });

  test('should not fetch metrics when no metrics are provided', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling([]));

    // Should not be loading
    expect(result.current.loading).toBe(false);
    expect(getRealTimeMetrics).not.toHaveBeenCalled();
 });

  test('should handle successful response with onSuccess callback', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);
    const onSuccess = jest.fn();

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { onSuccess }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
  });

  test('should handle API error response', async () => {
    const errorResponse: ApiResponse<Record<string, any>> = {
      success: false,
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString()
    };
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(errorResponse);
    const onError = jest.fn();

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { onError }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Failed to fetch metrics');
    expect(onError).toHaveBeenCalledWith('Failed to fetch metrics');
 });

  test('should handle network error', async () => {
    (getRealTimeMetrics as jest.Mock).mockRejectedValue(new Error('Network error'));
    const onError = jest.fn();

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { onError }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe('Network error');
    expect(onError).toHaveBeenCalledWith('Network error');
  });

  test('should start and stop polling manually', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { interval: 1000 }));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Start polling manually
    act(() => {
      result.current.startPolling();
    });

    // Advance timers to trigger polling
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should have been called twice (initial + one poll)
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(2);

    // Stop polling
    act(() => {
      result.current.stopPolling();
    });

    // Advance timers again
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should still have been called only twice
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(2);
  });

  test('should refetch metrics manually', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Manual refetch
    await act(async () => {
      await result.current.refetch();
    });

    // Should have been called twice
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(2);
  });

  test('should poll at specified interval', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { interval: 2000 }));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Advance timers to trigger first poll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Advance timers to trigger second poll
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should have been called three times (initial + two polls)
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(3);
  });

  test('should not poll when document is hidden', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useMetricsPolling(mockMetrics, { interval: 1000 }));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate document becoming hidden
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'hidden'
    });

    // Trigger visibility change event
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance timers
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should still have been called only once (initial fetch)
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(1);

    // Simulate document becoming visible again
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      value: 'visible'
    });

    // Trigger visibility change event
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should have been called twice now (initial + visibility change fetch)
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(2);
  });

  test('should clean up interval on unmount', async () => {
    (getRealTimeMetrics as jest.Mock).mockResolvedValue(mockResponse);

    const { result, unmount } = renderHook(() => useMetricsPolling(mockMetrics, { interval: 1000 }));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Unmount the hook
    unmount();

    // Advance timers
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should still have been called only once (initial fetch)
    expect(getRealTimeMetrics).toHaveBeenCalledTimes(1);
  });
});