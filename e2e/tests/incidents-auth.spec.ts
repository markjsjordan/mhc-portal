import { test, expect } from '../fixtures/auth.fixture.js';

test.describe('Incidents Authorization & Verification', () => {
  test('incidents list loads for authenticated coordinator', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/incidents');
    await expect(
      authenticatedPage.locator('[data-testid="incidents-error"], [data-testid="session-expired-error"]')
    ).toHaveCount(0);
    const emptyState = authenticatedPage.getByText('No incidents have been reported');
    const incidentCards = authenticatedPage.locator('a[href^="/incidents/"]');
    await expect(emptyState.or(incidentCards.first())).toBeVisible();
  });

  test('expired session shows distinct message, not generic banner', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: {}, token: 'deliberately-invalid-token', isAuthenticated: true },
          version: 0,
        })
      );
    });
    await page.goto('/incidents');
    await expect(page.locator('[data-testid="session-expired-error"]')).toBeVisible();
    await expect(page.getByText('Failed to load incidents. Please try again.')).toHaveCount(0);
  });
});
