// Debugging Tools Types

export interface ApiLog {
  id: string;
  timestamp: Date;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  status: number;
  statusText: string;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  responseHeaders: Record<string, string>;
  responseBody?: any;
  duration: number;
  success: boolean;
  error?: string;
}

export interface ApiLogFilter {
  method?: string;
  status?: number | string;
  url?: string;
  success?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'api' | 'database';
  threshold?: {
    warning: number;
    critical: number;
  };
  trend?: 'up' | 'down' | 'stable';
}

export interface PerformanceAlert {
  id: string;
  metricId: string;
  metricName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface ErrorInfo {
  id: string;
  timestamp: Date;
  type: string;
  message: string;
  stackTrace?: string;
  component?: string;
  action?: string;
  context?: Record<string, any>;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  resolutionNotes?: string;
}

export interface ErrorFilter {
  type?: string;
  component?: string;
  resolved?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface FilterOptions {
  category?: string;
}

export interface DevModeFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'logging' | 'profiling' | 'inspection' | 'testing';
}

export interface ComponentState {
  componentId: string;
  props: Record<string, any>;
  state: Record<string, any>;
  hooks: Array<{
    name: string;
    value: any;
  }>;
  renderCount: number;
  lastRender: Date;
  renderTime: number;
}

export interface ProfilingData {
  id: string;
  name: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  type: 'render' | 'effect' | 'callback' | 'api';
  component?: string;
  metrics: {
    memoryUsage?: number;
    cpuUsage?: number;
    callCount?: number;
  };
}

export interface DebugSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  active: boolean;
  features: DevModeFeature[];
  logs: ApiLog[];
  errors: ErrorInfo[];
  performanceData: PerformanceMetric[];
  notes: string;
}

export interface DebugToolsConfig {
  maxLogEntries: number;
  autoCaptureErrors: boolean;
  enablePerformanceProfiling: boolean;
  enableComponentInspection: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  sessionPersistence: boolean;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'txt' | 'xml';
  includeTimestamps: boolean;
  includeSensitiveData: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
}