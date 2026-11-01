/**
 * Vitest configuration for mobile package
 * 
 * Note: Testing React Native components requires special setup.
 * This config is for unit testing services and utilities.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Use 'jsdom' for React Native testing with proper setup
    server: {
      deps: {
        // netinfo is intentionally NOT inlined: its ESM entry imports
        // react-native, whose Flow-only index.js cannot be parsed by Rollup.
        // Tests mock netinfo via vitest.setup.ts, so it is never executed.
        inline: ['@nozbe/watermelondb'],
      },
    },
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.expo/',
        'ios/',
        'android/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts', // Barrel exports
        'src/features/**/*.tsx', // UI components (would need RN test environment)
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.expo',
      'ios',
      'android',
      'src/services/__tests__/location.test.ts',
      'src/services/__tests__/offline-queue.test.ts',
    ],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: '/src' },
      {
        // Replace the RN-backed package with an in-memory Node stub: its ESM
        // build imports react-native (Flow-only index.js, unparseable here).
        find: /^@react-native-async-storage\/async-storage$/,
        replacement: new URL('./test-stubs/async-storage.ts', import.meta.url).pathname,
      },
      {
        // Replace the native bridge with an in-memory Node stub: it resolves
        // into react-native (Flow-only index.js, unparseable here).
        find: /^expo-secure-store$/,
        replacement: new URL('./test-stubs/expo-secure-store.ts', import.meta.url).pathname,
      },
    ],
  },
});
