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

test.describe('Remove Initial Schedule from New Client Intake (wdvf3add1a)', () => {
  test('new client intake wizard has 5 steps, omits Initial Schedule step, and excludes visitSchedule from POST payload', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const capturedPosts: Array<Record<string, unknown>> = [];
    await page.route('**/api/clients**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        capturedPosts.push(body);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'e2e-no-schedule-client-1',
              ...body,
              status: 'ACTIVE',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/clients/new/intake');
    await expect(page.getByRole('heading', { name: 'Demographics & Contact Information' })).toBeVisible();

    // 5-step wizard: Step 1 of 5 (not 6), no Schedule / Initial Visits step
    await expect(page.getByText('Step 1 of 5').last()).toBeVisible();
    await expect(page.getByText('Step 1 of 6')).toHaveCount(0);
    await expect(page.getByText('Initial Visits')).toHaveCount(0);

    await fillStep1RequiredFields(page, 'E2ENoSchedule', 'Client');

    // Step 1 -> Step 2 (Care Assessment)
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: 'Care Assessment' })).toBeVisible();

    // Step 2 -> Step 3 (Care Plan Creation)
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: 'Care Plan Creation' })).toBeVisible();

    // Step 3 -> Step 4 (Consent & Signatures, NOT Initial Schedule)
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: 'Consent & Signatures' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Initial Schedule' })).toHaveCount(0);
    await expect(page.locator('#schedule-start-date')).toHaveCount(0);

    // Step 4 -> Step 5 (Review & Submit)
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: 'Review & Submit' })).toBeVisible();

    // Submit and verify POST payload has no visitSchedule or scheduleStartDate
    await page.getByRole('button', { name: /Submit & Create Client/i }).click();
    await expect.poll(() => capturedPosts.length).toBe(1);
    expect(capturedPosts[0]?.['visitSchedule']).toBeUndefined();
    expect(capturedPosts[0]?.['scheduleStartDate']).toBeUndefined();
  });
});
