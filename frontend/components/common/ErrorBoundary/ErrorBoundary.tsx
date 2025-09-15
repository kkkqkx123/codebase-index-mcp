import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorMessage from '../ErrorMessage/ErrorMessage';
import Button from '../Button/Button';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log the error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Here you could also send the error to a logging service
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error tracking service
    // like Sentry, LogRocket, or your own logging API
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Example: Send to logging service
    // fetch('/api/v1/logging/error', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(errorData),
    // }).catch(console.error);

    // For now, just log to console
    console.error('Error logged:', errorData);
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const errorDetails = this.state.errorInfo?.componentStack || this.state.error?.stack;
      
      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorBoundary__content}>
            <ErrorMessage
              title="Something went wrong"
              message="We're sorry, but an unexpected error occurred. Our team has been notified."
              variant="error"
              showDetails={this.props.showDetails || process.env.NODE_ENV === 'development'}
              details={errorDetails}
              showRetry={true}
              onRetry={this.handleRetry}
            />
            
            <div className={styles.errorBoundary__actions}>
              <Button
                variant="secondary"
                onClick={this.handleReload}
                className={styles.errorBoundary__reload}
              >
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className={styles.errorBoundary__debug}>
                <h4 className={styles.errorBoundary__debugTitle}>Debug Information</h4>
                <details className={styles.errorBoundary__debugDetails}>
                  <summary>Error Stack</summary>
                  <pre className={styles.errorBoundary__debugContent}>
                    <code>{this.state.error?.stack}</code>
                  </pre>
                </details>
                <details className={styles.errorBoundary__debugDetails}>
                  <summary>Component Stack</summary>
                  <pre className={styles.errorBoundary__debugContent}>
                    <code>{this.state.errorInfo?.componentStack}</code>
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;