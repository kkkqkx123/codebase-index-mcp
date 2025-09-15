import React from 'react';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
  text
}) => {
  const spinnerClasses = [
    styles.spinner,
    styles[`spinner--${size}`],
    styles[`spinner--${variant}`],
    className
  ].filter(Boolean).join(' ');

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { width: '1rem', height: '1rem' };
      case 'md':
        return { width: '1.5rem', height: '1.5rem' };
      case 'lg':
        return { width: '2rem', height: '2rem' };
      case 'xl':
        return { width: '3rem', height: '3rem' };
      default:
        return { width: '1.5rem', height: '1.5rem' };
    }
  };

  const sizeStyle = getSizeClasses();

  return (
    <div className={styles.container}>
      <svg
        className={spinnerClasses}
        style={sizeStyle}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className={styles.spinner__circle}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className={styles.spinner__path}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <span className={styles.text}>{text}</span>}
    </div>
  );
};

export default LoadingSpinner;