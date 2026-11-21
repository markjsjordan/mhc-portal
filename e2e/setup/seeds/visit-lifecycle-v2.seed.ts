import { Database } from '../../../packages/core/src/db/connection.js';
import { PasswordUtils } from '../../../packages/core/src/utils/password-utils.js';
import { E2E_PASSWORD, E2E_UUIDS } from '../../fixtures/test-data.js';

/**
 * Seed Data: Visit Lifecycle E2E Fixture (E2E-4 wdvf3acxhq)
 *
 * Targets the REAL shared dev database (same DATABASE_URL that packages/app
 * dev server uses) — same approach as evv-clock-persistence.seed.ts.
 *
 * Creates the minimum viable set of fixtures for the visit lifecycle journey:
 *   - One client with a geocoded TX primary_address (for geofence checks).
 *   - One caregiver with CLEARED background check (valid assignment + clock-in).
 *   - One caregiver WITHOUT background check / clearance (for negative
 *     compliance test: blocked from assignment because checkCompliance=true).
 *
 * Does NOT pre-create a visit: the spec exercises POST /api/visits itself to
 * test the scheduling step, using the seeded client_id.
 *
 * All IDs use a unique prefix (ee40) distinct from evv-clock-persistence
 * (ee20) so both seed sets can coexist in the dev DB without collisions.
 */

// Org/branch/admin come from the E2E global setup (seed-personas.ts).
const ORG_ID = E2E_UUIDS.ORG_E2E;
const BRANCH_ID = E2E_UUIDS.BRANCH_E2E;
const ADMIN_USER_ID = E2E_UUIDS.ADMIN_USER;

export const VL_FIXTURE_CLIENT_ID = '00000000-ee40-4000-8000-0000000c1001';
export const VL_FIXTURE_CAREGIVER_VALID_ID = '00000000-ee40-4000-8000-0000000ca001';
export const VL_FIXTURE_CAREGIVER_NOCLEAR_ID = '00000000-ee40-4000-8000-0000000ca002';
export const VL_FIXTURE_CAREGIVER_USER_ID = '00000000-ee40-4000-8000-0000000a0001';
export const VL_FIXTURE_CAREGIVER_EMAIL = 'vl.caregiver@e2e.folkcare.local';

// TX address geocoded inside Austin (~100 Congress Ave) — geofence passes for
// FIXTURE_LOCATION_INSIDE; a distant location (NYC) will flag geofence.
export const FIXTURE_LOCATION_INSIDE = { latitude: 30.2672, longitude: -97.7431, accuracy: 10 };
export const FIXTURE_LOCATION_OUTSIDE = { latitude: 40.7128, longitude: -74.006, accuracy: 10 };

