export const projects = [
  {
    displayName: 'server',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: [
      '**/?(*.)+(spec|test).ts',
      '**/__tests__/**/*.+(ts|tsx|js)',
      '**/*.(test|spec).+(ts|tsx|js)'
    ],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', {
        tsconfig: 'tsconfig.json'
      }],
    },
  },
  {
    displayName: 'frontend',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/frontend'],
    testMatch: [
      '**/?(*.)+(spec|test).tsx',
      '**/__tests__/**/*.+(ts|tsx|js)',
      '**/*.(test|spec).+(ts|tsx|js)'
    ],
    setupFilesAfterEnv: ['<rootDir>/frontend/test/setup.ts'],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', {
        tsconfig: 'tsconfig.json'
      }],
    },
  }
];
export const collectCoverageFrom = [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/**/*.test.ts',
  '!src/**/__tests__/**',
];
export const coverageDirectory = 'coverage';
export const coverageReporters = ['text', 'lcov', 'html'];
export const moduleNameMapper = {
  '^@nebula-contrib/nebula-nodejs$': '<rootDir>/__mocks__/@nebula-contrib/nebula-nodejs.js'
};
export const testTimeout = 10000;
export const verbose = true;