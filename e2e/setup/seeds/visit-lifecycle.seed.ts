import { Database } from '../../../packages/core/src/db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { E2E_UUIDS } from '../../fixtures/test-data.js';

/**
 * Seed Data: Visit Lifecycle
 *
 * Creates test data for basic visit lifecycle testing:
 * - Organization and branch
 * - Client
 * - Caregiver with valid credentials
 * - Scheduled visit with tasks
 */
export async function seedDatabase(db: Database): Promise<void> {
  console.log('Seeding visit lifecycle test data...');

  const orgId = E2E_UUIDS.ORG_E2E;
  const branchId = E2E_UUIDS.BRANCH_E2E;
  const clientId = E2E_UUIDS.CLIENT_001;
  const caregiverId = E2E_UUIDS.CAREGIVER_001;
  const visitId = E2E_UUIDS.VISIT_001;

  // Create organization
  await db.query(
    `INSERT INTO organizations (id, name, primary_address, status, created_at, created_by, updated_at, updated_by, version)
     VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), $5, 1)
     ON CONFLICT (id) DO NOTHING`,
    [
      orgId,
      'E2E Test Organization',
      JSON.stringify({
        line1: '456 Healthcare Blvd',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      }),
      'ACTIVE',
      '00000000-e2e0-4000-8000-000000000100',
    ]
  );

  // Create the shared actor user after the organization (users.organization_id
  // is a foreign key). Its created_by/updated_by require a real users row, and this spec seeds only this scenario. The
  // password_hash is a deliberate non-loginable marker: this is a data-only
  // actor for referential integrity, not an account anyone can sign in to.
  await db.query(
    `INSERT INTO users (
      id, organization_id, username, email, password_hash, first_name, last_name,
      status, created_at, created_by, updated_at, updated_by, version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW(), $1, NOW(), $1, 1)
    ON CONFLICT (id) DO NOTHING`,
    [
      E2E_UUIDS.ADMIN_USER,
      E2E_UUIDS.ORG_E2E,
      'e2e-actor',
      'e2e-actor@e2e-test.invalid',
      '!non-loginable-seed-actor',
      'E2E',
      'Actor',
    ]
  );

  // Create branch
  await db.query(
    `INSERT INTO branches (id, organization_id, name, address, status, created_at, created_by, updated_at, updated_by, version)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW(), $6, 1)
     ON CONFLICT (id) DO NOTHING`,
    [
      branchId,
      orgId,
      'Main Branch',
      JSON.stringify({
        line1: '123 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
        latitude: 30.2672,
        longitude: -97.7431,
      }),
      'ACTIVE',
      '00000000-e2e0-4000-8000-000000000100',
    ]
  );

  // Create client
  await db.query(
    `INSERT INTO clients (
      id, organization_id, branch_id, client_number, first_name, last_name, date_of_birth,
      primary_address, service_eligibility, status, created_at, created_by, updated_at, updated_by, version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, NOW(), $11, 1)
    ON CONFLICT (id) DO NOTHING`,
    [
      clientId,
      orgId,
      branchId,
      'CL-VISIT-LIFECYCLE-001',
      'John',
      'Doe',
      '1950-01-01',
      JSON.stringify({
        street: '456 Client St',
        city: 'Austin',
        state: 'TX',
        zip: '78702',
        latitude: 30.2672,
        longitude: -97.7431,
        geofence_radius: 100, // meters
      }),
      JSON.stringify({}),
      'ACTIVE',
      '00000000-e2e0-4000-8000-000000000100',
    ]
  );

  // Create caregiver with valid credentials
  await db.query(
    `INSERT INTO caregivers (
      id, organization_id, primary_branch_id, branch_ids, first_name, last_name, employee_number,
      date_of_birth, email, primary_phone, primary_address, role, employment_type, hire_date,
      pay_rate, availability, credentials, background_check, compliance_status, status,
      created_at, created_by, updated_at, updated_by, version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), $21, NOW(), $21, 1)
    ON CONFLICT (id) DO NOTHING`,
    [
      caregiverId,
      orgId,
      branchId,
      [branchId],
      'Jane',
      'Caregiver',
      'CG-001',
      '1985-06-15',
      'jane.caregiver@e2e-test.invalid',
      JSON.stringify({ number: '555-0100', type: 'MOBILE' }),
      JSON.stringify({ street: '1 Test Ln', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' }),
      'CAREGIVER',
      'FULL_TIME',
      '2024-01-01',
      JSON.stringify({ hourlyRate: 25.0, currency: 'USD' }),
      JSON.stringify({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }),
      JSON.stringify([
        {
          type: 'CPR',
          number: 'CPR-123',
          issueDate: '2024-01-01',
          expirationDate: '2026-01-01',
          issuingAuthority: 'American Red Cross',
          status: 'VALID',
        },
        {
          type: 'FIRST_AID',
          number: 'FA-456',
          issueDate: '2024-01-01',
          expirationDate: '2026-01-01',
          issuingAuthority: 'American Red Cross',
          status: 'VALID',
        },
      ]),
      JSON.stringify({
        emr_check: {
          status: 'CLEARED',
          clearanceDate: '2024-01-01',
          expirationDate: '2026-01-01',
          checkType: 'EMPLOYEE_MISCONDUCT_REGISTRY',
        },
        criminal_background: {
          status: 'CLEARED',
          clearanceDate: '2024-01-01',
          expirationDate: '2026-01-01',
          checkType: 'FBI_BCI',
        },
      }),
      'COMPLIANT',
      'ACTIVE',
      '00000000-e2e0-4000-8000-000000000100',
    ]
  );

  // Create scheduled visit with tasks
  await db.query(
    `INSERT INTO visits (
      id, organization_id, branch_id, client_id, caregiver_id,
      service_type, scheduled_date, scheduled_time, duration_hours,
      status, tasks, created_at, created_by, updated_at, updated_by, version
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, NOW(), $12, 1)
    ON CONFLICT (id) DO NOTHING`,
    [
      visitId,
      orgId,
      branchId,
      clientId,
      caregiverId,
      'PERSONAL_CARE',
      '2025-01-15',
      '09:00:00',
      2,
      'SCHEDULED',
      JSON.stringify([
        {
          id: uuidv4(),
          name: 'Assist with bathing',
          description: 'Help client with morning bath',
          critical: true,
          completed: false,
        },
        {
          id: uuidv4(),
          name: 'Medication reminder',
          description: 'Remind client to take medications',
          critical: true,
          completed: false,
        },
        {
          id: uuidv4(),
          name: 'Meal preparation',
          description: 'Prepare breakfast',
          critical: false,
          completed: false,
        },
      ]),
      '00000000-e2e0-4000-8000-000000000100',
    ]
  );

  console.log('✅ Visit lifecycle seed data created');
}
