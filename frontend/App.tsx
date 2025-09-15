import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/common/Layout/Layout';
import ErrorBoundary from './components/common/ErrorBoundary/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/globals.css';

// Import Dashboard component
import Dashboard from './components/dashboard/Dashboard';

const Projects = () => (
  <div>
    <h2>Project Management</h2>
    <p>Manage your codebase indexing projects</p>
  </div>
);

const CodeSearch = () => (
  <div>
    <h2>Code Search</h2>
    <p>Search across your indexed codebases</p>
  </div>
);

const GraphVisualization = () => (
  <div>
    <h2>Graph Visualization</h2>
    <p>Visualize code relationships and dependencies</p>
  </div>
);

const DebugTools = () => (
  <div>
    <h2>Debug Tools</h2>
    <p>Debug and monitor MCP service functionality</p>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/search" element={<CodeSearch />} />
              <Route path="/graph" element={<GraphVisualization />} />
              <Route path="/debug" element={<DebugTools />} />
            </Route>
            <Route path="*" element={<div>Page not found</div>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;