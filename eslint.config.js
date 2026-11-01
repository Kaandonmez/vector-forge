import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'apps/studio/dist/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'projects/**',
      'output/**',
      'exports/**',
      '**/exports/**',
      'examples/**',
      'scripts/*',
      '!scripts/studio.ts',
      '!scripts/generate-demo.ts',
      'tests/browser/*',
      '!tests/browser/projects.spec.ts',
      '!tests/browser/studio.spec.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
