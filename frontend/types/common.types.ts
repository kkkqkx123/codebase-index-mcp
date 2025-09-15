// Shared Utility Types

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface FilterOptions {
  [key: string]: string | number | boolean | string[] | number[];
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState<T> {
  values: T;
  errors: Record<keyof T, string | undefined>;
  isSubmitting: boolean;
  isDirty: boolean;
}

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  refreshInterval: number;
  pageSize: number;
}

export interface FrontendConfig {
  api: {
    baseUrl: string;
    apiKey?: string;
    timeout: number;
    retryAttempts: number;
  };
  monitoring: {
    baseUrl: string; // Backend proxy base URL
    grafanaDashboards: {
      system: string;
      performance: string;
      database: string;
    };
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    refreshInterval: number;
    pagination: {
      defaultPageSize: number;
      maxPageSize: number;
    };
  };
  features: {
    enableDebugMode: boolean;
    enableExperimental: boolean;
    enableWebSocket: boolean;
  };
}