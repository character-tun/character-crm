module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
    'plugin:import/recommended',
  ],
  plugins: ['unused-imports'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script'
  },
  ignorePatterns: [
    'node_modules/',
    'client/',
    'storage/',
    'coverage/',
  ],
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'camelcase': ['warn', { properties: 'never', ignoreDestructuring: true }],
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['warn', {
      args: 'none',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/tests/**', 'scripts/**', '**/*.test.js'] }],
    'import/no-unused-modules': ['warn', { missingExports: false, unusedExports: true }],
    'global-require': 'off'
  },
};