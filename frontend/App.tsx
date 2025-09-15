import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/globals.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Codebase Index MCP - Frontend Interface</h1>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<div>Welcome to the Codebase Index MCP Frontend</div>} />
        </Routes>
      </main>
    </div>
  );
};

export default App;