import React from 'react';
import Button from '../Button/Button';
import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  title?: string;
  message: string;
  variant?: 'error' | 'warning' | 'info';
  showRetry?: boolean;
  onRetry?: () => void;
  showDetails?: boolean;
  details?: string;
  className?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  variant = 'error',
  showRetry = false,
  onRetry,
  showDetails = false,
  details,
  className = '',
  dismissible = false,
  onDismiss
}) => {
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);

  const getIcon = () => {
    switch (variant) {
      case 'error':
        return (
          <svg className={styles.icon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={styles.icon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className={styles.icon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const errorClasses = [
    styles.error,
    styles[`error--${variant}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={errorClasses} role="alert">
      <div className={styles.error__content}>
        <div className={styles.error__header}>
          <div className={styles.error__icon}>
            {getIcon()}
          </div>
          <div className={styles.error__text}>
            {title && <h3 className={styles.error__title}>{title}</h3>}
            <p className={styles.error__message}>{message}</p>
          </div>
          {dismissible && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className={styles.error__dismiss}
              aria-label="Dismiss error"
            >
              <svg className={styles.dismissIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>
        
        <div className={styles.error__actions}>
          {showRetry && onRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              className={styles.error__retry}
            >
              Try Again
            </Button>
          )}
          {showDetails && details && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className={styles.error__detailsToggle}
            >
              {showErrorDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          )}
        </div>
        
        {showErrorDetails && details && (
          <div className={styles.error__details}>
            <pre className={styles.error__detailsContent}>
              <code>{details}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;