// Metrics Polling Hook for Codebase Index Frontend
// This hook provides real-time metrics polling functionality

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRealTimeMetrics } from '@services/monitoring.service';
import { ApiResponse } from '@types/api.types';

// Type for metrics polling options
interface MetricsPollingOptions {
  interval?: number; // Polling interval in milliseconds (default: 30000)
  enabled?: boolean; // Whether polling is enabled (default: true)
  onError?: (error: string) => void; // Error callback
  onSuccess?: (data: Record<string, any>) => void; // Success callback
}

// Type for metrics polling result
interface MetricsPollingResult {
  data: Record<string, any> | null;
  loading: boolean;
  error: string | null;
  startPolling: () => void;
  stopPolling: () => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for polling real-time metrics
 * @param metrics - Array of metric names to poll
 * @param options - Polling options
 * @returns Metrics polling result
 */
export const useMetricsPolling = (
  metrics: string[],
  options: MetricsPollingOptions = {}
): MetricsPollingResult => {
  const {
    interval = 30000,
    enabled = true,
    onError,
    onSuccess
  } = options;

  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);

  // Function to fetch metrics
  const fetchMetrics = useCallback(async () => {
    if (metrics.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Record<string, any>> = await getRealTimeMetrics(metrics);
      
      if (response.success && response.data) {
        setData(response.data);
        onSuccess?.(response.data);
      } else {
        const errorMessage = response.error || 'Failed to fetch metrics';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [metrics, onError, onSuccess]);

  // Function to start polling
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !enabled || metrics.length === 0) {
      return;
    }

    isPollingRef.current = true;
    fetchMetrics(); // Fetch immediately on start

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMetrics();
      }
    }, interval);
  }, [enabled, fetchMetrics, interval, metrics.length]);

  // Function to stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Function to refetch metrics manually
  const refetch = useCallback(async () => {
    await fetchMetrics();
  }, [fetchMetrics]);

  // Start polling when component mounts or dependencies change
  useEffect(() => {
    if (enabled && metrics.length > 0) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, metrics.length, startPolling, stopPolling]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && metrics.length > 0) {
        // Fetch fresh data when page becomes visible
        fetchMetrics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, fetchMetrics, metrics.length]);

  return {
    data,
    loading,
    error,
    startPolling,
    stopPolling,
    refetch
  };
};