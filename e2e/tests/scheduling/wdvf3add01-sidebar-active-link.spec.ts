import { test, expect } from '@playwright/test';

test.describe('Sidebar active link highlighting (wdvf3add01)', () => {
  test('only Calendar link is active on /scheduling/calendar', async ({ page }) => {
    await page.goto('/scheduling/calendar');
    await page.waitForLoadState('networkidle');

    const calendarLink = page.locator('aside nav a[href="/scheduling/calendar"]');
    const visitsLink = page.locator('aside nav a[href="/scheduling"]');
    const dashboardLink = page.locator('aside nav a[href="/"]');

    await expect(calendarLink).toBeVisible();
    await expect(calendarLink).toHaveClass(/bg-primary-50/);
    await expect(visitsLink).not.toHaveClass(/bg-primary-50/);
    await expect(dashboardLink).not.toHaveClass(/bg-primary-50/);
  });

  test('only Visits link is active on /scheduling', async ({ page }) => {
    await page.goto('/scheduling');
    await page.waitForLoadState('networkidle');

    const visitsLink = page.locator('aside nav a[href="/scheduling"]');
    const dashboardLink = page.locator('aside nav a[href="/"]');

    await expect(visitsLink).toBeVisible();
    await expect(visitsLink).toHaveClass(/bg-primary-50/);
    await expect(dashboardLink).not.toHaveClass(/bg-primary-50/);
  });
});
