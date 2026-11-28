import { test, expect, APIRequestContext } from '@playwright/test';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';
import { E2E_UUIDS } from '../../fixtures/test-data.js';

function getAuthHeaders(persona: 'orgAdmin' | 'coordinator'): Record<string, string> {
  const user = getPersonaUser(persona);
  if (!user.token) {
    throw new Error(`Missing JWT token in storageState for persona "${persona}"`);
  }
  return {
    Authorization: `Bearer ${user.token}`,
    'Content-Type': 'application/json',
  };
}

async function seedClient(
  request: APIRequestContext,
  status: 'PENDING_INTAKE' | 'ACTIVE',
  suffix: string
): Promise<string> {
  const res = await request.post('/api/clients', {
    headers: getAuthHeaders('orgAdmin'),
    data: {
      branchId: E2E_UUIDS.BRANCH_E2E,
      firstName: `StatusE2E${suffix}`,
      lastName: 'Client',
      dateOfBirth: '1955-06-15',
      status,
      primaryPhone: {
        number: '5125551234',
        type: 'HOME',
        canReceiveSMS: false,
      },
      primaryAddress: {
        type: 'HOME',
        line1: '100 Status Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      },
    },
  });
  expect(res.ok(), `Failed to seed client: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { data?: { id?: string }; id?: string };
  const id = body.data?.id ?? body.id;
  if (!id) {
    throw new Error(`Seeded client response missing id: ${JSON.stringify(body)}`);
  }
  return id;
}

test.describe('Edit Client manual status dropdown (wdvf3adqpj)', () => {
  test.describe('Admin flows', () => {
    test.use({ storageState: STORAGE_STATE_PATHS.orgAdmin });

    test('shows PENDING_INTAKE read-only badge, 5 options, updates non-destructive status and persists after refresh', async ({
      page,
      request,
    }) => {
      const clientId = await seedClient(request, 'PENDING_INTAKE', `A${Date.now().toString().slice(-5)}`);

      await page.goto(`/clients/${clientId}/edit`);
      await expect(page.getByTestId('client-status-section')).toBeVisible();
      await expect(page.getByTestId('pending-intake-status-badge')).toContainText('Pending Intake');

      const trigger = page.locator('#client-status-select');
      await trigger.click();

      const options = page.getByRole('option');
      await expect(options).toHaveText(['Active', 'Inactive', 'On Hold', 'Discharged', 'Deceased']);

      // Select On Hold and click Update Status (no confirmation dialog)
      await page.getByRole('option', { name: 'On Hold' }).click();

      const patchPromise = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/clients/${clientId}/status`) &&
          res.request().method() === 'PATCH'
      );
      await page.getByRole('button', { name: 'Update Status' }).click();
      const patchRes = await patchPromise;
      expect(patchRes.status()).toBe(200);

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText('Client status updated to On Hold')).toBeVisible();

      // Reload and verify persistence
      await page.reload();
      await expect(page.locator('#client-status-select')).toContainText('On Hold');
    });

    test('supports Discharged optional reason, confirmation dialog, portal-revoked toast, and Deceased confirmation', async ({
      page,
      request,
    }) => {
      const clientId = await seedClient(request, 'ACTIVE', `B${Date.now().toString().slice(-5)}`);

      await page.goto(`/clients/${clientId}/edit`);
      await expect(page.getByTestId('client-status-section')).toBeVisible();

      // Select Discharged -> reason field appears
      await page.locator('#client-status-select').click();
      await page.getByRole('option', { name: 'Discharged' }).click();
      await expect(page.locator('#discharge-reason')).toBeVisible();
      await page.locator('#discharge-reason').fill('Completed care plan');

      // Click Update Status -> confirmation dialog opens; Cancel does not fire PATCH
      let patchCount = 0;
      page.on('request', (req) => {
        if (req.url().includes(`/api/clients/${clientId}/status`) && req.method() === 'PATCH') {
          patchCount += 1;
        }
      });

      await page.getByRole('button', { name: 'Update Status' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(/revoke all client and family portal access/i);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      expect(patchCount).toBe(0);

      // Confirm Discharged
      await page.getByRole('button', { name: 'Update Status' }).click();
      const dischargePatchPromise = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/clients/${clientId}/status`) &&
          res.request().method() === 'PATCH'
      );
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
      const dischargePatchRes = await dischargePatchPromise;
      expect(dischargePatchRes.status()).toBe(200);
      expect(dischargePatchRes.request().postDataJSON()).toEqual({
        status: 'DISCHARGED',
        reason: 'Completed care plan',
      });
      await expect(page.getByText(/Portal access has been revoked/i)).toBeVisible();

      const getAfterDischarge = await request.get(`/api/clients/${clientId}`, {
        headers: getAuthHeaders('orgAdmin'),
      });
      expect(getAfterDischarge.ok()).toBeTruthy();
      const dischargedClient = ((await getAfterDischarge.json()) as { data?: { status?: string; notes?: string } }).data;
      expect(dischargedClient?.status).toBe('DISCHARGED');
      expect(dischargedClient?.notes).toContain('Discharged: Completed care plan');

      // Switch to Deceased -> reason field hidden, confirmation required
      await page.locator('#client-status-select').click();
      await page.getByRole('option', { name: 'Deceased' }).click();
      await expect(page.locator('#discharge-reason')).toHaveCount(0);

      await page.getByRole('button', { name: 'Update Status' }).click();
      const deceasedPatchPromise = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/clients/${clientId}/status`) &&
          res.request().method() === 'PATCH'
      );
      await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
      const deceasedPatchRes = await deceasedPatchPromise;
      expect(deceasedPatchRes.status()).toBe(200);
      await expect(page.getByText(/Client status updated to Deceased\. Portal access has been revoked\./i)).toBeVisible();

      const getAfterDeceased = await request.get(`/api/clients/${clientId}`, {
        headers: getAuthHeaders('orgAdmin'),
      });
      expect(getAfterDeceased.ok()).toBeTruthy();
      const deceasedClient = ((await getAfterDeceased.json()) as { data?: { status?: string } }).data;
      expect(deceasedClient?.status).toBe('DECEASED');
    });
  });

  test.describe('Coordinator exclusion', () => {
    test.use({ storageState: STORAGE_STATE_PATHS.coordinator });

    test('hides status section in Edit Client UI and returns 403 on direct PATCH /api/clients/:id/status', async ({
      page,
      request,
    }) => {
      const clientId = await seedClient(request, 'ACTIVE', `C${Date.now().toString().slice(-5)}`);

      await page.goto(`/clients/${clientId}/edit`);
      await expect(page.locator('#first-name')).toBeVisible();
      await expect(page.getByTestId('client-status-section')).toHaveCount(0);
      await expect(page.locator('#client-status-select')).toHaveCount(0);

      const directPatch = await page.request.patch(`/api/clients/${clientId}/status`, {
        headers: getAuthHeaders('coordinator'),
        data: { status: 'INACTIVE' },
      });
      expect(directPatch.status()).toBe(403);
    });
  });
});
