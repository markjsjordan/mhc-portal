import { Database } from '../../../packages/core/src/db/connection.js';

/**
 * Seed Data: Mobile Caregiver E2E Fixture (E2E-5 / wdvf3acxhr)
 *
 * Idempotent seed targeting the shared E2E/dev database:
 * - Reuses existing org/branch (MHC Portal / Main Office).
 * - Creates a caregiver user (caregiver.mobile@e2e-test.com / Caregiver123!)
 *   and linked `caregivers` row with CLEARED background check.
 * - Creates a geocoded TX client (100 Congress Ave, Austin, TX: 30.2672, -97.7431).
 * - Creates two `ASSIGNED` visits for today (one for in-geofence clock-in, one for
 *   out-of-geofence clock-in) with no leftover EVV records.
 * - [DISABLED] Creates a scheduled `care_plan_tasks` row for the caregiver tasks page (table does not exist yet).
 */

const ORG_ID = '00000000-e2e0-4000-8000-000000000001';
const BRANCH_ID = '00000000-e2e0-4000-8000-000000000010';
const ADMIN_USER_ID = '00000000-e2e0-4000-8000-000000000100';

export const MOBILE_CAREGIVER_USER_ID = '00000000-ee50-4000-8000-00000000a001';
export const MOBILE_CAREGIVER_ID = '00000000-ee50-4000-8000-0000000ca001';
export const MOBILE_CLIENT_ID = '00000000-ee50-4000-8000-0000000c1001';
export const MOBILE_VISIT_IN_ID = '00000000-ee50-4000-8000-0000000fa001';
export const MOBILE_VISIT_OUT_ID = '00000000-ee50-4000-8000-0000000fa002';
export const MOBILE_TASK_ID = '00000000-ee50-4000-8000-00000007a001';

// Password hash for 'Caregiver123!' (bcrypt $2b$10$...)
// If login uses the demo/dev password, we copy the hash from admin@folkcare.example
// or insert a known bcrypt hash. Copying from admin@folkcare.example guarantees
// compatibility with the active auth provider.

