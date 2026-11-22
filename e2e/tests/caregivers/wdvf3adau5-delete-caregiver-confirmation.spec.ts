import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { getAuthedHeaders } from '../../fixtures/factories.js';
import { E2E_UUIDS } from '../../fixtures/test-data.js';

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] || 'admin@folkcare.example';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] || 'Admin123!';

test.describe('DeleteCaregiverConfirmation regression (wdvf3adau5)', () => {
  test('deletes a caregiver via useApiClient without throwing axiosInstance not initialized', async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Create an isolated caregiver via the live API using the seeded admin token
    const suffix = randomUUID().slice(0, 8);
    const firstName = 'DeleteTest';
    const lastName = `Caregiver${suffix}`;
    const fullName = `${firstName} ${lastName}`;

    const createRes = await request.post('/api/caregivers', {
      headers: getAuthedHeaders('admin'),
      data: {
        organizationId: E2E_UUIDS.ORG_E2E,
        branchIds: [E2E_UUIDS.BRANCH_E2E],
        primaryBranchId: E2E_UUIDS.BRANCH_E2E,
        firstName,
        lastName,
        dateOfBirth: '1990-05-20',
        email: `delete-e2e-${suffix}@example.invalid`,
        primaryPhone: {
          number: '5125550142',
          type: 'MOBILE',
          canReceiveSMS: true,
          isPrimary: true,
        },
        primaryAddress: {
          type: 'HOME',
          line1: '100 E2E Delete Ln',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US',
        },
        emergencyContacts: [
          {
            id: randomUUID(),
            name: 'Emergency Contact',
            relationship: 'Spouse',
            phone: {
              number: '5125550199',
              type: 'MOBILE',
              canReceiveSMS: true,
            },
            isPrimary: true,
          },
        ],
        employmentType: 'FULL_TIME',
        hireDate: '2024-01-15',
        role: 'CAREGIVER',
        payRate: {
          id: randomUUID(),
          rateType: 'BASE',
          amount: 25,
          unit: 'HOURLY',
          effectiveDate: '2024-01-15',
        },
        status: 'ACTIVE',
      },
    });

    const createBodyText = await createRes.text();
    expect(
      createRes.status(),
      `POST /api/caregivers failed with HTTP ${createRes.status()}: ${createBodyText}`
    ).toBe(201);

    const createBody = JSON.parse(createBodyText) as { data?: { id?: string }; id?: string };
    const caregiverId = createBody.data?.id ?? createBody.id;
    expect(caregiverId, `Missing caregiver id in response: ${createBodyText}`).toBeTruthy();

    // 2. Log in as seeded admin in the browser
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // 3. Open the caregiver detail page and trigger DeleteCaregiverConfirmation
    await page.goto(`/caregivers/${caregiverId}`);
    await expect(page.getByRole('heading', { name: fullName })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Delete caregiver' }).click();
    await expect(page.getByRole('heading', { name: /delete caregiver\?/i })).toBeVisible();

    // 4. Complete the two-step confirmation
    await page.getByPlaceholder(fullName).fill(fullName);
    await page.getByRole('checkbox').click();

    const confirmDeleteButton = page.getByRole('button', { name: 'Delete Caregiver', exact: true });
    await expect(confirmDeleteButton).toBeEnabled();

    // 5. Submit delete and verify real DELETE request succeeds without axiosInstance crash
    const deleteResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/caregivers/${caregiverId}`) &&
        res.request().method() === 'DELETE'
    );

    await confirmDeleteButton.click();

    const deleteRes = await deleteResponsePromise;
    expect(
      [200, 204],
      `DELETE /api/caregivers/${caregiverId} returned HTTP ${deleteRes.status()}`
    ).toContain(deleteRes.status());

    await expect(page.getByText('Caregiver deleted successfully')).toBeVisible({ timeout: 10000 });
    await page.waitForURL((url) => url.pathname === '/caregivers', { timeout: 15000 });

    expect(
      pageErrors.filter((m) => m.includes('axiosInstance not initialized')),
      `Unexpected axiosInstance error: ${pageErrors.join('; ')}`
    ).toHaveLength(0);
  });
});
