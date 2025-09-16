import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Polyfill TextEncoder for jsdom environment
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
});

// Mock console.error to suppress act() warnings during testing
const originalError = console.error;
console.error = jest.fn((...args) => {
  // Suppress act() warnings
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
    return;
  }
  // For all other errors, call the original console.error
  originalError(...args);
});

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:3001/api/v1';
process.env.VITE_API_TIMEOUT = '30000';
process.env.VITE_ENABLE_DEBUG_MODE = 'false';