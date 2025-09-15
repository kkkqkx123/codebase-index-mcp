import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navigation from '../Navigation/Navigation';
import Breadcrumb from '../Breadcrumb/Breadcrumb';
import styles from './Layout.module.css';

interface LayoutProps {
  className?: string;
  showSidebar?: boolean;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  className = '',
  showSidebar = true,
  headerContent,
  footerContent
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const layoutClasses = [
    styles.layout,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.header__content}>
          {showSidebar && (
            <button
              className={styles.header__menuToggle}
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
              aria-expanded={!sidebarCollapsed}
            >
              <svg className={styles.menuIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          
          <div className={styles.header__title}>
            <h1 className={styles.header__appName}>Codebase Index MCP</h1>
          </div>
          
          {headerContent && (
            <div className={styles.header__custom}>
              {headerContent}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.main}>
        {/* Sidebar */}
        {showSidebar && (
          <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles['sidebar--collapsed'] : ''}`}>
            <Navigation collapsed={sidebarCollapsed} />
          </aside>
        )}

        {/* Page Content */}
        <main className={`${styles.content} ${showSidebar && sidebarCollapsed ? styles['content--expanded'] : ''}`}>
          <div className={styles.content__inner}>
            {/* Breadcrumb Navigation */}
            {location.pathname !== '/' && (
              <div className={styles.content__breadcrumb}>
                <Breadcrumb />
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
      {footerContent && (
        <footer className={styles.footer}>
          <div className={styles.footer__content}>
            {footerContent}
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;