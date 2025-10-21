const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const reactPlugin = require('eslint-plugin-react');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

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
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'warn',
      'no-underscore-dangle': 'off',
      'react/prop-types': 'off',
      // мягкая маска: игнорируем переменные/аргументы с префиксом _
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/tests/**', '**/*.test.js'] }],
      'import/no-unused-modules': ['warn', { missingExports: true, unusedExports: true }],
    },
    settings: { react: { version: 'detect' } },
  },
];