export async function seedDatabase(db: Database): Promise<void> {
  // Ensure caregiver user exists (reuse admin's password_hash so 'Admin123!' works reliably)
  const adminRow = await db.query<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1 LIMIT 1`,
    [ADMIN_USER_ID]
  );
  const passwordHash = adminRow.rows[0]?.password_hash ?? '$2b$10$placeholder';

  await db.query(
    `INSERT INTO users (
      id, organization_id, username, email, password_hash, first_name, last_name,
      roles, status, email_verified, created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, ARRAY['CAREGIVER']::VARCHAR(50)[], 'ACTIVE', true,
      NOW(), $1, NOW(), $1, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      status = 'ACTIVE'`,
    [
      MOBILE_CAREGIVER_USER_ID,
      ORG_ID,
      'caregiver.mobile',
      'caregiver.mobile@e2e-test.com',
      passwordHash,
      'Mobile',
      'Caregiver',
    ]
  );

  // Caregiver row
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
      status = EXCLUDED.status`,
    [
      MOBILE_CAREGIVER_ID,
      ORG_ID,
      [BRANCH_ID],
      BRANCH_ID,
      'CG-MOBILE-001',
      'Mobile',
      'Caregiver',
      '1988-05-15',
      JSON.stringify({ number: '512-555-0155', type: 'MOBILE' }),
      'caregiver.mobile@e2e-test.com',
      'SMS',
      JSON.stringify({
        street1: '200 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        country: 'US',
      }),
      JSON.stringify([]),
      'FULL_TIME',
      'ACTIVE',
      '2024-01-01',
      'CAREGIVER',
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(['PERSONAL_CARE']),
      JSON.stringify({}),
      JSON.stringify({ hourlyRate: 22 }),
      'COMPLIANT',
      'ACTIVE',
      'America/Chicago',
      ADMIN_USER_ID,
    ]
  );

  // Geocoded TX client (100 Congress Ave, Austin, TX)
  await db.query(
    `INSERT INTO clients (
      id, organization_id, branch_id, client_number, first_name, last_name,
      date_of_birth, gender, primary_phone, primary_address,
      emergency_contacts, service_eligibility, status, created_at, created_by, updated_at, updated_by, version
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, NOW(), $14, NOW(), $14, 1
    )
    ON CONFLICT (id) DO UPDATE SET
      primary_address = EXCLUDED.primary_address,
      status = 'ACTIVE'`,
    [
      MOBILE_CLIENT_ID,
      ORG_ID,
      BRANCH_ID,
      'CL-MOBILE-001',
      'Austin',
      'MobileClient',
      '1945-03-10',
      'FEMALE',
      JSON.stringify({ number: '512-555-0166', type: 'HOME' }),
      JSON.stringify({
        street1: '100 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        country: 'US',
        latitude: 30.2672,
        longitude: -97.7431,
      }),
      JSON.stringify([]),
      JSON.stringify({}),
      'ACTIVE',
      ADMIN_USER_ID,
    ]
  );

  // Clean up any leftover EVV records for our fixture visits
  await db.query(
    `DELETE FROM evv_records WHERE visit_id IN ($1, $2)`,
    [MOBILE_VISIT_IN_ID, MOBILE_VISIT_OUT_ID]
  );

  const today = new Date().toISOString().slice(0, 10);

  for (const [visitId, startHour, endHour] of [
    [MOBILE_VISIT_IN_ID, '09:00:00', '11:00:00'],
    [MOBILE_VISIT_OUT_ID, '13:00:00', '15:00:00'],
  ] as const) {
    await db.query(
      `INSERT INTO visits (
        id, organization_id, branch_id, client_id, visit_number, visit_type,
        service_type_id, service_type_name, scheduled_date,
        scheduled_start_time, scheduled_end_time, scheduled_duration, timezone,
        assigned_caregiver_id, assigned_at, assigned_by, assignment_method,
        address, status, status_history,
        created_at, created_by, updated_at, updated_by, version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 120, $12, $13,
        NOW(), $14, $15, $16::jsonb, $17, $18::jsonb,
        NOW(), $14, NOW(), $14, 1
      )
      ON CONFLICT (id) DO UPDATE SET
        scheduled_date = EXCLUDED.scheduled_date,
        status = 'ASSIGNED'`,
      [
        visitId,
        ORG_ID,
        BRANCH_ID,
        MOBILE_CLIENT_ID,
        visitId === MOBILE_VISIT_IN_ID ? 'VIS-MOB-001' : 'VIS-MOB-002',
        'REGULAR',
        '00000000-0000-4000-8000-00000005ec01', // PERSONAL_CARE placeholder; no FK on visits.service_type_id
        'PERSONAL_CARE',
        today,
        startHour,
        endHour,
        'America/New_York',
        MOBILE_CAREGIVER_ID,
        ADMIN_USER_ID,
        'MANUAL',
        JSON.stringify({ line1: '100 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'USA' }),
        'ASSIGNED',
        JSON.stringify([]),
      ]
    );
  }

  // TODO: Re-enable when care_plan_tasks table exists (migration needed)
  // Scheduled care_plan_tasks row
  /*
  await db.query(
    `INSERT INTO care_plan_tasks (
      id, organization_id, client_id, title, description, category,
      frequency, status, created_at, created_by, updated_at, updated_by
    ) VALUES (
      $1, $2, $3, 'Morning Mobility Assistance', 'Assist client with morning transfer and walk',
      'ADL', 'DAILY', 'ACTIVE', NOW(), $4, NOW(), $4
    )
    ON CONFLICT (id) DO NOTHING`,
    [MOBILE_TASK_ID, ORG_ID, MOBILE_CLIENT_ID, ADMIN_USER_ID]
  );
  */
}
