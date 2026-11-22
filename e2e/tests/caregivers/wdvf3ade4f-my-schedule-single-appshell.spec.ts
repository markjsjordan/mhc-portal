import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] || 'admin@folkcare.example';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] || 'Admin123!';

test.describe('Caregiver My Schedule single AppShell (wdvf3ade4f)', () => {
  test('renders exactly one AppShell content container and one header on /caregiver/schedule', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Add CAREGIVER role to persisted auth state to access /caregiver/schedule with valid backend JWT
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('auth-storage');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.state?.user) {
        const roles: string[] = Array.isArray(parsed.state.user.roles)
          ? parsed.state.user.roles
          : [];
        if (!roles.includes('CAREGIVER')) {
          parsed.state.user.roles = [...roles, 'CAREGIVER'];
        }
        window.localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    });

    await page.goto('/caregiver/schedule');

    await expect(page.getByRole('heading', { name: 'Weekly Schedule' })).toBeVisible();
    await expect(page.getByTestId('app-shell-content')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
  });

  test('caregiver user login sees single header on /caregiver/schedule', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
