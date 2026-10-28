/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  testEnvironment: '<rootDir>/jest.environment.js',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    // MediaPipe is a WASM/ESM bundle; specs use a lightweight stand-in.
    '^@mediapipe/tasks-vision$': '<rootDir>/src/testing/mediapipe.mock.ts',
  },
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.spec.ts', '!src/testing/**'],
  coverageDirectory: 'coverage',
  // json-summary feeds the coverage page of the documentation (npm run docs).
  coverageReporters: ['text', 'text-summary', 'html', 'json-summary'],
};
