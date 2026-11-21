import { test, expect, type Page } from '@playwright/test';
import { Database, type DatabaseConfig } from '../../../packages/core/src/db/connection.js';
import { PasswordUtils } from '../../../packages/core/src/utils/password-utils.js';
import { E2E_UUIDS } from '../../fixtures/test-data.js';

const SCHEDULER_USER_ID = '00000000-0000-4000-8009-00000000dd18';
const SCHEDULER_EMAIL = 'e2e-scheduler@e2e-test.local';
const SCHEDULER_PASSWORD = 'Admin123!';
const BRANCH_ID = '00000000-0000-4000-8000-00000000dd18';
const CLIENT_ID = '00000000-0000-4000-8001-00000000dd18';
const CAREGIVER_ID = '00000000-0000-4000-8002-00000000dd18';

function parseDatabaseUrl(url: string): DatabaseConfig {
  const match = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid database URL format: ${url}`);
  }
  const [, user, password, host, port, database] = match;
  return {
    host: host!,
    port: parseInt(port!, 10),
    database: database!,
    user: user!,
    password: password!,
    ssl: false,
    max: 5,
    idleTimeoutMillis: 10000,
  };
}

async function seedSchedulingFixtures(): Promise<void> {
  const dbName = process.env['E2E_DATABASE_NAME'] || 'folkcare_e2e_test';
  const dbUrl =
    process.env['E2E_DATABASE_URL'] || `postgresql://postgres:postgres@localhost:5432/${dbName}`;
  const db = new Database(parseDatabaseUrl(dbUrl));
  const orgId = E2E_UUIDS.ORG_E2E;
  const adminId = E2E_UUIDS.ADMIN_USER;
  const address = JSON.stringify({
    street: '100 Main St',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'USA',
  });

  try {
    // Non-demo admin account so write endpoints (POST /api/visits) are not blocked by demo-mode read-only guard
    await db.query(
      `INSERT INTO users (id, organization_id, username, email, password_hash, first_name, last_name, status, roles, permissions, created_at, created_by, updated_at, updated_by, version)
       VALUES ($1, $2, 'e2e-scheduler', $3, $4, 'E2E', 'Scheduler', 'ACTIVE', $5, $6, NOW(), $7, NOW(), $7, 1)
       ON CONFLICT DO NOTHING`,
      [
        SCHEDULER_USER_ID,
        orgId,
        SCHEDULER_EMAIL,
        PasswordUtils.hashPassword(SCHEDULER_PASSWORD),
        ['SUPER_ADMIN'],
        ['*:*'],
        adminId,
      ]
    );

    await db.query(
      `INSERT INTO branches (id, organization_id, name, code, address, status, created_at, created_by, updated_at, updated_by, version)
       VALUES ($1, $2, 'E2E Main Branch', 'E2E-MAIN', $3, 'ACTIVE', NOW(), $4, NOW(), $4, 1)
       ON CONFLICT DO NOTHING`,
      [BRANCH_ID, orgId, address, adminId]
    );

    await db.query(
      `INSERT INTO clients (
         id, organization_id, branch_id, client_number, first_name, last_name, date_of_birth,
         primary_address, service_eligibility, status, created_at, created_by, updated_at, updated_by, version
       )
       VALUES ($1, $2, $3, 'CL-DD18', 'E2E', 'Client', '1950-01-15', $4, '{}'::jsonb, 'ACTIVE', NOW(), $5, NOW(), $5, 1)
       ON CONFLICT DO NOTHING`,
      [CLIENT_ID, orgId, BRANCH_ID, address, adminId]
    );

    await db.query(
      `INSERT INTO caregivers (
         id, organization_id, primary_branch_id, branch_ids, first_name, last_name, employee_number,
         date_of_birth, email, primary_phone, primary_address, role, employment_type, hire_date,
         pay_rate, availability, credentials, background_check, compliance_status, status,
         created_at, created_by, updated_at, updated_by, version
       )
       VALUES (
         $1, $2, $3, $4, 'Alice', 'Caregiver', 'CG-DD18',
         '1985-06-15', 'alice.dd18@folkcare.example', $5, $6, 'CAREGIVER', 'FULL_TIME', '2024-01-01',
         $7, $8, '[]'::jsonb, '{}'::jsonb, 'COMPLIANT', 'ACTIVE',
         NOW(), $9, NOW(), $9, 1
       )
       ON CONFLICT DO NOTHING`,
      [
        CAREGIVER_ID,
        orgId,
        BRANCH_ID,
        [BRANCH_ID],
        JSON.stringify({ number: '512-555-0199', type: 'MOBILE' }),
        address,
        JSON.stringify({ hourlyRate: 25.0, currency: 'USD' }),
        JSON.stringify({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }),
        adminId,
      ]
    );
  } finally {
    await db.close();
  }
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', SCHEDULER_EMAIL);
  await page.fill('input[type="password"]', SCHEDULER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, { timeout: 15000 });
}

