// Flat-конфиг ESLint: базовые правила Expo, React/React Native и TypeScript.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'web-build/**',
      'android/**',
      'ios/**',
      'scripts/**',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // console.log не должен попадать в прод-сборку; warn/error — часть
      // диагностики синхронизации и остаются.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__mocks__/**'],
    rules: {
      'no-console': 'off',
    },
  },
]);
