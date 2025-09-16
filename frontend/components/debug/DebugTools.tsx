import React, { useState } from 'react';
import ApiLogs from './ApiLogs/ApiLogs';
import PerformanceMetrics from './PerformanceMetrics/PerformanceMetrics';
import ErrorViewer from './ErrorViewer/ErrorViewer';
import DevMode from './DevMode/DevMode';
import Card from '../common/Card/Card';
import Button from '../common/Button/Button';
import styles from './DebugTools.module.css';

interface DebugToolsProps {
  defaultTab?: 'logs' | 'metrics' | 'errors' | 'devmode';
}

type TabId = 'logs' | 'metrics' | 'errors' | 'devmode';

const DebugTools: React.FC<DebugToolsProps> = ({
  defaultTab = 'logs'
}) => {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const tabs = [
    { id: 'logs' as TabId, label: 'API Logs', component: <ApiLogs /> },
    { id: 'metrics' as TabId, label: 'Performance', component: <PerformanceMetrics /> },
    { id: 'errors' as TabId, label: 'Error Viewer', component: <ErrorViewer /> },
    { id: 'devmode' as TabId, label: 'Dev Mode', component: <DevMode /> }
  ];

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className={styles.debugTools}>
      <Card>
        <div className={styles.header}>
          <h1>Debugging Tools</h1>
          <div className={styles.headerDescription}>
            Monitor and debug MCP service functionality with comprehensive debugging tools
          </div>
        </div>

        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTabContent}
        </div>

        <div className={styles.footer}>
          <div className={styles.documentation}>
            <h3>Debugging Documentation</h3>
            <ul className={styles.docList}>
              <li>
                <a href="#" className={styles.docLink}>API Logs Guide</a>
                <span className={styles.docDescription}>
                  Learn how to interpret API request/response logs
                </span>
              </li>
              <li>
                <a href="#" className={styles.docLink}>Performance Monitoring</a>
                <span className={styles.docDescription}>
                  Understand performance metrics and alerts
                </span>
              </li>
              <li>
                <a href="#" className={styles.docLink}>Error Resolution</a>
                <span className={styles.docDescription}>
                  Best practices for tracking and resolving errors
                </span>
              </li>
              <li>
                <a href="#" className={styles.docLink}>Development Mode</a>
                <span className={styles.docDescription}>
                  Advanced debugging features for developers
                </span>
              </li>
            </ul>
          </div>

          <div className={styles.helpSection}>
            <h3>Need Help?</h3>
            <p className={styles.helpText}>
              If you encounter issues with the debugging tools or need assistance interpreting the data, 
              please check the documentation or contact the development team.
            </p>
            <div className={styles.helpActions}>
              <Button variant="secondary" size="sm">
                View Documentation
              </Button>
              <Button variant="secondary" size="sm">
                Report Issue
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DebugTools;