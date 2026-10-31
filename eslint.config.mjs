import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**',
      '**/next-env.d.ts', 'apps/web/postcss.config.js', 'apps/web/tailwind.config.ts'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    files: ['**/test/**', '**/e2e/**', '**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
);
