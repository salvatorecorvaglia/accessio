import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // A floor a couple points below the measured baseline (statements 91.3%, branches
      // 84.9%, functions 93.8%, lines 92.4%) — enough to catch a real regression without
      // being brittle to minor fluctuations.
      thresholds: {
        statements: 90,
        branches: 83,
        functions: 92,
        lines: 91,
      },
    },
  },
});
