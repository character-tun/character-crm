module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  // Сосредотачиваем сбор покрытия на сервисах и маршрутах
  // Сужаем область покрытия до целевых сервисов, чтобы метрики отражали тестируемые участки
  collectCoverageFrom: [
    'services/stock/stockService.js',
    'services/reports/stocksReportService.js',
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/services/statusActionsHandler.js',
    '<rootDir>/services/templatesStore.js',
    '<rootDir>/services/fileStore.js',
    '<rootDir>/services/queueMetrics.js',
    '<rootDir>/queues/statusActionQueue.js',
    '<rootDir>/middleware/error.js',
    '<rootDir>/routes/reports.js',
  ],
  testTimeout: 15000,
  coverageThreshold: {
    global: {
      lines: 65,
      statements: 60,
      branches: 50,
      functions: 60,
    },
  },
};
