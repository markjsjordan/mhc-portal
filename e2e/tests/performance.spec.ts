import { test, expect } from '../fixtures/auth.fixture.js';
import { TestDatabase } from '../setup/test-database.js';

/**
 * Performance Tests
 *
 * Tests system performance under various conditions:
 * 1. Page Load Times
 * 2. Large Dataset Rendering
 * 3. Concurrent User Load
 */
test.describe('Performance Tests', () => {
  test.describe.configure({ mode: 'serial', retries: 1 });

  test.beforeAll(async () => {
    await TestDatabase.setup();
  });

  test.afterAll(async () => {
    await TestDatabase.teardown();
  });

  test.beforeEach(async () => {
    await TestDatabase.cleanup();
  });

  test('Page Load Times: visit list should load within 3 seconds', async ({
    authenticatedPage,
  }) => {
    const startTime = Date.now();

    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Assert page loads within budget (3000ms + 50% CI headroom)
    expect(loadTime).toBeLessThan(4500);

    // Verify page is interactive
    const visitList = authenticatedPage.locator('[data-testid="visit-list"]');
    await expect(visitList).toBeVisible();
  });

  test('Page Load Times: measure Largest Contentful Paint (LCP)', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    // Measure LCP using Performance API
    const lcp = await authenticatedPage.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        });

        observer.observe({ entryTypes: ['largest-contentful-paint'] });

        // Timeout after 5 seconds
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP should be under 2.5s (+ 50% CI headroom = 3750ms)
    expect(lcp).toBeLessThan(3750);
  });

  test('Page Load Times: measure First Contentful Paint (FCP)', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/visits');

    const fcp = await authenticatedPage.evaluate(() => {
      const perfEntries = performance.getEntriesByType('paint');
      const fcpEntry = perfEntries.find((entry) => entry.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : 0;
    });

    // FCP should be under 1.8s (+ 50% CI headroom = 2700ms)
    expect(fcp).toBeGreaterThan(0);
    expect(fcp).toBeLessThan(2700);
  });

  test('Page Load Times: measure Cumulative Layout Shift (CLS)', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    // Wait a bit for any late layout shifts
    await authenticatedPage.waitForTimeout(2000);

    const cls = await authenticatedPage.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            clsValue += (entry as any).value;
          }
        });

        observer.observe({ entryTypes: ['layout-shift'] });

        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });
    });

    // CLS should be under 0.1 (+ 50% CI headroom = 0.15)
    expect(cls).toBeLessThan(0.15);
  });

  test('Page Load Times: measure Time to Interactive (TTI)', async ({
    authenticatedPage,
  }) => {
    const startTime = Date.now();

    await authenticatedPage.goto('/visits');

    // Wait for page to be fully interactive
    await authenticatedPage.waitForLoadState('networkidle');

    // Try to interact with page
    const button = authenticatedPage.getByRole('button').first();
    await button.waitFor({ state: 'visible' });

    const tti = Date.now() - startTime;

    // TTI should be under 3.8s (+ 50% CI headroom = 5700ms)
    expect(tti).toBeLessThan(5700);
  });

  test('Large Dataset Rendering: load page with 100+ visits', async ({
    authenticatedPage,
  }) => {
    // Seed database with 100+ visits
    await TestDatabase.seed('large-visit-dataset');

    const startTime = Date.now();

    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should still load within reasonable time (5000ms + 50% CI headroom = 7500ms)
    expect(loadTime).toBeLessThan(7500);

    // Verify pagination or virtualization working
    const visitItems = authenticatedPage.locator('[data-testid="visit-card"]');
    const visibleCount = await visitItems.count();

    // Should not render all 100+ at once (pagination/virtualization)
    expect(visibleCount).toBeLessThanOrEqual(50);

    // Verify page numbers or "load more" button exists
    const pagination = authenticatedPage.locator('[data-testid="pagination"]');
    const loadMore = authenticatedPage.locator('[data-testid="load-more"]');

    const hasPagination = await pagination.isVisible({ timeout: 1000 }).catch(() => false);
    const hasLoadMore = await loadMore.isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasPagination || hasLoadMore).toBe(true);
  });

  test('Large Dataset Rendering: scrolling should be smooth with virtualization', async ({
    authenticatedPage,
  }) => {
    await TestDatabase.seed('large-visit-dataset');

    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    // Measure scroll performance
    const scrollPerformance = await authenticatedPage.evaluate(() => {
      return new Promise<{ avgFrameTime: number; droppedFrames: number }>((resolve) => {
        const frameTimes: number[] = [];
        let lastTime = performance.now();
        let droppedFrames = 0;

        const measureFrame = () => {
          const currentTime = performance.now();
          const frameTime = currentTime - lastTime;
          frameTimes.push(frameTime);

          // Frame dropped if > 16.67ms (60fps threshold)
          if (frameTime > 16.67) {
            droppedFrames++;
          }

          lastTime = currentTime;

          if (frameTimes.length < 60) {
            requestAnimationFrame(measureFrame);
          } else {
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            resolve({ avgFrameTime, droppedFrames });
          }
        };

        // Scroll to trigger rendering
        window.scrollTo({ top: 1000, behavior: 'smooth' });

        requestAnimationFrame(measureFrame);
      });
    });

    // Average frame time should be close to 16.67ms (60fps + 50% CI headroom = 30ms)
    expect(scrollPerformance.avgFrameTime).toBeLessThan(30);

    // Should have minimal dropped frames (10 + 50% CI headroom = 15)
    expect(scrollPerformance.droppedFrames).toBeLessThan(15);
  });

  test('Large Dataset Rendering: verify no browser freeze', async ({
    authenticatedPage,
  }) => {
    await TestDatabase.seed('large-visit-dataset');

    await authenticatedPage.goto('/visits');
    await authenticatedPage.waitForLoadState('networkidle');

    // Try to interact during/after load
    const searchInput = authenticatedPage.getByPlaceholder(/search/i);
    const searchExists = await searchInput.isVisible({ timeout: 2000 }).catch(() => false);

    if (searchExists) {
      // Type should be responsive
      const startTime = Date.now();
      await searchInput.fill('test');
      const typeTime = Date.now() - startTime;

      // Typing should be responsive (< 100ms + 100ms CI headroom = 200ms)
      expect(typeTime).toBeLessThan(200);
    }

    // Button clicks should be responsive
    const filterBtn = authenticatedPage.getByRole('button').first();
    if (await filterBtn.isVisible()) {
      const startTime = Date.now();
      await filterBtn.click();
      const clickTime = Date.now() - startTime;

      expect(clickTime).toBeLessThan(200);
    }
  });

  test('Memory Usage: should not have memory leaks during navigation', async ({
    authenticatedPage,
  }) => {
    const initialMemory = await authenticatedPage.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Navigate through multiple pages
    const pages = ['/visits', '/clients', '/caregivers', '/dashboard', '/visits'];

    for (const pagePath of pages) {
      await authenticatedPage.goto(pagePath);
      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.waitForTimeout(500);
    }

    // Force garbage collection if available
    await authenticatedPage.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    const finalMemory = await authenticatedPage.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      // Memory should not increase dramatically (< 50% + 25% CI headroom = 75%)
      const memoryIncrease = (finalMemory - initialMemory) / initialMemory;
      expect(memoryIncrease).toBeLessThan(0.75);
    }
  });

  test('Image Loading: optimize image loading with lazy loading', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/clients');
    await authenticatedPage.waitForLoadState('networkidle');

    // Check if images use lazy loading
    const images = authenticatedPage.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      const firstImage = images.first();
      const loading = await firstImage.getAttribute('loading');

      // Images below fold should use lazy loading
      expect(loading).toBe('lazy');
    }

    // Verify images don't block initial page load
    const domContentLoaded = await authenticatedPage.evaluate(() => {
      return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
    });

    expect(domContentLoaded).toBeLessThan(3000);
  });
});
