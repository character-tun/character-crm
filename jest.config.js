module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      lines: 60,
      statements: 60,
      branches: 45,
      functions: 50,
    },
  },
};