export async function seedDatabase(db: Database): Promise<void> {
  console.log('Seeding visit-lifecycle-v2 fixture...');

  // ── Branch (FK target for clients/caregivers) ────────────────────────────
  await db.query(
    `INSERT INTO branches (
      id, organization_id, name, code, address, status, timezone,
      created_at, created_by, updated_at, updated_by, version
    ) VALUES ($1, $2, 'E2E Lifecycle Branch', 'E2E-VL', $3, 'ACTIVE', 'America/Chicago', NOW(), $4, NOW(), $4, 1)
    ON CONFLICT (id) DO NOTHING`,
    [
      BRANCH_ID,
      ORG_ID,
      JSON.stringify({ line1: '100 Congress Ave', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' }),
      ADMIN_USER_ID,
    ]
  );

  // ── Client ───────────────────────────────────────────────────────────────
  await db.query(
    `INSERT INTO clients (
      id, organization_id, branch_id, client_number, first_name, last_name,
      date_of_birth, primary_address, emergency_contacts, authorized_contacts,
      programs, service_eligibility, risk_flags, status, timezone,
      created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      NOW(), $16, NOW(), $16, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      branch_id = EXCLUDED.branch_id,
      primary_address = EXCLUDED.primary_address,
      status = EXCLUDED.status`,
    [
      VL_FIXTURE_CLIENT_ID,
      ORG_ID,
      BRANCH_ID,
      'CL-VL-FIXTURE-001',
      'Lifecycle',
      'Fixture-Client',
      '1952-06-15',
      JSON.stringify({
        line1: '100 Congress Ave',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
        latitude: 30.2672,
        longitude: -97.7431,
      }),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      'ACTIVE',
      'America/Chicago',
      ADMIN_USER_ID,
    ]
  );

  // ── Valid caregiver (CLEARED background check) ────────────────────────────
  await db.query(
    `INSERT INTO caregivers (
      id, organization_id, branch_ids, primary_branch_id, employee_number,
      first_name, last_name, date_of_birth, primary_phone, email,
      preferred_contact_method, primary_address, emergency_contacts,
      employment_type, employment_status, hire_date, role, credentials,
      training, skills, availability, pay_rate, compliance_status,
      status, timezone, created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, $3::uuid[], $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, NOW(), $26, NOW(), $26, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      branch_ids = EXCLUDED.branch_ids,
      primary_branch_id = EXCLUDED.primary_branch_id,
      compliance_status = EXCLUDED.compliance_status,
      status = EXCLUDED.status`,
    [
      VL_FIXTURE_CAREGIVER_VALID_ID,
      ORG_ID,
      [BRANCH_ID],
      BRANCH_ID,
      'CG-VL-FIXTURE-001',
      'ValidLifecycle',
      'Fixture-Caregiver',
      '1988-03-20',
      JSON.stringify({ number: '512-555-0201', type: 'MOBILE' }),
      'vl.valid.caregiver@e2e-test.invalid',
      'PHONE',
      JSON.stringify({ line1: '200 Fixture Way', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' }),
      JSON.stringify([]),
      'FULL_TIME',
      'ACTIVE',
      '2023-06-01',
      'CAREGIVER',
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }),
      JSON.stringify({ hourlyRate: 25.0, currency: 'USD' }),
      'COMPLIANT',
      'ACTIVE',
      'America/Chicago',
      ADMIN_USER_ID,
    ]
  );

  await db.query(
    `UPDATE caregivers SET background_check = $2 WHERE id = $1`,
    [
      VL_FIXTURE_CAREGIVER_VALID_ID,
      JSON.stringify({
        status: 'CLEARED',
        clearanceDate: '2023-06-01',
        expirationDate: '2030-01-01',
        checkType: 'FBI_FINGERPRINT',
      }),
    ]
  );

  // ── Non-cleared caregiver (no background check) ───────────────────────────
  // Used for the negative test: assignment with checkCompliance=true should
  // return a compliance warning/failure.
  await db.query(
    `INSERT INTO caregivers (
      id, organization_id, branch_ids, primary_branch_id, employee_number,
      first_name, last_name, date_of_birth, primary_phone, email,
      preferred_contact_method, primary_address, emergency_contacts,
      employment_type, employment_status, hire_date, role, credentials,
      training, skills, availability, pay_rate, compliance_status,
      status, timezone, created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, $3::uuid[], $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
      $24, $25, NOW(), $26, NOW(), $26, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      branch_ids = EXCLUDED.branch_ids,
      primary_branch_id = EXCLUDED.primary_branch_id,
      compliance_status = EXCLUDED.compliance_status,
      status = EXCLUDED.status`,
    [
      VL_FIXTURE_CAREGIVER_NOCLEAR_ID,
      ORG_ID,
      [BRANCH_ID],
      BRANCH_ID,
      'CG-VL-FIXTURE-002',
      'NoClearLifecycle',
      'Fixture-Caregiver',
      '1990-07-04',
      JSON.stringify({ number: '512-555-0202', type: 'MOBILE' }),
      'vl.noclear.caregiver@e2e-test.invalid',
      'PHONE',
      JSON.stringify({ line1: '300 Fixture Ave', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' }),
      JSON.stringify([]),
      'PART_TIME',
      'ACTIVE',
      '2024-01-15',
      'CAREGIVER',
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({ monday: true, wednesday: true, friday: true }),
      JSON.stringify({ hourlyRate: 20.0, currency: 'USD' }),
      'PENDING_VERIFICATION',
      'ACTIVE',
      'America/Chicago',
      ADMIN_USER_ID,
    ]
  );

  // Explicitly clear background_check so compliance check can flag it
  await db.query(
    `UPDATE caregivers SET background_check = NULL WHERE id = $1`,
    [VL_FIXTURE_CAREGIVER_NOCLEAR_ID]
  );

  // Seed a blocking compliance deadline (TX HHSC EMR / background clearance)
  // so check-assignment flags the non-cleared caregiver as non-compliant.
  await db.query(
    `INSERT INTO compliance_deadlines (
      id, organization_id, entity_type, entity_id, entity_name,
      category, title, description,
      deadline_date, warning_date, urgent_date,
      status, priority, state_code, regulation, blocks_scheduling
    ) VALUES (
      $1, $2, 'CAREGIVER', $3, 'NoClearLifecycle Fixture-Caregiver',
      'CAREGIVER_BACKGROUND_CHECK', 'Texas EMR / Background Clearance Missing',
      'Caregiver lacks required Texas Employee Misconduct Registry (EMR) clearance',
      NOW() - INTERVAL '1 day', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days',
      'BLOCKED', 'CRITICAL', 'TX', '26 TAC §558', true
    )
    ON CONFLICT (id) DO UPDATE SET
      status = 'BLOCKED',
      blocks_scheduling = true,
      resolved_at = NULL`,
    [
      '00000000-ee40-4000-8000-0000000cd001',
      ORG_ID,
      VL_FIXTURE_CAREGIVER_NOCLEAR_ID,
    ]
  );

  // ── Non-demo caregiver user with EVV permissions ─────────────────────────
  const passwordHash = PasswordUtils.hashPassword(E2E_PASSWORD);
  await db.query(
    `INSERT INTO users (
      id, organization_id, username, email, password_hash,
      first_name, last_name, status, roles, permissions, branch_ids,
      created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, 'vl_caregiver', $3, $4,
      'ValidLifecycle', 'Caregiver', 'ACTIVE',
      ARRAY['CAREGIVER', 'SUPERVISOR'],
      ARRAY['evv:clock_in', 'evv:clock_out', 'evv:read'],
      $5::uuid[],
      NOW(), $6, NOW(), $6, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      roles = EXCLUDED.roles,
      permissions = EXCLUDED.permissions,
      branch_ids = EXCLUDED.branch_ids,
      status = 'ACTIVE'`,
    [
      VL_FIXTURE_CAREGIVER_USER_ID,
      ORG_ID,
      VL_FIXTURE_CAREGIVER_EMAIL,
      passwordHash,
      [BRANCH_ID],
      ADMIN_USER_ID,
    ]
  );

  // Link the valid caregiver record to the caregiver user account
  await db.query(
    `UPDATE caregivers SET user_id = $2, portal_access_status = 'ACTIVE' WHERE id = $1`,
    [VL_FIXTURE_CAREGIVER_VALID_ID, VL_FIXTURE_CAREGIVER_USER_ID]
  );

  console.log('✅ visit-lifecycle-v2 fixture seeded');
  console.log('  client:', VL_FIXTURE_CLIENT_ID);
  console.log('  caregiver (valid):', VL_FIXTURE_CAREGIVER_VALID_ID);
  console.log('  caregiver (no-clear):', VL_FIXTURE_CAREGIVER_NOCLEAR_ID);
}
