import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] || 'admin@folkcare.example';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] || 'Admin123!';

test.describe('Caregiver Dashboard live API data (wdvf3add14)', () => {
  test('does not render hardcoded mock visits, credentials, stats, or demo badges on /caregiver/dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Add CAREGIVER role to persisted auth state to access /caregiver/dashboard with valid backend JWT
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

    const visitsResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/visits/my-visits') && res.request().method() === 'GET'
    );
    const caregiverMeResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/caregivers/me') && res.request().method() === 'GET'
    );

    await page.goto('/caregiver/dashboard');

    await Promise.all([visitsResponsePromise, caregiverMeResponsePromise]);

    // Verify none of the removed hardcoded mock strings are present
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('John Smith');
    expect(bodyText).not.toContain('Mary Johnson');
    expect(bodyText).not.toContain('Robert Davis');
    expect(bodyText).not.toContain('123 Main St, Austin, TX 78701');
    expect(bodyText).not.toContain('CPR Certification');
    expect(bodyText).not.toContain('First Aid Certificate');
    expect(bodyText).not.toContain('32.5');

    // Verify live database state (empty for admin user without linked caregiver visits)
    await expect(page.getByText('No visits scheduled today')).toBeVisible();
    await expect(page.getByText('0 hours scheduled')).toBeVisible();
    await expect(page.getByText(/^Demo$/i)).toHaveCount(0);
  });

  test('caregiver user login displays live assigned visits and credentials from database', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
