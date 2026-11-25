import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';

test.use({ storageState: STORAGE_STATE_PATHS.admin });

test.describe('E3 Visit Documentation & Completion (wdvf3adf62)', () => {
  test('PATCH /api/visits/:id/complete rejects invalid visit ID and missing PIN with 400', async ({
    page,
  }) => {
    await page.goto('/scheduling');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const invalidIdRes = await page.request.patch('/api/visits/not-a-uuid/complete', {
      headers: {
        Authorization: `Bearer ${admin.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        outcome: 'COMPLETED',
        timeIn: '2026-11-24T09:00:00.000Z',
        timeOut: '2026-11-24T10:00:00.000Z',
        confirmationMethod: 'PIN',
        confirmationPin: '1234',
      },
    });
    expect(invalidIdRes.status()).toBe(400);

    const missingPinRes = await page.request.patch(
      '/api/visits/22222222-2222-4222-8222-222222222222/complete',
      {
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        data: {
          outcome: 'COMPLETED',
          timeIn: '2026-11-24T09:00:00.000Z',
          timeOut: '2026-11-24T10:00:00.000Z',
          confirmationMethod: 'PIN',
        },
      }
    );
    expect(missingPinRes.status()).toBe(400);
  });

  test('GET /api/visits/:id/completion and PATCH /api/visits/:id/completion validate inputs', async ({
    page,
  }) => {
    await page.goto('/scheduling');
    const admin = getPersonaUser('admin');
    expect(admin.token).toBeTruthy();

    const getRes = await page.request.get('/api/visits/not-a-uuid/completion', {
      headers: { Authorization: `Bearer ${admin.token}` },
    });
    expect(getRes.status()).toBe(400);

    const editRes = await page.request.patch(
      '/api/visits/22222222-2222-4222-8222-222222222222/completion',
      {
        headers: {
          Authorization: `Bearer ${admin.token}`,
          'Content-Type': 'application/json',
        },
        data: { observations: 'Missing editReason' },
      }
    );
    expect(editRes.status()).toBe(400);
  });
});
