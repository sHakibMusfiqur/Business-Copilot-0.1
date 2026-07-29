import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // =========================================================
  // Layer 1: Global ignores
  // =========================================================
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
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
  // Layer 5: NestJS overrides (apps/api)
  // =========================================================
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },

  // =========================================================
  // Layer 6: Next.js plugin registration (global — no files scope)
  // =========================================================
  {
    plugins: {
      '@next/next': nextPlugin,
    },
  },

  // =========================================================
  // Layer 7: React + Next.js rules (apps/web only)
  // =========================================================
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-img-element': 'error',
    },
  },

  // =========================================================
  // Layer 8: Prettier (must be last)
  // =========================================================
  prettier,
);
