import { test, expect } from '@playwright/test';

test.describe('Super-Admin access to Dashboard and My Schedule (wdvf3ade4g)', () => {
  test('SUPER_ADMIN can reach /dashboard from sidebar and /caregiver/schedule without redirect', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@folkcare.example');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)?$/, {
      timeout: 15000,
    });

    const sidebarNav = page.locator('aside nav').first();
    await expect(sidebarNav).toBeVisible();

    const dashboardLink = sidebarNav.getByRole('link', { name: 'Dashboard', exact: true });
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('#dashboard')).toBeVisible({ timeout: 15000 });

    await page.goto('/caregiver/schedule');
    await expect(page).toHaveURL(/\/caregiver\/schedule$/);
    await expect(page.getByRole('heading', { name: /weekly schedule/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('CAREGIVER still accesses /caregiver/schedule and /caregiver/dashboard without regression', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
