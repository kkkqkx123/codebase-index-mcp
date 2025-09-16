export const testEnvironment = 'node';
export const roots = ['<rootDir>/src', '<rootDir>/test'];
export const testMatch = [
  '**/?(*.)+(spec|test).ts',
  '**/__tests__/**/*.+(ts|tsx|js)',
  '**/*.(test|spec).+(ts|tsx|js)'
];
export const transform = {
  '^.+\\.tsx?$': ['ts-jest', {
    tsconfig: 'tsconfig.json'
  }],
};
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