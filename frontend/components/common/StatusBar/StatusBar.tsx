import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  status: 'online' | 'offline' | 'warning' | 'error';
  message?: string;
  timestamp?: Date;
  className?: string;
  showDetails?: boolean;
  details?: string;
  onClick?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  status,
  message,
  timestamp,
  className = '',
  showDetails = false,
  details,
  onClick
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return (
          <svg className={styles.statusIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'offline':
        return (
          <svg className={styles.statusIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={styles.statusIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className={styles.statusIcon} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (message) return message;
    
    switch (status) {
      case 'online':
        return 'System Online';
      case 'offline':
        return 'System Offline';
      case 'warning':
        return 'System Warning';
      case 'error':
        return 'System Error';
      default:
        return 'Unknown Status';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const statusBarClasses = [
    styles.statusBar,
    styles[`statusBar--${status}`],
    onClick && styles['statusBar--clickable'],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={statusBarClasses} onClick={onClick} role="status">
      <div className={styles.statusBar__content}>
        <div className={styles.statusBar__left}>
          <div className={styles.statusBar__icon}>
            {getStatusIcon()}
          </div>
          <div className={styles.statusBar__text}>
            <span className={styles.statusBar__message}>{getStatusMessage()}</span>
            {timestamp && (
              <span className={styles.statusBar__timestamp}>
                {formatTimestamp(timestamp)}
              </span>
            )}
          </div>
        </div>
        
        {showDetails && details && (
          <div className={styles.statusBar__details}>
            <span className={styles.statusBar__detailsText}>{details}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusBar;