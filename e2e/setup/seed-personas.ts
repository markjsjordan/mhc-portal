import { Database } from '../../packages/core/src/db/connection.js';
import { PasswordUtils } from '../../packages/core/src/utils/password-utils.js';
import { E2E_PASSWORD, E2E_PERSONAS, E2E_UUIDS } from '../fixtures/test-data.js';

/**
 * Idempotently seeds the E2E organization, branch, 5 persona accounts
 * (SUPER_ADMIN, ORG_ADMIN, COORDINATOR, CAREGIVER, FAMILY), and the required
 * portal links (caregivers row for CAREGIVER, clients + family_members row for
 * FAMILY).
 *
 * Uses bare `ON CONFLICT DO NOTHING` so reruns against a shared DB or after
 * scenario seeds are safe.
 */
export async function seedE2EPersonas(db: Database): Promise<void> {
  const orgId = E2E_UUIDS.ORG_E2E;
  const branchId = E2E_UUIDS.BRANCH_E2E;
  const adminId = E2E_UUIDS.ADMIN_USER;
  const passwordHash = PasswordUtils.hashPassword(E2E_PASSWORD);

  // 1. Organization
  await db.query(
    `INSERT INTO organizations (id, name, primary_address, status, created_at, created_by, updated_at, updated_by, version)
     VALUES ($1, $2, $3, 'ACTIVE', NOW(), $4, NOW(), $4, 1)
     ON CONFLICT DO NOTHING`,
    [
      orgId,
      'E2E Test Organization',
      JSON.stringify({
        street: '1 Test Ln',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
      }),
      adminId,
    ]
  );

  // 2. Branch
  await db.query(
    `INSERT INTO branches (id, organization_id, name, address, status, created_at, created_by, updated_at, updated_by, version)
     VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), $5, NOW(), $5, 1)
     ON CONFLICT DO NOTHING`,
    [
      branchId,
      orgId,
      'E2E Main Branch',
      JSON.stringify({
        line1: '123 Main St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        country: 'USA',
        latitude: 30.2672,
        longitude: -97.7431,
      }),
      adminId,
    ]
  );

  // 3. Persona users (CAREGIVER and FAMILY roles are derived dynamically from
  //    caregivers / family_members portal links by portal-link-resolver.ts)
  const personaRows = [
    {
      ...E2E_PERSONAS.admin,
      dbRoles: ['SUPER_ADMIN'],
      dbPermissions: ['*:*'],
    },
    {
      ...E2E_PERSONAS.orgAdmin,
      dbRoles: ['ORG_ADMIN'],
      dbPermissions: [] as string[],
    },
    {
      ...E2E_PERSONAS.coordinator,
      dbRoles: ['COORDINATOR'],
      dbPermissions: [] as string[],
    },
    {
      ...E2E_PERSONAS.caregiver,
      dbRoles: [] as string[],
      dbPermissions: [] as string[],
    },
    {
      ...E2E_PERSONAS.family,
      dbRoles: [] as string[],
      dbPermissions: [] as string[],
    },
  ];

  for (const p of personaRows) {
    await db.query(
      `INSERT INTO users (
        id, organization_id, username, email, password_hash,
        first_name, last_name, status, roles, permissions, branch_ids,
        created_at, created_by, updated_at, updated_by, version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9, $10, NOW(), $1, NOW(), $1, 1)
      ON CONFLICT DO NOTHING`,
      [
        p.userId,
        orgId,
        p.username,
        p.email,
        passwordHash,
        p.firstName,
        p.lastName,
        p.dbRoles,
        p.dbPermissions,
        [branchId],
      ]
    );
  }

  // 4. Linked Caregiver record for CAREGIVER persona (grants dynamic CAREGIVER role)
  await db.query(
    `INSERT INTO caregivers (
      id, organization_id, primary_branch_id, branch_ids,
      first_name, last_name, employee_number, date_of_birth,
      email, primary_phone, primary_address, role, employment_type, hire_date,
      pay_rate, availability, credentials, background_check, compliance_status, status,
      user_id, portal_access_status, portal_activated_at,
      created_at, created_by, updated_at, updated_by, version
    )
    VALUES (
      $1, $2, $3, $4,
      'Jane', 'Caregiver', 'CG-E2E-001', '1985-06-15',
      $5, $6, $7, 'CAREGIVER', 'FULL_TIME', '2024-01-01',
      $8, $9, $10, $11, 'COMPLIANT', 'ACTIVE',
      $12, 'ACTIVE', NOW(),
      NOW(), $13, NOW(), $13, 1
    )
    ON CONFLICT DO NOTHING`,
    [
      E2E_UUIDS.CAREGIVER_001,
      orgId,
      branchId,
      [branchId],
      E2E_PERSONAS.caregiver.email,
      JSON.stringify({ number: '512-555-0201', type: 'MOBILE' }),
      JSON.stringify({ street: '1 Test Ln', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' }),
      JSON.stringify({ hourlyRate: 25.0, currency: 'USD' }),
      JSON.stringify({ monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }),
      JSON.stringify([]),
      JSON.stringify({}),
      E2E_UUIDS.CAREGIVER_USER,
      adminId,
    ]
  );

  // Ensure CAREGIVER_001 portal link stays intact even if a scenario seed inserted it first
  await db.query(
    `UPDATE caregivers
     SET user_id = $2, portal_access_status = 'ACTIVE', portal_activated_at = COALESCE(portal_activated_at, NOW())
     WHERE id = $1 AND (user_id IS NULL OR portal_access_status IS DISTINCT FROM 'ACTIVE')`,
    [E2E_UUIDS.CAREGIVER_001, E2E_UUIDS.CAREGIVER_USER]
  );

  // 5. Clients: CLIENT_001 (linked to FAMILY_USER) and CLIENT_002 (unlinked, for negative tests)
  const clientsToSeed = [
    {
      id: E2E_UUIDS.CLIENT_001,
      clientNumber: 'CL-E2E-001',
      firstName: 'John',
      lastName: 'Doe',
      dob: '1950-06-15',
      address: { street: '123 Main St', city: 'Austin', state: 'TX', zip: '78701', latitude: 30.2672, longitude: -97.7431 },
    },
    {
      id: E2E_UUIDS.CLIENT_002,
      clientNumber: 'CL-E2E-002',
      firstName: 'Jane',
      lastName: 'Doe',
      dob: '1945-03-20',
      address: { street: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78702', latitude: 30.2700, longitude: -97.7400 },
    },
  ];

  for (const c of clientsToSeed) {
    await db.query(
      `INSERT INTO clients (
        id, organization_id, branch_id, client_number,
        first_name, last_name, date_of_birth,
        primary_address, service_eligibility, status,
        created_at, created_by, updated_at, updated_by, version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW(), $10, NOW(), $10, 1)
      ON CONFLICT DO NOTHING`,
      [
        c.id,
        orgId,
        branchId,
        c.clientNumber,
        c.firstName,
        c.lastName,
        c.dob,
        JSON.stringify(c.address),
        JSON.stringify({}),
        adminId,
      ]
    );
  }

  // 6. Linked Family Member record for FAMILY persona (id = FAMILY_USER so FamilyDashboard resolves)
  await db.query(
    `INSERT INTO family_members (
      id, organization_id, branch_id, client_id,
      first_name, last_name, email, phone_number,
      relationship, is_primary_contact,
      preferred_contact_method, portal_access_level,
      status, invitation_status, receive_notifications,
      notification_preferences,
      user_id, portal_access_status, portal_activated_at,
      access_granted_by, created_by, updated_by
    )
    VALUES (
      $1, $2, $3, $4,
      'Family', 'Member', $5, '512-555-0104',
      'CHILD', true,
      'EMAIL', 'VIEW_DETAILED',
      'ACTIVE', 'ACCEPTED', true,
      $6,
      $1, 'ACTIVE', NOW(),
      $7, $7, $7
    )
    ON CONFLICT DO NOTHING`,
    [
      E2E_UUIDS.FAMILY_USER,
      orgId,
      branchId,
      E2E_UUIDS.CLIENT_001,
      E2E_PERSONAS.family.email,
      JSON.stringify({
        visitReminders: true,
        medicationReminders: true,
        emergencyAlerts: true,
        progressUpdates: true,
        billingNotifications: false,
      }),
      adminId,
    ]
  );
}
