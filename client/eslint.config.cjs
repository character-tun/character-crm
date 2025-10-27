const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const reactPlugin = require('eslint-plugin-react');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');
const uiRules = require('./eslint-rules');

module.exports = [
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['build/', 'public/', 'node_modules/'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, process: 'readonly' }
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    plugins: {
      import: importPlugin,
      react: reactPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'react-hooks': reactHooksPlugin,
      'no-hardcoded-ui': uiRules,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'off',
      'no-underscore-dangle': 'off',
      'react/prop-types': 'off',
      // мягкая маска: игнорируем переменные/аргументы с префиксом _ и игнорируем переменные catch
      'no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/tests/**', '**/*.test.js', '**/*.test.jsx'] }],
      // отключаем как шумную и плохо совместимую с динамическими импортами/реэкспортами
      'import/no-unused-modules': 'off',
      // Разрешаем пустые catch-блоки (они используются для безопасного чтения из localStorage)
      'no-empty': ['error', { allowEmptyCatch: true }],
      // По умолчанию правило отключено. В CI включается как error для изменённых файлов.
      'no-hardcoded-ui/no-hardcoded-ui': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
  // Jest globals for test files to avoid no-undef on describe/test/expect
  {
    files: ['src/**/__tests__/**/*.{js,jsx,ts,tsx}', 'src/**/*.{spec,test}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      'no-console': 'off',
    },
  },
];