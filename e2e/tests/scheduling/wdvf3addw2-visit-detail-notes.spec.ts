import { test, expect, type Page } from '@playwright/test';
import { Database, type DatabaseConfig } from '../../../packages/core/src/db/connection.js';
import { PasswordUtils } from '../../../packages/core/src/utils/password-utils.js';
import { E2E_UUIDS } from '../../fixtures/test-data.js';

const NOTES_USER_ID = '00000000-0000-4000-8009-00000000dd22';
const NOTES_EMAIL = 'e2e-notes-admin@e2e-test.local';
const NOTES_PASSWORD = 'Admin123!';
const BRANCH_ID = '00000000-0000-4000-8000-00000000dd22';
const CLIENT_ID = '00000000-0000-4000-8001-00000000dd22';
const CAREGIVER_ID = '00000000-0000-4000-8002-00000000dd22';
const VISIT_ID = '00000000-0000-4000-8003-00000000dd22';

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

async function seedVisitNotesFixtures(): Promise<void> {
  const dbName = process.env['E2E_DATABASE_NAME'] || 'folkcare_e2e_test';
  const dbUrl =
    process.env['E2E_DATABASE_URL'] || `postgresql://postgres:postgres@localhost:5432/${dbName}`;
  const db = new Database(parseDatabaseUrl(dbUrl));
  const orgId = E2E_UUIDS.ORG_E2E;
  const adminId = E2E_UUIDS.ADMIN_USER;
  const address = JSON.stringify({
    street: '200 Congress Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    country: 'USA',
  });

  try {
    await db.query(
      `INSERT INTO users (id, organization_id, username, email, password_hash, first_name, last_name, status, roles, permissions, created_at, created_by, updated_at, updated_by, version)
       VALUES ($1, $2, 'e2e-notes-admin', $3, $4, 'E2E', 'Coordinator', 'ACTIVE', $5, $6, NOW(), $7, NOW(), $7, 1)
       ON CONFLICT DO NOTHING`,
      [
        NOTES_USER_ID,
        orgId,
        NOTES_EMAIL,
        PasswordUtils.hashPassword(NOTES_PASSWORD),
        ['SUPER_ADMIN'],
        ['*:*'],
        adminId,
      ]
    );

    await db.query(
      `INSERT INTO branches (id, organization_id, name, code, address, status, created_at, created_by, updated_at, updated_by, version)
       VALUES ($1, $2, 'E2E Notes Branch', 'E2E-NOTES', $3, 'ACTIVE', NOW(), $4, NOW(), $4, 1)
       ON CONFLICT DO NOTHING`,
      [BRANCH_ID, orgId, address, adminId]
    );

    await db.query(
      `INSERT INTO clients (
         id, organization_id, branch_id, client_number, first_name, last_name, date_of_birth,
         primary_address, service_eligibility, status, created_at, created_by, updated_at, updated_by, version
       )
       VALUES ($1, $2, $3, 'CL-DDW2', 'E2E', 'NotesClient', '1948-03-10', $4, '{}'::jsonb, 'ACTIVE', NOW(), $5, NOW(), $5, 1)
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
         $1, $2, $3, $4, 'Jordan', 'Caregiver', 'CG-DDW2',
         '1988-09-20', 'jordan.ddw2@folkcare.example', $5, $6, 'CAREGIVER', 'FULL_TIME', '2024-01-01',
         $7, $8, '[]'::jsonb, '{}'::jsonb, 'COMPLIANT', 'ACTIVE',
         NOW(), $9, NOW(), $9, 1
       )
       ON CONFLICT DO NOTHING`,
      [
        CAREGIVER_ID,
        orgId,
        BRANCH_ID,
        [BRANCH_ID],
        JSON.stringify({ number: '512-555-0144', type: 'MOBILE' }),
        address,
        JSON.stringify({ regularRate: 25, overtimeRate: 37.5, currency: 'USD' }),
        JSON.stringify({}),
        adminId,
      ]
    );

    await db.query(
      `INSERT INTO visits (
         id, organization_id, branch_id, client_id, assigned_caregiver_id,
         visit_number, visit_type, service_type_id, service_type_name,
         scheduled_date, scheduled_start_time, scheduled_end_time, scheduled_duration,
         address, status, created_at, created_by, updated_at, updated_by, version
       )
       VALUES (
         $1, $2, $3, $4, $5,
         'VIS-DDW2-001', 'REGULAR', '00000000-0000-0000-0000-000000000000', 'Personal Care',
         '2026-11-25', '09:00', '11:00', 120,
         $6::jsonb, 'SCHEDULED', NOW(), $7, NOW(), $7, 1
       )
       ON CONFLICT DO NOTHING`,
      [VISIT_ID, orgId, BRANCH_ID, CLIENT_ID, CAREGIVER_ID, address, adminId]
    );

    // Clean any leftover notes from prior runs for deterministic assertion
    await db.query(`DELETE FROM visit_notes WHERE visit_id = $1`, [VISIT_ID]);
  } finally {
    await db.close();
  }
}

async function loginAsNotesAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"], input[name="email"]').first().fill(NOTES_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(NOTES_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('wdvf3addw2: Visit Detail Notes & Comments', () => {
  test.beforeAll(async () => {
    await seedVisitNotesFixtures();
  });

  test('allows adding and persisting a note on the visit detail page', async ({ page }) => {
    await loginAsNotesAdmin(page);

    await page.goto(`/scheduling/visits/${VISIT_ID}`);

    const notesSection = page.getByTestId('visit-notes-section');
    await expect(notesSection).toBeVisible({ timeout: 15000 });

    const noteContent = 'Coordinator handoff: client requested morning medication reminder.';
    await page.getByTestId('visit-note-type-select').click();
    await page.getByRole('option', { name: 'Clinical' }).click();
    await page.getByTestId('visit-note-input').fill(noteContent);
    await page.getByTestId('visit-note-submit').click();

    await expect(page.getByTestId('visit-note-item').first()).toContainText(noteContent, {
      timeout: 10000,
    });
    await expect(page.getByTestId('visit-note-item').first()).toContainText('Clinical');

    // Reload and verify persistence from the backend
    await page.reload();
    await expect(page.getByTestId('visit-notes-section')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('visit-note-item').first()).toContainText(noteContent, {
      timeout: 10000,
    });
  });
});
