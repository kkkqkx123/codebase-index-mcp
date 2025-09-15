import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'elevated';
  hoverable?: boolean;
  onClick?: () => void;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  className = '',
  padding = 'md',
  variant = 'default',
  hoverable = false,
  onClick,
  headerAction,
  footer
}) => {
  const cardClasses = [
    styles.card,
    styles[`card--${variant}`],
    styles[`card--padding-${padding}`],
    hoverable && styles['card--hoverable'],
    onClick && styles['card--clickable'],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} onClick={onClick}>
      {(title || subtitle || headerAction) && (
        <div className={styles.card__header}>
          <div className={styles.card__headerContent}>
            {title && <h3 className={styles.card__title}>{title}</h3>}
            {subtitle && <p className={styles.card__subtitle}>{subtitle}</p>}
          </div>
          {headerAction && (
            <div className={styles.card__headerAction}>
              {headerAction}
            </div>
          )}
        </div>
      )}
      
      <div className={styles.card__content}>
        {children}
      </div>
      
      {footer && (
        <div className={styles.card__footer}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;