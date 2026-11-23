import { test, expect } from '@playwright/test';

test.describe('Coordinator Dashboard removes hardcoded Caregiver Status mock card (wdvf3adf4j)', () => {
  test('renders real-data dashboard sections without Caregiver Status card', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@folkcare.example');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)?$/, {
      timeout: 15000,
    });

    await page.goto('/analytics/coordinator');
    await expect(page).toHaveURL(/\/analytics\/coordinator$/);
    await expect(
      page.getByRole('heading', { name: 'Coordinator Dashboard' })
    ).toBeVisible({ timeout: 15000 });

    // Real-data sections remain visible after loading
    await expect(page.getByText('Active Clients', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Client Alerts', { exact: true })).toBeVisible();

    // Hardcoded Caregiver Status (Mock Data) card must not be rendered
    await expect(page.getByText('Caregiver Status')).toHaveCount(0);
    await expect(page.getByText('Current availability')).toHaveCount(0);
    await expect(page.getByText('Sick/PTO')).toHaveCount(0);
  });
});
