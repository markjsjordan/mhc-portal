import { test, expect } from '@playwright/test';

const RETAINED_SERVICE_TYPES = [
  'Skilled Nursing',
  'Home Health Aide',
  'Personal Care / Companionship',
];

const REMOVED_SERVICE_TYPES = [
  'Physical Therapy',
  'Occupational Therapy',
  'Speech Therapy',
];

test.describe('wdvf3adf4g: Restrict Visit Service Types (SN, HHA, Personal Care)', () => {
  test('Create Visit modal displays exactly the 3 restricted service types and excludes therapy types', async ({ page }) => {
    // Log in as seeded E2E admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@folkcare.example');
    await page.getByLabel(/password/i).fill('Admin123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Navigate to Scheduling Calendar where CreateVisitModal (VisitForm) is triggered
    await page.goto('/scheduling/calendar');
    const createVisitBtn = page.getByTestId('calendar-create-visit-btn');
    await expect(createVisitBtn).toBeVisible({ timeout: 15000 });
    await createVisitBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Open the Service Type dropdown
    const serviceTypeTrigger = dialog.locator('#visit-service-type');
    await expect(serviceTypeTrigger).toBeVisible({ timeout: 10000 });
    await serviceTypeTrigger.click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(3);

    for (const label of RETAINED_SERVICE_TYPES) {
      await expect(listbox.getByRole('option', { name: label, exact: true })).toBeVisible();
    }

    for (const removed of REMOVED_SERVICE_TYPES) {
      await expect(listbox.getByRole('option', { name: removed, exact: true })).toHaveCount(0);
    }
  });
});
