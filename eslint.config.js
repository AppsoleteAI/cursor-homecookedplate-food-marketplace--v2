const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "coverage/*"],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // CRITICAL: React Hooks Rules - Prevent "Rendered more hooks" errors
      'react-hooks/rules-of-hooks': 'error', // Enforce hooks are called in the same order
      'react-hooks/exhaustive-deps': 'warn', // Warn about missing dependencies
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}', 'jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
  },
]);
