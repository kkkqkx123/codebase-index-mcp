import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Breadcrumb.module.css';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = (
    <svg className={styles.breadcrumb__separator} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  maxItems = 5,
  className = ''
}) => {
  const location = useLocation();

  // Generate breadcrumb items from current path if not provided
  const generateBreadcrumbItems = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      // Convert kebab-case or snake_case to Title Case
      const label = segment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
      
      items.push({
        label,
        path: currentPath
      });
    });

    return items;
  };

  const breadcrumbItems = items || generateBreadcrumbItems();

  // Truncate items if they exceed maxItems
  const getTruncatedItems = () => {
    if (breadcrumbItems.length <= maxItems) {
      return breadcrumbItems;
    }

    // Always show first item (Home) and last item
    const firstItem = breadcrumbItems[0];
    const lastItem = breadcrumbItems[breadcrumbItems.length - 1];
    
    // Show some middle items with ellipsis
    const middleStart = Math.max(1, breadcrumbItems.length - maxItems + 3);
    const middleEnd = Math.min(breadcrumbItems.length - 1, middleStart + maxItems - 3);
    const middleItems = breadcrumbItems.slice(middleStart, middleEnd);

    const truncatedItems: BreadcrumbItem[] = [firstItem];
    
    if (middleStart > 1) {
      truncatedItems.push({ label: '...' });
    }
    
    truncatedItems.push(...middleItems);
    
    if (middleEnd < breadcrumbItems.length - 1) {
      truncatedItems.push({ label: '...' });
    }
    
    truncatedItems.push(lastItem);

    return truncatedItems;
  };

  const truncatedItems = getTruncatedItems();

  return (
    <nav className={`${styles.breadcrumb} ${className}`} aria-label="Breadcrumb">
      <ol className={styles.breadcrumb__list}>
        {truncatedItems.map((item, index) => {
          const isLast = index === truncatedItems.length - 1;
          const isEllipsis = item.label === '...';

          return (
            <li key={index} className={styles.breadcrumb__item}>
              {index > 0 && (
                <span className={styles.breadcrumb__separatorWrapper} aria-hidden="true">
                  {separator}
                </span>
              )}
              
              {isEllipsis ? (
                <span className={styles.breadcrumb__ellipsis}>{item.label}</span>
              ) : isLast ? (
                <span className={styles.breadcrumb__current} aria-current="page">
                  {item.icon && (
                    <span className={styles.breadcrumb__icon}>{item.icon}</span>
                  )}
                  {item.label}
                </span>
              ) : item.path ? (
                <Link to={item.path} className={styles.breadcrumb__link}>
                  {item.icon && (
                    <span className={styles.breadcrumb__icon}>{item.icon}</span>
                  )}
                  {item.label}
                </Link>
              ) : (
                <span className={styles.breadcrumb__text}>
                  {item.icon && (
                    <span className={styles.breadcrumb__icon}>{item.icon}</span>
                  )}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;