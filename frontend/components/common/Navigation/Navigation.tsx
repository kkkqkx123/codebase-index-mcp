import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navigation.module.css';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
  badge?: string | number;
  children?: NavigationItem[];
}

interface NavigationProps {
  collapsed?: boolean;
  items?: NavigationItem[];
}

const defaultNavigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: (
      <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    icon: (
      <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
  {
    id: 'search',
    label: 'Code Search',
    path: '/search',
    icon: (
      <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  {
    id: 'graph',
    label: 'Graph Visualization',
    path: '/graph',
    icon: (
      <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    id: 'debug',
    label: 'Debug Tools',
    path: '/debug',
    icon: (
      <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

const Navigation: React.FC<NavigationProps> = ({
  collapsed = false,
  items = defaultNavigationItems
}) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const active = isActive(item.path);

    const itemClasses = [
      styles.navItem,
      active && styles['navItem--active'],
      collapsed && styles['navItem--collapsed']
    ].filter(Boolean).join(' ');

    const linkClasses = [
      styles.navLink,
      active && styles['navLink--active']
    ].filter(Boolean).join(' ');

    return (
      <div key={item.id} className={itemClasses}>
        <Link
          to={item.path}
          className={linkClasses}
          title={collapsed ? item.label : undefined}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.id);
            }
          }}
        >
          <div className={styles.navLink__content}>
            {item.icon && (
              <div className={styles.navLink__icon}>
                {item.icon}
              </div>
            )}
            
            {!collapsed && (
              <div className={styles.navLink__text}>
                <span className={styles.navLink__label}>{item.label}</span>
                {item.badge && (
                  <span className={styles.navLink__badge}>{item.badge}</span>
                )}
              </div>
            )}
            
            {hasChildren && !collapsed && (
              <div className={styles.navLink__arrow}>
                <svg
                  className={`${styles.navLink__arrowIcon} ${isExpanded ? styles['navLink__arrowIcon--expanded'] : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>
        </Link>

        {hasChildren && !collapsed && isExpanded && (
          <div className={styles.navSubmenu}>
            {item.children!.map((child) => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`${styles.navigation} ${collapsed ? styles['navigation--collapsed'] : ''}`} aria-label="Main navigation">
      <div className={styles.navigation__inner}>
        <div className={styles.navigation__items}>
          {items.map((item) => renderNavigationItem(item))}
        </div>
        
        {!collapsed && (
          <div className={styles.navigation__footer}>
            <div className={styles.navFooter}>
              <div className={styles.navFooter__version}>
                v1.0.0
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;