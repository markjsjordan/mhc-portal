import { test, expect } from '@playwright/test';

/**
 * wdvf3adqju: global sonner <Toaster> must render at bottom-right.
 * Triggers the login error toast with bad credentials (no seed users needed).
 */
test.describe('Toast position (wdvf3adqju)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login error toast renders at bottom-right', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('nobody@invalid.example');
    await page.locator('input[type="password"]').fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    const toaster = page.locator('[data-sonner-toaster]');
    await expect(toaster).toHaveAttribute('data-y-position', 'bottom');
    await expect(toaster).toHaveAttribute('data-x-position', 'right');
  });
});
