import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Possible errors
      'no-console': 'off',
      'no-constant-condition': 'warn',
      'no-debugger': 'warn',
      'no-duplicate-case': 'error',
      'no-empty': 'warn',
      'no-extra-semi': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',

      // Best practices
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'warn',
      'prefer-promise-reject-errors': 'error',

      // Variables
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-use-before-define': ['error', { functions: false, classes: false }],

      // Style
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-template': 'warn',
    },
  },
  {
    ignores: ['cjs/', 'node_modules/', 'dist/'],
  },
];
