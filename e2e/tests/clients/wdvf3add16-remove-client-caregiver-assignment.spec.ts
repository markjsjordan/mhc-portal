import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@folkcare.example');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
    timeout: 15000,
  });
}

async function fillStep1RequiredFields(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.fill('#first-name', firstName);
  await page.fill('#last-name', lastName);
  await page.fill('#date-of-birth', '1955-06-15');
  await page.fill('#address-line1', '123 Main St');
  await page.fill('#address-city', 'Austin');
  await page.click('#address-state');
  await page.getByRole('option', { name: 'Texas (TX)' }).click();
  await page.fill('#address-postal', '78701');
}

async function assertSixStepWizardWithoutCaregivers(page: Page): Promise<void> {
  await expect(page.getByText('Step 1 of 6').last()).toBeVisible();
  await expect(page.getByText('Step 1 of 7')).toHaveCount(0);
  await expect(page.getByText('Assignment & Matching')).toHaveCount(0);

  // Step 1 -> Step 2 (Care Assessment)
  await page.getByRole('button', { name: /Next →/i }).click();
  await expect(page.getByRole('heading', { name: 'Care Assessment' })).toBeVisible();

  // Step 2 -> Step 3 (Care Plan Creation)
  await page.getByRole('button', { name: /Next →/i }).click();
  await expect(page.getByRole('heading', { name: 'Care Plan Creation' })).toBeVisible();

  // Step 3 -> Step 4 (Initial Schedule, NOT Caregiver Assignment)
  await page.getByRole('button', { name: /Next →/i }).click();
  await expect(page.getByRole('heading', { name: 'Initial Schedule' })).toBeVisible();
  await expect(page.getByText('Caregiver Assignment')).toHaveCount(0);
  await expect(page.getByText('Primary Caregiver')).toHaveCount(0);
  await expect(page.getByText('Backup Caregivers')).toHaveCount(0);

  // Step 4 -> Step 5 (Consent & Signatures)
  await page.getByRole('button', { name: /Next →/i }).click();
  await expect(page.getByRole('heading', { name: 'Consent & Signatures' })).toBeVisible();

  // Step 5 -> Step 6 (Review & Submit)
  await page.getByRole('button', { name: /Next →/i }).click();
  await expect(page.getByRole('heading', { name: 'Review & Submit' })).toBeVisible();
  await expect(page.getByText('Assigned Caregivers')).toHaveCount(0);
}

test.describe('Remove Caregiver Assignment from Client Create and Edit Flows (wdvf3add16)', () => {
  test('new client intake wizard has 6 steps and no caregiver assignment step', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/clients/new/intake');
    await expect(page.getByRole('heading', { name: 'Demographics & Contact Information' })).toBeVisible();

    await fillStep1RequiredFields(page, 'E2ECreate', 'NoCaregiver');
    await assertSixStepWizardWithoutCaregivers(page);
  });

  test('client edit form has 6 steps and no caregiver assignment step', async ({ page }) => {
    await loginAsAdmin(page);

    const clientId = '11111111-1111-4111-8111-111111111111';
    await page.route(`**/api/clients/${clientId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: clientId,
            organizationId: '00000000-0000-4000-8000-000000000001',
            branchId: '00000000-0000-4000-8000-000000000002',
            clientNumber: 'CL-E2E-001',
            firstName: 'E2EEdit',
            lastName: 'NoCaregiver',
            dateOfBirth: '1955-06-15',
            primaryAddress: {
              type: 'HOME',
              line1: '123 Main St',
              city: 'Austin',
              state: 'TX',
              postalCode: '78701',
              country: 'US',
            },
            emergencyContacts: [],
            status: 'ACTIVE',
            createdAt: '2026-11-01T12:00:00.000Z',
            updatedAt: '2026-11-01T12:00:00.000Z',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/clients/${clientId}/edit`);
    await expect(page.getByRole('heading', { name: 'Demographics & Contact Information' })).toBeVisible();
    await assertSixStepWizardWithoutCaregivers(page);
  });
});
