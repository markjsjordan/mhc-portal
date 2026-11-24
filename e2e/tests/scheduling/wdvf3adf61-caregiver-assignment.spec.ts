import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';

test.use({ storageState: STORAGE_STATE_PATHS.admin });

test.describe('E2 Caregiver Assignment & Routing (wdvf3adf61)', () => {
  test('coordinator/admin can view Caregiver Assignment Roster and open Bulk Assign modal', async ({
    page,
  }) => {
    await page.goto('/scheduling/assignments');
    await expect(page.getByTestId('caregiver-assignments-page')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId('bulk-assign-open-btn')).toBeVisible();

    await page.getByTestId('bulk-assign-open-btn').click();
    await expect(page.getByTestId('bulk-assign-modal')).toBeVisible();
  });

  test('GET /api/assignments and GET /api/assignments/roster return 200 for admin', async ({
    page,
  }) => {
    await page.goto('/scheduling/assignments');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const listRes = await page.request.get('/api/assignments?limit=10', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(listRes.status()).toBe(200);
    const listBody = (await listRes.json()) as { success: boolean; data: unknown[] };
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.data)).toBe(true);

    const rosterRes = await page.request.get('/api/assignments/roster', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(rosterRes.status()).toBe(200);
    const rosterBody = (await rosterRes.json()) as { success: boolean; data: unknown[] };
    expect(rosterBody.success).toBe(true);
    expect(Array.isArray(rosterBody.data)).toBe(true);
  });

  test('POST /api/assignments and PUT /api/assignments/:id/status reject invalid payloads with 400', async ({
    page,
  }) => {
    await page.goto('/scheduling/assignments');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const createRes = await page.request.post('/api/assignments', {
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      data: { caregiverId: 'not-a-uuid', visitId: 'not-a-uuid' },
    });
    expect(createRes.status()).toBe(400);

    const statusRes = await page.request.put('/api/assignments/not-a-uuid/status', {
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'ACCEPTED' },
    });
    expect(statusRes.status()).toBe(400);
  });
});
