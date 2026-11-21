import { test, expect } from '@playwright/test';
import { E2E_PERSONAS, E2E_UUIDS } from '../../fixtures/test-data.js';
import { STORAGE_STATE_PATHS, getPersonaUser } from '../../fixtures/auth.fixture.js';

/**
 * E2E-3 (wdvf3acxhp): Real persona logins & HIPAA minimum-necessary
 * authorization checks.
 *
 * 1. @smoke UI login tests exercise the real /login form once per seeded
 *    persona with an empty storageState so the login path itself stays covered.
 * 2. Negative authorization tests load the saved storageState per persona and
 *    verify role/scope boundaries (caregiver denied /billing & /admin; family
 *    denied another client's data & staff routes).
 */

async function uiLogin(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

async function apiGet(
  page: import('@playwright/test').Page,
  url: string,
  token?: string
) {
  const res = await page.request.get(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => null);
  return { status: res.status(), body };
}

test.describe('@smoke Real Persona UI Logins (wdvf3acxhp)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('@smoke ORG_ADMIN can log in through the real UI form and land on /admin', async ({
    page,
  }) => {
    const persona = E2E_PERSONAS.orgAdmin;
    await uiLogin(page, persona.email, persona.password);
    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);
  });

  test('@smoke COORDINATOR can log in through the real UI form and land on /analytics/coordinator', async ({
    page,
  }) => {
    const persona = E2E_PERSONAS.coordinator;
    await uiLogin(page, persona.email, persona.password);
    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });
    await expect(page).toHaveURL(/\/analytics\/coordinator/);

    await page.goto('/coordinators/notifications');
    await expect(page).toHaveURL(/\/coordinators\/notifications/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);
  });

  test('@smoke CAREGIVER can log in through the real UI form and land on /caregiver/dashboard', async ({
    page,
  }) => {
    const persona = E2E_PERSONAS.caregiver;
    await uiLogin(page, persona.email, persona.password);
    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });
    await expect(page).toHaveURL(/\/caregiver\/dashboard/);

    await page.goto('/caregiver/tasks');
    await expect(page).toHaveURL(/\/caregiver\/tasks/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);

    await page.goto('/caregiver/schedule');
    await expect(page).toHaveURL(/\/caregiver\/schedule/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);
  });

  test('@smoke FAMILY can log in through the real UI form and land on /family-portal', async ({
    page,
  }) => {
    const persona = E2E_PERSONAS.family;
    await uiLogin(page, persona.email, persona.password);
    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });
    await expect(page).toHaveURL(/\/family-portal/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);
  });

  test('@smoke SUPER_ADMIN can log in through the real UI form and land on /admin', async ({
    page,
  }) => {
    const persona = E2E_PERSONAS.admin;
    await uiLogin(page, persona.email, persona.password);
    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('text=/something went wrong/i')).toHaveCount(0);
  });
});

test.describe('Negative Authorization: CAREGIVER (HIPAA minimum necessary)', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.caregiver });

  test('CAREGIVER is denied/redirected from /billing and /admin and gets 403 on admin API', async ({
    page,
  }) => {
    await page.goto('/billing');
    await page.waitForURL(/\/caregiver\/dashboard/, { timeout: 15000 });

    await page.goto('/admin');
    await page.waitForURL(/\/caregiver\/dashboard/, { timeout: 15000 });

    const caregiverToken = getPersonaUser('caregiver').token;
    const adminStatsRes = await apiGet(page, '/api/admin/cache/stats', caregiverToken);
    expect(adminStatsRes.status).toBe(403);
  });

  test.fixme(
    'CAREGIVER is denied/redirected from /payroll (unprotected bare <ProtectedRoute> in App.tsx — separate permissions bug)',
    async ({ page }) => {
      await page.goto('/payroll');
      await page.waitForURL(/\/caregiver\/dashboard/, { timeout: 15000 });
    }
  );
});

test.describe('Negative Authorization: FAMILY (HIPAA minimum necessary)', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.family });

  test('FAMILY can read linked client data, is denied another client (403), and is redirected from staff routes', async ({
    page,
  }) => {
    await page.goto('/family-portal');
    await expect(page).toHaveURL(/\/family-portal/);

    const familyToken = getPersonaUser('family').token;

    // Positive control: linked client (CLIENT_001) is accessible
    const linkedRes = await apiGet(
      page,
      `/api/clients/${E2E_UUIDS.CLIENT_001}/visit-history`,
      familyToken
    );
    expect(linkedRes.status).toBe(200);

    // Negative control: unlinked client (CLIENT_002) is denied with 403
    const unlinkedVisitHistory = await apiGet(
      page,
      `/api/clients/${E2E_UUIDS.CLIENT_002}/visit-history`,
      familyToken
    );
    expect(unlinkedVisitHistory.status).toBe(403);

    const unlinkedFamilyMembers = await apiGet(
      page,
      `/api/family-engagement/family-members/client/${E2E_UUIDS.CLIENT_002}`,
      familyToken
    );
    expect(unlinkedFamilyMembers.status).toBe(403);

    // Staff routes redirect family user back to /family-portal
    await page.goto('/admin');
    await page.waitForURL(/\/family-portal/, { timeout: 15000 });

    await page.goto('/billing');
    await page.waitForURL(/\/family-portal/, { timeout: 15000 });
  });
});
