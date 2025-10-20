const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');
const reactPlugin = require('eslint-plugin-react');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
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
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'warn',
      'no-underscore-dangle': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/tests/**', '**/*.test.js'] }],
      'import/no-unused-modules': ['warn', { missingExports: true, unusedExports: true }],
    },
    settings: { react: { version: 'detect' } },
  },
];