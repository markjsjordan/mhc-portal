import { test, expect } from '@playwright/test';

test.describe('Schedule Builder Sidebar Navigation (wdvf3add0e)', () => {
  test('admin sees Schedule Builder link in sidebar and can navigate directly to /scheduling/builder', async ({
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

    const visitsLink = sidebarNav.getByRole('link', { name: 'Visits', exact: true });
    const calendarLink = sidebarNav.getByRole('link', { name: 'Calendar', exact: true });
    const scheduleBuilderLink = sidebarNav.getByRole('link', {
      name: 'Schedule Builder',
      exact: true,
    });

    await expect(visitsLink).toBeVisible();
    await expect(calendarLink).toBeVisible();
    await expect(scheduleBuilderLink).toBeVisible();
    await expect(scheduleBuilderLink).toHaveAttribute('href', '/scheduling/builder');

    await scheduleBuilderLink.click();
    await expect(page).toHaveURL(/\/scheduling\/builder$/);
    await expect(
      page.getByRole('heading', { name: 'Schedule Builder' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('coordinator sees Schedule Builder link while caregiver without visits:read does not', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
