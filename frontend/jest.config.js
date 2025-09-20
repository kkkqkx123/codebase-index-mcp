module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/components/**/__tests__/*.test.ts',
    '<rootDir>/hooks/**/__tests__/*.test.ts',
    '<rootDir>/services/**/__tests__/*.test.ts',
  ],
  collectCoverageFrom: [
    'components/**/*.(ts|tsx)',
    'hooks/**/*.(ts|tsx)',
    'services/**/*.(ts|tsx)',
    'utils/**/*.(ts|tsx)',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
  coverageDirectory: '../coverage/frontend',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        ignoreCodes: ['TS1343'] // Ignore import.meta syntax errors
      },
      astTransformers: {
        before: [
          {
            path: 'ts-jest-mock-import-meta',
            options: {
              metaObjectReplacement: {
                env: {
                  VITE_API_BASE_URL: 'http://localhost:3001/api/v1',
                  VITE_ENABLE_DEBUG_MODE: 'false'
                }
              }
            }
          }
        ]
      }
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!d3|d3-array|d3-axis|d3-brush|d3-chord|d3-color|d3-contour|d3-delaunay|d3-dispatch|d3-drag|d3-dsv|d3-ease|d3-fetch|d3-force|d3-format|d3-geo|d3-hierarchy|d3-interpolate|d3-path|d3-polygon|d3-quadtree|d3-random|d3-scale-chromatic|d3-selection|d3-shape|d3-time|d3-time-format|d3-timer|d3-transition|d3-zoom)/'
  ],
  // Mock D3 modules for tests
  moduleNameMapper: {
    '^d3$': '<rootDir>/__mocks__/d3Mock.js',
    '^d3-(.*)$': '<rootDir>/__mocks__/d3Mock.js',
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@contexts/(.*)$': '<rootDir>/contexts/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  }
};