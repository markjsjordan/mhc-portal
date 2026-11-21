import fs from 'fs';
import path from 'path';
import { test as base, Page } from '@playwright/test';
import { E2E_PERSONAS, E2EPersonaKey, E2E_UUIDS } from './test-data.js';

/**
 * Paths to Playwright storageState files produced by e2e/setup/auth.setup.ts
 * via real UI logins against the seeded E2E database.
 */
export const STORAGE_STATE_PATHS: Record<E2EPersonaKey, string> = {
  admin: E2E_PERSONAS.admin.storageStatePath,
  orgAdmin: E2E_PERSONAS.orgAdmin.storageStatePath,
  coordinator: E2E_PERSONAS.coordinator.storageStatePath,
  caregiver: E2E_PERSONAS.caregiver.storageStatePath,
  family: E2E_PERSONAS.family.storageStatePath,
};

/**
 * Authenticated User Type
 */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  organizationId: string;
  branchId: string;
  roles: string[];
  permissions: string[];
  token?: string;
};

interface SavedStorageState {
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins?: Array<{
    origin: string;
    localStorage?: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Read a saved storageState JSON file for a persona.
 */
export function readPersonaStorageState(personaKey: E2EPersonaKey): SavedStorageState {
  const filePath = path.resolve(process.cwd(), STORAGE_STATE_PATHS[personaKey]);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing storageState file for persona "${personaKey}" at ${filePath}. ` +
        `Ensure the Playwright "setup" project (e2e/setup/auth.setup.ts) ran first.`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SavedStorageState;
}

/**
 * Extract the real AuthenticatedUser (including server-issued JWT accessToken,
 * roles, and permissions) from the persona's saved storageState.
 */
export function getPersonaUser(personaKey: E2EPersonaKey): AuthenticatedUser {
  const persona = E2E_PERSONAS[personaKey];
  const state = readPersonaStorageState(personaKey);

  let storedUser: {
    id?: string;
    email?: string;
    organizationId?: string;
    roles?: string[];
    permissions?: string[];
  } | null = null;
  let storedToken: string | undefined;

  for (const origin of state.origins ?? []) {
    const authEntry = origin.localStorage?.find((item) => item.name === 'auth-storage');
    if (authEntry) {
      try {
        const parsed = JSON.parse(authEntry.value);
        storedUser = parsed?.state?.user ?? null;
        storedToken = parsed?.state?.token ?? undefined;
        break;
      } catch {
        // Ignore malformed entries
      }
    }
  }

  return {
    userId: storedUser?.id ?? persona.userId,
    email: storedUser?.email ?? persona.email,
    organizationId: storedUser?.organizationId ?? persona.organizationId,
    branchId: persona.branchId,
    roles: storedUser?.roles ?? persona.roles,
    permissions: storedUser?.permissions ?? [],
    token: storedToken,
  };
}

/**
 * Apply a persona's real storageState (cookies + localStorage) to an existing Page.
 */
export async function applyPersonaStorageState(
  page: Page,
  personaKey: E2EPersonaKey
): Promise<Page> {
  const state = readPersonaStorageState(personaKey);

  if (state.cookies && state.cookies.length > 0) {
    await page.context().addCookies(state.cookies);
  }

  const authEntry = state.origins
    ?.flatMap((o) => o.localStorage ?? [])
    .find((item) => item.name === 'auth-storage');

  await page.goto('/');
  if (authEntry) {
    await page.evaluate((rawAuth) => {
      localStorage.setItem('auth-storage', rawAuth);
    }, authEntry.value);
    await page.reload();
  }

  return page;
}

function resolvePersonaKey(user: AuthenticatedUser): E2EPersonaKey | null {
  for (const key of Object.keys(E2E_PERSONAS) as E2EPersonaKey[]) {
    const p = E2E_PERSONAS[key];
    if (p.userId === user.userId || p.email === user.email) {
      return key;
    }
  }
  return null;
}

/**
 * Auth Fixtures for E2E Tests
 *
 * All persona fixtures are backed by real UI logins saved to
 * e2e/.auth/<persona>.json during the Playwright setup project.
 */
export type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
  orgAdminPage: Page;
  coordinatorPage: Page;
  caregiverPage: Page;
  familyPage: Page;
  adminUser: AuthenticatedUser;
  orgAdminUser: AuthenticatedUser;
  coordinatorUser: AuthenticatedUser;
  caregiverUser: AuthenticatedUser;
  familyUser: AuthenticatedUser;
};

/**
 * Extended test with real storageState-backed authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  adminUser: async ({}, use) => {
    await use(getPersonaUser('admin'));
  },

  orgAdminUser: async ({}, use) => {
    await use(getPersonaUser('orgAdmin'));
  },

  coordinatorUser: async ({}, use) => {
    await use(getPersonaUser('coordinator'));
  },

  caregiverUser: async ({}, use) => {
    await use(getPersonaUser('caregiver'));
  },

  familyUser: async ({}, use) => {
    await use(getPersonaUser('family'));
  },

  authenticatedPage: async ({ page }, use) => {
    await applyPersonaStorageState(page, 'coordinator');
    await use(page);
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), STORAGE_STATE_PATHS.admin),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  orgAdminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), STORAGE_STATE_PATHS.orgAdmin),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  coordinatorPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), STORAGE_STATE_PATHS.coordinator),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  caregiverPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), STORAGE_STATE_PATHS.caregiver),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  familyPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.resolve(process.cwd(), STORAGE_STATE_PATHS.family),
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

/**
 * Helper: Authenticate a Page using the real saved storageState for a seeded
 * persona user.
 */
export async function createAuthenticatedPage(
  page: Page,
  user: AuthenticatedUser
): Promise<Page> {
  const personaKey = resolvePersonaKey(user);
  if (personaKey) {
    return applyPersonaStorageState(page, personaKey);
  }
  return injectSyntheticAuthState(page, user);
}

/**
 * Unit-style helper ONLY for negative/synthetic token tests (e.g., testing
 * expired or malformed tokens without a real seeded login).
 */
export async function injectSyntheticAuthState(
  page: Page,
  user: AuthenticatedUser
): Promise<Page> {
  await page.goto('/');
  await page.evaluate(
    ({ token, authUser }) => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user: authUser, token, isAuthenticated: true },
          version: 0,
        })
      );
    },
    {
      token: user.token ?? 'invalid-synthetic-token',
      authUser: {
        id: user.userId || E2E_UUIDS.ADMIN_USER,
        organizationId: user.organizationId || E2E_UUIDS.ORG_E2E,
        email: user.email,
        name: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
    }
  );
  await page.reload();
  return page;
}

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';
