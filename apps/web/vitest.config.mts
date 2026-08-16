import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@bc/types': fileURLToPath(new URL('../../packages/types/src', import.meta.url)),
      '@bc/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});