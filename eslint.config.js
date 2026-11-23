// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Layer rules (see docs/TECHNICAL_ARCHITECTURE.md §2):
 * - core: pure deterministic TypeScript. No engine, UI, browser APIs, Math.random or Date.
 * - content: data only; may import types/helpers from core.
 * - render and ui never import each other; they talk through `game`.
 */
const CORE_FORBIDDEN_IMPORTS = {
  patterns: [
    {
      group: ['phaser', 'react', 'react-dom', 'react/*', 'idb'],
      message: 'core must stay engine/UI agnostic.',
    },
    {
      group: ['**/game/**', '**/render/**', '**/ui/**', '**/persistence/**', '**/platform/**'],
      message: 'core cannot depend on outer layers.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      'coverage',
      'test-results',
      'playwright-report',
      'assets/build',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', CORE_FORBIDDEN_IMPORTS],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'performance',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
        ].map((name) => ({ name, message: 'core is deterministic and environment agnostic.' })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG (core/rng).' },
        { object: 'Date', property: 'now', message: 'Game time comes from the simulation clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Game time comes from the simulation clock.',
        },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'react', 'react-dom', 'idb'], message: 'content is plain data.' },
            {
              group: [
                '**/game/**',
                '**/render/**',
                '**/ui/**',
                '**/persistence/**',
                '**/platform/**',
              ],
              message: 'content is plain data.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '**/ui/**'],
              message: 'render talks to ui only through game.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', '**/render/**'], message: 'ui talks to render only through game.' },
          ],
        },
      ],
    },
  },
);
