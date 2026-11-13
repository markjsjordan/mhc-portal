import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codecovVitePlugin } from '@codecov/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

const isAnalyze = process.env.ANALYZE === 'true';
const appVersion = process.env.GITHUB_SHA || 'dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [
    react({
      // Use the new JSX runtime
      jsxImportSource: 'react',
      babel: {
        plugins: [],
      },
    }),
    // PWA plugin for offline functionality
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.png', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Marquette Home Care',
        short_name: 'MHC Portal',
        description: 'Marquette Home Care staff and client care portal',
        id: '/',
        theme_color: '#1E3A8A',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        clientsClaim: true,
        // Increase max file size to cache the large JS bundle
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // Runtime caching rules
        runtimeCaching: [
          {
            // Explicit NetworkOnly for /api/* - never cache PHI responses
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/health(\/|$)/,
          /^\/metrics(\/|$)/,
          /^\/webhooks(\/|$)/,
        ],
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true, // Enable in development for testing
        type: 'module'
      }
    }),
    // Codecov bundle analysis - must be placed after all other plugins
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'folkcare-web',
      uploadToken: process.env.CODECOV_TOKEN,
      // Only upload in CI or when explicitly enabled
      uploadOverrides: {
        sha: process.env.GITHUB_SHA,
        branch: process.env.GITHUB_REF_NAME,
      },
    }),
    // Bundle visualization - generates interactive treemap showing module sizes
    // Only enabled when ANALYZE=true to avoid slowing down normal builds
    // Run: npm run build:analyze (auto-opens dist/stats.html in browser)
    // Templates: treemap (large deps), sunburst (hierarchy), network (relationships)
    ...(isAnalyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/verticals': path.resolve(__dirname, './src/verticals'),
      '@/app': path.resolve(__dirname, './src/app'),
      '@folkcare/shared-components': path.resolve(
        __dirname,
        '../shared-components/src'
      ),
      // Force packages to use browser exports
      '@folkcare/core/browser': path.resolve(
        __dirname,
        '../core/dist/browser.js'
      ),
      '@folkcare/core': path.resolve(
        __dirname,
        '../core/dist/browser.js'
      ),
      '@folkcare/care-plans-tasks/browser': path.resolve(
        __dirname,
        '../../verticals/care-plans-tasks/dist/browser.js'
      ),
      '@folkcare/care-plans-tasks': path.resolve(
        __dirname,
        '../../verticals/care-plans-tasks/dist/browser.js'
      ),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [
      '@sentry-internal/node-cpu-profiler',
      '@sentry/profiling-node',
      '@sentry/node',
      '@sentry/node-core',
      '@sentry/tracing',
      '@sentry-internal/tracing',
    ],
    esbuildOptions: {
      // Define process as an object for compatibility
      define: {
        'process.versions.node': 'undefined',
      },
    },
    force: true,
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.WEB_PORT ?? '5173', 10),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? '3001'}`,
        changeOrigin: true,
      },
    },
  },
  // `vite preview` does not inherit server.proxy; mirror it so the built app
  // can reach the API when served for E2E UI tests.
  preview: {
    port: parseInt(process.env.WEB_PREVIEW_PORT ?? '5173', 10),
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? '3000'}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [
        // Sentry Node.js modules - these are server-only and should never be bundled for browser
        '@sentry/node',
        '@sentry/node-core',
        '@sentry/profiling-node',
        '@sentry-internal/node-cpu-profiler',
        '@sentry-internal/tracing',
        /sentry_cpu_profiler.*\.node$/,
      ],
      output: {
        manualChunks: (id) => {
          // React core MUST stay in ONE chunk. Splitting react / react-dom / react-router
          // into separate chunks creates a circular chunk graph under React 19 and the app
          // crashes at startup with "Cannot set properties of undefined (setting 'Activity')",
          // leaving a blank page (regression from the #162 bundle split).
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/')
          ) {
            return 'react-vendor';
          }
          // Vercel analytics (lazy loaded, non-critical)
          if (id.includes('node_modules/@vercel/analytics') || id.includes('node_modules/@vercel/speed-insights')) {
            return 'analytics';
          }
          // Date/time libraries (pure third-party leaf, no back-edges)
          if (id.includes('node_modules/moment') || id.includes('node_modules/date-fns')) {
            return 'moment';
          }
          // Validation libraries (pure third-party leaf, no back-edges)
          if (id.includes('node_modules/zod')) {
            return 'zod';
          }
          // NOTE: do NOT add manual chunks for app code (src/verticals/*) or for libraries that
          // import app code or shared components (react-query, lucide/radix/sonner via shared UI).
          // Those splits created static chunk cycles (ui-libs <-> billing, clients <-> care-plans
          // <-> caregivers, ...) that crash at startup with TDZ errors and a blank page.
          // `npm run check:chunk-cycles` fails the build pipeline if a cycle is reintroduced.
          // Default: let Vite decide
          return undefined;
        },
      },
    },
  },
});
