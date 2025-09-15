module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
  },
  testMatch: [
    '<rootDir>/__tests__/**/*.test.(ts|tsx)',
    '<rootDir>/components/**/__tests__/*.(ts|tsx)',
    '<rootDir>/hooks/**/__tests__/*.(ts|tsx)',
    '<rootDir>/services/**/__tests__/*.(ts|tsx)',
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
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};