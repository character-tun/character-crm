module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coveragePathIgnorePatterns: [
    '<rootDir>/services/statusActionsHandler.js',
    '<rootDir>/services/templatesStore.js',
    '<rootDir>/services/fileStore.js',
    '<rootDir>/services/queueMetrics.js',
    '<rootDir>/queues/statusActionQueue.js',
    '<rootDir>/middleware/error.js',
  ],
  testTimeout: 15000,
  coverageThreshold: {
    global: {
      lines: 65,
      statements: 60,
      branches: 44,
      functions: 55,
    },
  },
};
