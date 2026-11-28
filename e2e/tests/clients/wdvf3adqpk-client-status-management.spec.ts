import { test, expect } from '../../fixtures/auth.fixture';
import { E2E_UUIDS } from '../../fixtures/test-data';
import type { APIRequestContext } from '@playwright/test';

async function createIsolatedClient(
  request: APIRequestContext,
  token: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; status: string }> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const res = await request.post('/api/clients', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      organizationId: E2E_UUIDS.ORG_E2E,
      branchId: E2E_UUIDS.BRANCH_E2E,
      firstName: `StatusTest`,
      lastName: `Client${suffix}`,
      dateOfBirth: '1955-06-15',
      primaryPhone: {
        number: '512-555-0199',
        type: 'MOBILE',
        canReceiveSMS: true,
      },
      primaryAddress: {
        type: 'HOME',
        line1: '100 Status Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'US',
      },
      emergencyContacts: [
        {
          id: 'ec-1',
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: {
            number: '512-555-0188',
            type: 'MOBILE',
            canReceiveSMS: false,
          },
          isPrimary: true,
          canMakeHealthcareDecisions: true,
        },
      ],
      status: 'ACTIVE',
      ...overrides,
    },
  });
  expect(res.ok(), `POST /api/clients failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { data?: { id: string; status: string }; id?: string; status?: string };
  const client = body.data ?? (body as { id: string; status: string });
  expect(client.id).toBeTruthy();
  return client;
}

test.describe('Release 1.6.0 — Client Status Management (wdvf3adqpk)', () => {
  test('Admin sees read-only PENDING_INTAKE badge, exact 5 selectable statuses, and transitions persist across reload', async ({
    adminPage,
    adminUser,
    request,
  }) => {
    const client = await createIsolatedClient(request, adminUser.token!, {
      status: 'PENDING_INTAKE',
    });

    await adminPage.goto(`/clients/${client.id}/edit`);
    const statusCard = adminPage.getByTestId('client-status-card');
    await expect(statusCard).toBeVisible();
    await expect(statusCard.getByTestId('current-client-status')).toContainText('Pending Intake');
    await expect(statusCard.getByTestId('pending-intake-note')).toBeVisible();

    // Open dropdown and verify exact 5 options
    await statusCard.getByRole('combobox', { name: 'Client status' }).click();
    const options = adminPage.getByRole('option');
    await expect(options).toHaveText(['Active', 'Inactive', 'On Hold', 'Discharged', 'Deceased']);

    // Transition PENDING_INTAKE -> Active -> Inactive -> On Hold
    const transitions: Array<{ label: string; expectedStatus: string }> = [
      { label: 'Active', expectedStatus: 'ACTIVE' },
      { label: 'Inactive', expectedStatus: 'INACTIVE' },
      { label: 'On Hold', expectedStatus: 'ON_HOLD' },
    ];

    for (let i = 0; i < transitions.length; i++) {
      const { label, expectedStatus } = transitions[i]!;
      if (i > 0) {
        await statusCard.getByRole('combobox', { name: 'Client status' }).click();
      }
      await adminPage.getByRole('option', { name: label, exact: true }).click();
      await statusCard.getByRole('button', { name: 'Update Status' }).click();

      await expect(
        adminPage.getByText(`Client status updated to ${label}.`).first()
      ).toBeVisible();

      await adminPage.reload();
      await expect(
        adminPage.getByTestId('client-status-card').getByTestId('current-client-status')
      ).toContainText(label);

      const getRes = await request.get(`/api/clients/${client.id}`, {
        headers: { Authorization: `Bearer ${adminUser.token!}` },
      });
      expect(getRes.ok()).toBeTruthy();
      const fetched = (await getRes.json()) as { data?: { status: string }; status?: string };
      expect((fetched.data ?? fetched).status).toBe(expectedStatus);
    }
  });

  test('Discharged (with reason) and Deceased require confirmation, revoke portal access, and are reversible', async ({
    adminPage,
    adminUser,
    request,
  }) => {
    const client = await createIsolatedClient(request, adminUser.token!, {
      status: 'ACTIVE',
    });

    // Create an invited family member so we can verify portal revocation
    const fmEmail = `family-${Date.now()}@example.com`;
    const fmRes = await request.post(`/api/clients/${client.id}/family-members`, {
      headers: {
        Authorization: `Bearer ${adminUser.token!}`,
        'Content-Type': 'application/json',
      },
      data: {
        firstName: 'Portal',
        lastName: 'Family',
        relationship: 'CHILD',
        email: fmEmail,
        portalAccessLevel: 'FULL_ACCESS',
        confirmElevatedAccess: true,
        inviteNow: true,
        consent: {
          consentGiven: true,
          authorizedBy: 'CLIENT',
          authorizerName: 'StatusTest Client',
        },
      },
    });
    expect(fmRes.ok(), `POST family-members failed: ${fmRes.status()} ${await fmRes.text()}`).toBeTruthy();

    await adminPage.goto(`/clients/${client.id}/edit`);
    const statusCard = adminPage.getByTestId('client-status-card');
    await expect(statusCard).toBeVisible();

    // Select Discharged + enter optional reason
    await statusCard.getByRole('combobox', { name: 'Client status' }).click();
    await adminPage.getByRole('option', { name: 'Discharged', exact: true }).click();
    await statusCard.getByLabel('Reason for Discharge (Optional)').fill('Completed care goals');
    await statusCard.getByRole('button', { name: 'Update Status' }).click();

    // Confirmation dialog warns about portal revocation; Cancel leaves status unchanged
    const dialog = adminPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('revoke all client and family member portal access');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(statusCard.getByTestId('current-client-status')).toContainText('Active');

    // Confirm Discharged
    await statusCard.getByRole('button', { name: 'Update Status' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm Discharged' }).click();

    await expect(
      adminPage
        .getByText('Client status updated to Discharged. Client and family portal access has been revoked.')
        .first()
    ).toBeVisible();

    await adminPage.reload();
    await expect(
      adminPage.getByTestId('client-status-card').getByTestId('current-client-status')
    ).toContainText('Discharged');

    // Verify family portal access is REVOKED
    const accessRes = await request.get(`/api/clients/${client.id}/family-portal-access`, {
      headers: { Authorization: `Bearer ${adminUser.token!}` },
    });
    expect(accessRes.ok()).toBeTruthy();
    const accessBody = (await accessRes.json()) as {
      data?: Array<{ email: string; status: string }>;
    };
    const fmRow = (accessBody.data ?? []).find((r) => r.email === fmEmail);
    expect(fmRow?.status).toBe('REVOKED');

    // Transition to Deceased via confirmation dialog
    const reloadedCard = adminPage.getByTestId('client-status-card');
    await reloadedCard.getByRole('combobox', { name: 'Client status' }).click();
    await adminPage.getByRole('option', { name: 'Deceased', exact: true }).click();
    await reloadedCard.getByRole('button', { name: 'Update Status' }).click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await adminPage.getByRole('dialog').getByRole('button', { name: 'Confirm Deceased' }).click();
    await expect(
      adminPage
        .getByText('Client status updated to Deceased. Client and family portal access has been revoked.')
        .first()
    ).toBeVisible();

    await adminPage.reload();
    await expect(
      adminPage.getByTestId('client-status-card').getByTestId('current-client-status')
    ).toContainText('Deceased');

    // Reversibility: transition back to Active
    const deceasedCard = adminPage.getByTestId('client-status-card');
    await deceasedCard.getByRole('combobox', { name: 'Client status' }).click();
    await adminPage.getByRole('option', { name: 'Active', exact: true }).click();
    await deceasedCard.getByRole('button', { name: 'Update Status' }).click();
    await expect(adminPage.getByText('Client status updated to Active.').first()).toBeVisible();

    await adminPage.reload();
    await expect(
      adminPage.getByTestId('client-status-card').getByTestId('current-client-status')
    ).toContainText('Active');
  });

  test('Coordinator cannot see status card, receives 403 on PATCH /status, and PENDING_INTAKE auto-promotes on intake submit', async ({
    coordinatorPage,
    coordinatorUser,
    adminUser,
    request,
  }) => {
    const client = await createIsolatedClient(request, adminUser.token!, {
      status: 'PENDING_INTAKE',
    });

    // 1. Coordinator can open Edit Client, sees demographics form, does NOT see status card
    await coordinatorPage.goto(`/clients/${client.id}/edit`);
    await expect(
      coordinatorPage.getByRole('heading', { name: 'Demographics & Contact Information' })
    ).toBeVisible();
    await expect(coordinatorPage.getByTestId('client-status-card')).toHaveCount(0);

    // 2. Coordinator calling PATCH /api/clients/:id/status gets 403
    const patchRes = await request.patch(`/api/clients/${client.id}/status`, {
      headers: {
        Authorization: `Bearer ${coordinatorUser.token!}`,
        'Content-Type': 'application/json',
      },
      data: { status: 'INACTIVE' },
    });
    expect(patchRes.status()).toBe(403);

    // 3. Coordinator submitting intake form auto-promotes PENDING_INTAKE -> ACTIVE
    for (let step = 0; step < 4; step++) {
      await coordinatorPage.getByRole('button', { name: /Next →/i }).click();
    }
    await coordinatorPage.getByRole('button', { name: /Complete|Submit|Save Changes|Update Client/i }).first().click();

    await coordinatorPage.waitForURL((url) => url.pathname === `/clients/${client.id}`, {
      timeout: 15000,
    });

    const getRes = await request.get(`/api/clients/${client.id}`, {
      headers: { Authorization: `Bearer ${adminUser.token!}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const fetched = (await getRes.json()) as { data?: { status: string }; status?: string };
    expect((fetched.data ?? fetched).status).toBe('ACTIVE');
  });
});
