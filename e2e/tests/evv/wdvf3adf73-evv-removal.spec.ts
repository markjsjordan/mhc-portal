import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';

test.use({ storageState: STORAGE_STATE_PATHS.admin });

test.describe('EVV/Geofencing Removal (wdvf3adf73)', () => {
  test('EVV API endpoints return 404 after removal', async ({ page }) => {
    await page.goto('/dashboard');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const headers = { Authorization: `Bearer ${admin.token}` };

    const evvListRes = await page.request.get('/api/evv', { headers });
    expect(evvListRes.status()).toBe(404);

    const timeTrackingRes = await page.request.get('/api/time-tracking', { headers });
    expect(timeTrackingRes.status()).toBe(404);

    const evvVisitsCreateRes = await page.request.post('/api/evv-visits', {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { visitId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(evvVisitsCreateRes.status()).toBe(404);

    const evvVisitsClockOutRes = await page.request.patch(
      '/api/evv-visits/00000000-0000-0000-0000-000000000000/clock-out',
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: {},
      }
    );
    expect(evvVisitsClockOutRes.status()).toBe(404);
  });

  test('navigating to /time-tracking does not render EVV records page', async ({ page }) => {
    await page.goto('/time-tracking');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /EVV Records/i })).toHaveCount(0);
  });
});
