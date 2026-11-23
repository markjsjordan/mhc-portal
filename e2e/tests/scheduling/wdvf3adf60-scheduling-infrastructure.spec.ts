import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';

test.use({ storageState: STORAGE_STATE_PATHS.admin });

test.describe('E1 Scheduling Infrastructure (wdvf3adf60)', () => {
  test('coordinator/admin can view calendar and search visits via GET /api/visits', async ({
    page,
  }) => {
    await page.goto('/scheduling/calendar');
    await expect(page.getByTestId('calendar-schedule-backups-btn')).toBeVisible({
      timeout: 15000,
    });

    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const searchRes = await page.request.get('/api/visits?limit=10', {
      headers: {
        Authorization: `Bearer ${admin.token}`,
      },
    });
    expect(searchRes.status()).toBe(200);
    const searchBody = (await searchRes.json()) as {
      success: boolean;
      data: Array<{ id: string; status: string }>;
      meta?: { count: number };
    };
    expect(searchBody.success).toBe(true);
    expect(Array.isArray(searchBody.data)).toBe(true);
  });

  test('PATCH /api/visits/:id/status rejects invalid visit IDs with 400', async ({
    page,
  }) => {
    await page.goto('/scheduling/calendar');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const res = await page.request.patch('/api/visits/not-a-uuid/status', {
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'CANCELLED', reason: 'E2E validation check' },
    });
    expect(res.status()).toBe(400);
  });
});
