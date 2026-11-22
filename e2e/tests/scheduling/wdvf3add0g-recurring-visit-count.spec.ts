import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { PasswordUtils } from '@folkcare/core';

/**
 * E2E Regression: Recurring Visit Generator Reported Count vs. Actual DB Inserts (wdvf3add0g)
 *
 * Verifies:
 * 1. Schedule Builder sends horizonDays: 90 when creating a recurring schedule.
 * 2. POST /api/visits/patterns returns generatedVisitsCount equal to visits.length (actual DB inserts)
 *    and the UI toast reports that exact count.
 * 3. Creating an overlapping recurring schedule for the same client, days, and start time skips
 *    duplicate dates, returns skippedVisitsCount > 0, and surfaces the skipped count in the UI toast.
 */
const ORG_ID = '00000000-0000-4000-8000-00000000e2e0';
const ADMIN_USER_ID = '00000000-0000-4000-8000-00000000e2ea';
const BRANCH_ID = '00000000-0000-4000-8000-00000000e2eb';
const CLIENT_ID = '00000000-0000-4000-8000-00000000e2ec';
const ADMIN_EMAIL = 'e2e-sched-admin@mhc-test.local';
const ADMIN_PASSWORD = 'TestPassword123!';

test.describe('Recurring Visit Generator Count & Duplicate Handling (wdvf3add0g)', () => {
  test.beforeAll(async () => {
    const dbUrl =
      process.env['DATABASE_URL'] ||
      'postgresql://postgres:postgres@localhost:5432/folkcare_e2e_test';
    const db = new Pool({ connectionString: dbUrl });
    try {
      await db.query(
        `INSERT INTO organizations (id, name, primary_address, status, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, 'E2E Test Organization', $2, 'ACTIVE', NOW(), $1, NOW(), $1, 1)
         ON CONFLICT (id) DO NOTHING`,
        [
          ORG_ID,
          JSON.stringify({
            street: '1 Test Ln',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
            country: 'USA',
          }),
        ]
      );
      await db.query(
        `INSERT INTO users (id, organization_id, username, email, password_hash, first_name, last_name, status, roles, permissions, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, $2, $3, $4, $5, 'Sched', 'Admin', 'ACTIVE', $6, $7, NOW(), $1, NOW(), $1, 1)
         ON CONFLICT (id) DO NOTHING`,
        [
          ADMIN_USER_ID,
          ORG_ID,
          'e2e-sched-admin',
          ADMIN_EMAIL,
          PasswordUtils.hashPassword(ADMIN_PASSWORD),
          ['SUPER_ADMIN'],
          ['*:*'],
        ]
      );
      await db.query(
        `INSERT INTO branches (id, organization_id, name, code, address, timezone, status, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, $2, 'E2E Austin Branch', 'E2E-AUS', $3, 'America/Chicago', 'ACTIVE', NOW(), $4, NOW(), $4, 1)
         ON CONFLICT (id) DO NOTHING`,
        [
          BRANCH_ID,
          ORG_ID,
          JSON.stringify({
            line1: '100 Congress Ave',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
            country: 'USA',
          }),
          ADMIN_USER_ID,
        ]
      );
      await db.query(
        `INSERT INTO clients (id, organization_id, branch_id, client_number, first_name, last_name, date_of_birth, gender, primary_phone, primary_address, service_eligibility, status, created_at, created_by, updated_at, updated_by, version)
         VALUES ($1, $2, $3, 'CL-E2E-001', 'E2E', 'RecurringClient', '1950-01-15', 'FEMALE', '5125550199', $4, '{}'::jsonb, 'ACTIVE', NOW(), $5, NOW(), $5, 1)
         ON CONFLICT (id) DO NOTHING`,
        [
          CLIENT_ID,
          ORG_ID,
          BRANCH_ID,
          JSON.stringify({
            line1: '100 Congress Ave',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
            country: 'USA',
          }),
          ADMIN_USER_ID,
        ]
      );
    } finally {
      await db.end();
    }
  });

  test('reports actual committed visit count and warns when duplicate visits are skipped', async ({
    page,
  }) => {
    // Log in as seeded non-demo E2E admin
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/clients') && res.request().method() === 'GET' && res.ok()
      ),
      page.goto('/scheduling/builder'),
    ]);
    await expect(page.getByRole('button', { name: /\+ Recurring Schedule/i })).toBeVisible({
      timeout: 15000,
    });

    // Use a deterministic 2-week window 10 days from today and a unique start time to avoid collisions
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 13);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const uniqueMinute = String((Math.floor(Date.now() / 1000) % 50) + 10).padStart(2, '0');
    const uniqueStartTime = `07:${uniqueMinute}`;

    // --- Run 1: Create initial recurring schedule ---
    await page.getByRole('button', { name: /\+ Recurring Schedule/i }).click();
    await expect(page.getByText('Create Recurring Schedule')).toBeVisible();

    await page.locator('#recurring-client').click();
    await page.getByRole('option', { name: 'E2E RecurringClient' }).click();

    const dateInputs = page.locator('form input[type="date"]');
    await dateInputs.nth(0).fill(startStr);
    await dateInputs.nth(1).fill(endStr);
    await page.locator('form input[type="time"]').fill(uniqueStartTime);

    const [firstReq, firstRes] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/visits/patterns') && req.method() === 'POST'
      ),
      page.waitForResponse(
        (res) => res.url().includes('/api/visits/patterns') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: /Generate Recurring Visits/i }).click(),
    ]);

    const firstPayload = firstReq.postDataJSON() as { horizonDays?: number };
    expect(firstPayload.horizonDays).toBe(90);

    expect(firstRes.status()).toBe(201);
    const firstBody = (await firstRes.json()) as {
      success: boolean;
      data: {
        generatedVisitsCount: number;
        skippedVisitsCount?: number;
        visits: unknown[];
      };
    };
    expect(firstBody.success).toBe(true);
    expect(firstBody.data.generatedVisitsCount).toBeGreaterThan(0);
    expect(firstBody.data.generatedVisitsCount).toBe(firstBody.data.visits.length);

    await expect(
      page.getByText(`Generated ${firstBody.data.generatedVisitsCount} visits.`)
    ).toBeVisible({ timeout: 10000 });

    // --- Run 2: Create overlapping recurring schedule for same client/days/time ---
    await page.getByRole('button', { name: /\+ Recurring Schedule/i }).click();
    await expect(page.getByText('Create Recurring Schedule')).toBeVisible();

    await page.locator('#recurring-client').click();
    await page.getByRole('option', { name: 'E2E RecurringClient' }).click();

    await dateInputs.nth(0).fill(startStr);
    await dateInputs.nth(1).fill(endStr);
    await page.locator('form input[type="time"]').fill(uniqueStartTime);

    const [, secondRes] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/visits/patterns') && req.method() === 'POST'
      ),
      page.waitForResponse(
        (res) => res.url().includes('/api/visits/patterns') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: /Generate Recurring Visits/i }).click(),
    ]);

    expect(secondRes.status()).toBe(201);
    const secondBody = (await secondRes.json()) as {
      success: boolean;
      data: {
        generatedVisitsCount: number;
        skippedVisitsCount?: number;
        visits: unknown[];
      };
    };
    expect(secondBody.success).toBe(true);
    expect(secondBody.data.generatedVisitsCount).toBe(0);
    expect(secondBody.data.visits).toHaveLength(0);
    expect(secondBody.data.skippedVisitsCount).toBe(firstBody.data.generatedVisitsCount);

    await expect(
      page.getByText(
        `0 visits scheduled (${secondBody.data.skippedVisitsCount} duplicates skipped).`
      )
    ).toBeVisible({ timeout: 10000 });
  });
});
