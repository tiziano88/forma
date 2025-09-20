/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  // Allow importing generated protobuf files
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Fix TypeScript configuration for Jest globals
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
