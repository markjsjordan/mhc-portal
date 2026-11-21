import fs from 'fs';
import path from 'path';
import { test as setup, expect } from '@playwright/test';
import { E2E_PERSONAS, E2EPersonaKey } from '../fixtures/test-data.js';

const AUTH_DIR = path.resolve(process.cwd(), 'e2e/.auth');

const PERSONA_KEYS: E2EPersonaKey[] = [
  'admin',
  'orgAdmin',
  'coordinator',
  'caregiver',
  'family',
];

for (const key of PERSONA_KEYS) {
  const persona = E2E_PERSONAS[key];

  setup(`authenticate as ${key} (${persona.email})`, async ({ page }) => {
    fs.mkdirSync(AUTH_DIR, { recursive: true });

    // Intercept /api/auth/login response to capture the real accessToken so we
    // can persist it inside localStorage['auth-storage'] alongside the HttpOnly
    // mhc_rt cookie. Existing E2E helpers read auth-storage.state.token.
    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST'
    );

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(persona.email);
    await page.locator('input[type="password"]').fill(persona.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    const loginResponse = await loginResponsePromise;
    expect(
      loginResponse.status(),
      `Login failed for persona ${key} (${persona.email}): HTTP ${loginResponse.status()}`
    ).toBe(200);

    const loginJson = (await loginResponse.json()) as {
      data?: { tokens?: { accessToken?: string } };
      tokens?: { accessToken?: string };
    };
    const accessToken =
      loginJson?.data?.tokens?.accessToken ?? loginJson?.tokens?.accessToken ?? null;
    expect(accessToken, `Missing accessToken in login response for ${key}`).toBeTruthy();

    await page.waitForURL(persona.expectedLandingPath, { timeout: 15000 });

    // Persist accessToken in Zustand's auth-storage entry so both app hydration
    // and in-page fetch() helpers have the real token immediately on boot.
    await page.evaluate((token) => {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.state = {
          ...(parsed.state || {}),
          token,
          isAuthenticated: true,
        };
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    }, accessToken);

    const statePath = path.resolve(process.cwd(), persona.storageStatePath);
    await page.context().storageState({ path: statePath });
  });
}
