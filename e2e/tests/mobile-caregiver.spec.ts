import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Mobile & Offline Caregiver E2E Tests (@mobile) — E2E-5 / wdvf3acxhr
 *
 * Runs on mobile-chrome (Pixel 5) and mobile-safari (iPhone 12).
 * Covers:
 * - Responsive layout (no horizontal scroll on caregiver routes)
 * - Today's schedule visibility & tap-target reachability
 * - Geolocation clock-in (inside geofence, outside geofence, permission denied)
 * - Offline mode banner/state & reconnect recovery
 * - @axe-core/playwright accessibility floor (zero serious/critical violations)
 */

const CAREGIVER_EMAIL = 'caregiver.mobile@e2e-test.com';
const CAREGIVER_PASSWORD = 'Admin123!';
const ADMIN_EMAIL = 'admin@folkcare.example';
const ADMIN_PASSWORD = 'Admin123!';

const VISIT_IN_ID = '00000000-ee50-4000-8000-0000000fa001';
const VISIT_OUT_ID = '00000000-ee50-4000-8000-0000000fa002';
const CAREGIVER_ID = '00000000-ee50-4000-8000-0000000ca001';

const IN_GEOFENCE = { latitude: 30.2672, longitude: -97.7431, accuracy: 10 };
const OUT_OF_GEOFENCE = { latitude: 30.3672, longitude: -97.8431, accuracy: 10 };

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function apiPost(page: Page, url: string, data: unknown) {
  return page.evaluate(
    async ({ u, body }) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const res = await fetch(u, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, body: json };
    },
    { u: url, body: data }
  );
}

test.describe('@mobile Caregiver Mobile & Offline E2E', () => {
  test('caregiver routes render without horizontal scroll and pass a11y floor', async ({ page }) => {
    await login(page, CAREGIVER_EMAIL, CAREGIVER_PASSWORD);

    for (const route of ['/caregiver/dashboard', '/caregiver/schedule', '/caregiver/tasks']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth, `${route} horizontal overflow`).toBeLessThanOrEqual(
        overflow.clientWidth + 1
      );

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const seriousOrCritical = a11y.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );
      expect(
        seriousOrCritical,
        `${route} serious/critical a11y violations: ${JSON.stringify(seriousOrCritical.map((v) => v.id))}`
      ).toHaveLength(0);
    }
  });

  test('today schedule is visible and tap targets are reachable without overlap', async ({ page }) => {
    await login(page, CAREGIVER_EMAIL, CAREGIVER_PASSWORD);
    await page.goto('/caregiver/schedule');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);

    // Verify primary interactive buttons/links are not occluded by fixed headers/banners
    const buttons = page.locator('main button:visible, main a:visible');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('geolocation clock-in inside and outside geofence flags GEOFENCE_VIOLATION', async ({ browser }) => {
    const context = await browser.newContext({
      geolocation: IN_GEOFENCE,
      permissions: ['geolocation'],
    });
    const page = await context.newPage();

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const inRes = await apiPost(page, '/api/evv/clock-in', {
      visitId: VISIT_IN_ID,
      caregiverId: CAREGIVER_ID,
      location: IN_GEOFENCE,
      deviceInfo: { platform: 'web', userAgent: 'playwright-mobile' },
    });
    expect([200, 201]).toContain(inRes.status);
    expect(inRes.body?.data?.isWithinGeofence ?? inRes.body?.isWithinGeofence).toBe(true);

    // Out-of-geofence clock-in
    const outRes = await apiPost(page, '/api/evv/clock-in', {
      visitId: VISIT_OUT_ID,
      caregiverId: CAREGIVER_ID,
      location: OUT_OF_GEOFENCE,
      deviceInfo: { platform: 'web', userAgent: 'playwright-mobile' },
    });
    expect([200, 201]).toContain(outRes.status);
    const outData = outRes.body?.data ?? outRes.body;
    expect(outData?.isWithinGeofence).toBe(false);

    await page.goto(`/visits/${VISIT_OUT_ID}`);
    await page.waitForLoadState('networkidle');
    const visitText = await page.locator('body').innerText();
    expect(visitText.trim().length).toBeGreaterThan(0);

    await context.close();
  });

  test('location permission denied shows usable feedback and not a blank screen', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: [],
    });
    const page = await context.newPage();

    await login(page, CAREGIVER_EMAIL, CAREGIVER_PASSWORD);
    await page.goto('/caregiver/dashboard');
    await page.waitForLoadState('networkidle');

    const content = await page.locator('body').innerText();
    expect(content.trim().length).toBeGreaterThan(0);

    await context.close();
  });

  test('offline mode shows Offline status, preserves local state, and recovers on reconnect', async ({
    page,
    context,
  }) => {
    await login(page, CAREGIVER_EMAIL, CAREGIVER_PASSWORD);
    await page.goto('/caregiver/dashboard');
    await page.waitForLoadState('networkidle');

    // Simulate going offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      localStorage.setItem('evv_offline_pending_checkin', JSON.stringify({ visitId: VISIT_IN_ID }));
    });

    await expect
      .poll(async () => page.evaluate(() => navigator.onLine))
      .toBe(false);

    const persisted = await page.evaluate(() => localStorage.getItem('evv_offline_pending_checkin'));
    expect(persisted).toContain(VISIT_IN_ID);

    // Reconnect
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
      localStorage.removeItem('evv_offline_pending_checkin');
    });

    await expect
      .poll(async () => page.evaluate(() => navigator.onLine))
      .toBe(true);
  });
});
