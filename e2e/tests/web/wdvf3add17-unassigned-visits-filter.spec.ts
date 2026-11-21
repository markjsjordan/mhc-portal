import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@folkcare.example');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
    timeout: 15000,
  });
}

test.describe('Scheduler Unassigned Visits View/Filter (wdvf3add17)', () => {
  test('Visits List (/scheduling) toggles unassigned filter and syncs ?filter=unassigned', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/scheduling');

    const toggle = page.getByTestId('unassigned-visits-filter-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Toggle unassigned filter on
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/filter=unassigned/);

    // Every visible visit card (if any) must show Unassigned caregiver status
    const cards = page.getByTestId('visit-card');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      await expect(cards.nth(i).getByTestId('visit-caregiver-status')).toHaveText('Unassigned');
    }

    // Toggle off resets URL and aria-pressed
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page).not.toHaveURL(/filter=unassigned/);

    // Direct URL deep-link pre-activates the unassigned filter
    await page.goto('/scheduling?filter=unassigned');
    await expect(page.getByTestId('unassigned-visits-filter-toggle')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('Scheduling Calendar (/scheduling/calendar) toggles unassigned KPI filter', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/scheduling/calendar');

    const kpiUnassigned = page.getByTestId('kpi-unassigned');
    await expect(kpiUnassigned).toBeVisible({ timeout: 15000 });
    await kpiUnassigned.click();
    // Clicking again clears the filter without errors
    await kpiUnassigned.click();
  });

  test('Schedule Builder (/scheduling/builder) toggles Day/Week unassigned scope', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/scheduling/builder');

    const scopeToggle = page.getByTestId('unassigned-scope-toggle');
    await expect(scopeToggle).toBeVisible({ timeout: 15000 });

    const dayBtn = scopeToggle.getByRole('button', { name: /^Day \(/i });
    const weekBtn = scopeToggle.getByRole('button', { name: /^Week \(/i });
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(weekBtn).toHaveAttribute('aria-pressed', 'false');

    await weekBtn.click();
    await expect(weekBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(dayBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('Coordinator persona can filter unassigned visits on /scheduling and /scheduling/calendar', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
