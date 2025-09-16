module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/?(*.)+(spec|test).ts',
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/test'],
      testMatch: [
        '**/?(*.)+(spec|test).ts',
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.(test|spec).+(ts|tsx|js)'
      ],
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
    }
  ],
  transform: {
    '^.+\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@nebula-contrib/nebula-nodejs$': '<rootDir>/__mocks__/@nebula-contrib/nebula-nodejs.js'
  },
  testTimeout: 10000,
  verbose: true,
};