test.describe('Scheduler: Create New Individual Visits (wdvf3add18)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await seedSchedulingFixtures();
  });

  test('creates an unassigned one-off visit from /scheduling/calendar', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/scheduling/calendar');
    const scheduleBtn = page.getByTestId('calendar-create-visit-btn');
    await expect(scheduleBtn).toBeVisible({ timeout: 15000 });
    await scheduleBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Create New Visit')).toBeVisible();

    // Verify no AI suggestions are rendered
    await expect(dialog.getByText(/ai suggest/i)).toHaveCount(0);

    // Select Client
    await dialog.locator('#visit-client').click();
    await page.getByRole('option').first().click();

    // Select Service Type
    await dialog.locator('#visit-service-type').click();
    await page.getByRole('option').first().click();

    // Set Date, Start Time, and Duration -> End Time updates automatically
    await dialog.locator('#visit-date').fill('2026-12-01');
    await dialog.locator('#visit-start-time').fill('09:00');
    await dialog.locator('#visit-duration').click();
    await page.getByRole('option', { name: /2 hours/i }).click();
    await expect(dialog.locator('#visit-end-time')).toHaveValue('11:00');

    // Caregiver remains unassigned
    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/visits') && res.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: /create visit/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const body = await createResponse.json();
    const visit = body.data;
    expect(visit.clientId ?? visit.client_id).toBeTruthy();
    expect(visit.scheduledDuration ?? visit.scheduled_duration).toBe(120);
    expect(visit.status).toBe('UNASSIGNED');
    expect(visit.assignedCaregiverId ?? visit.assigned_caregiver_id ?? null).toBeNull();
  });

  test('creates an individual visit with manual caregiver assignment', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/scheduling/calendar');
    await page.getByTestId('calendar-create-visit-btn').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select Client
    await dialog.locator('#visit-client').click();
    await page.getByRole('option').first().click();

    // Select Service Type
    await dialog.locator('#visit-service-type').click();
    await page.getByRole('option').first().click();

    // Set Date, Start Time, and Duration (60 min -> 14:00)
    await dialog.locator('#visit-date').fill('2026-12-02');
    await dialog.locator('#visit-start-time').fill('13:00');
    await dialog.locator('#visit-duration').click();
    await page.getByRole('option', { name: /1 hour/i }).click();
    await expect(dialog.locator('#visit-end-time')).toHaveValue('14:00');

    // Manually select an active caregiver (index 1 skips "-- Unassigned --")
    await dialog.locator('#visit-caregiver').click();
    await page.getByRole('option').nth(1).click();

    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/visits') && res.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: /create visit/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const body = await createResponse.json();
    const visit = body.data;
    expect(visit.assignedCaregiverId ?? visit.assigned_caregiver_id).toBeTruthy();
    expect(visit.status).toBe('ASSIGNED');
  });

  test('coordinator can create a one-off visit from scheduler view', async () => {
    test.fixme(true, 'needs non-admin seed users: E2E-3 wdvf3acxhp');
  });
});
