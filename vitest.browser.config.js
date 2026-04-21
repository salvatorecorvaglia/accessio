/**
 * Vitest configuration for browser environment tests.
 *
 * Uses jsdom to simulate browser APIs (fetch, XMLHttpRequest, etc.)
 * Run with: npx vitest run --config vitest.browser.config.js
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
    },
  },
});
