module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageThreshold: {
    global: {
      lines: 65,
      statements: 65,
      branches: 50,
      functions: 55,
    },
  },
};