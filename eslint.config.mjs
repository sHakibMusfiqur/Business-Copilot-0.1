import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // =========================================================
  // Layer 1: Global ignores (applies to everything)
  // =========================================================
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      '**/*.d.ts',
    ],
  },

  // =========================================================
  // Layer 2: ESLint recommended JS rules
  // =========================================================
  eslint.configs.recommended,

  // =========================================================
  // Layer 3: TypeScript recommended rules
  // =========================================================
  ...tseslint.configs.recommended,

  // =========================================================
  // Layer 4: Global TypeScript overrides
  // =========================================================
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },

  // =========================================================
  // Layer 6: NestJS overrides (apps/api)
  // =========================================================
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    },
  },

  // =========================================================
  // Layer 7: React + Next.js overrides (apps/web)
  // =========================================================
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.flatConfig.recommended.rules,
      ...nextPlugin.flatConfig.coreWebVitals.rules,
      '@next/next/no-img-element': 'error',
    },
  },

  // =========================================================
  // Layer 8: Prettier (must be last to disable conflicting rules)
  // =========================================================
  prettier,
);
