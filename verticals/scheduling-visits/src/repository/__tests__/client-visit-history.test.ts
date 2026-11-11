/**
 * Tests for ScheduleRepository.getClientVisitHistory
 * 
 * Covers client scoping, org isolation, pagination, >31-day history, and soft-delete filtering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ScheduleRepository } from '../schedule-repository';
import { randomUUID } from 'node:crypto';

describe('ScheduleRepository.getClientVisitHistory', () => {
  let pool: Pool;
  let repository: ScheduleRepository;
  let testOrgId: string;
  let testBranchId: string;
  let testClientId: string;
  let otherOrgId: string;
  let otherClientId: string;

  beforeAll(async () => {
    const connectionString =
      process.env.DATABASE_URL ?? 'postgresql://postgres:***@localhost:5432/folk-care-0';
    pool = new Pool({ connectionString });
    repository = new ScheduleRepository(pool);

    // Setup test data
    testOrgId = randomUUID();
    testBranchId = randomUUID();
    testClientId = randomUUID();
    otherOrgId = randomUUID();
    otherClientId = randomUUID();

    // Create test visits for the target client
    const visitDates = [
      new Date('2024-01-15'), // > 31 days ago
      new Date('2024-11-01'),
      new Date('2024-11-10'),
      new Date('2024-11-11'),
    ];

    for (const scheduledDate of visitDates) {
      await pool.query(
        `INSERT INTO visits (
          id, organization_id, branch_id, client_id,
          visit_number, visit_type, service_type_id, service_type_name,
          scheduled_date, scheduled_start_time, scheduled_end_time,
          scheduled_duration, timezone, address, status, status_history,
          is_urgent, is_priority, requires_supervision, assignment_method,
          signature_required, created_at, created_by, updated_at, updated_by, version
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'REGULAR', gen_random_uuid(), 'Personal Care',
          $5, '09:00', '10:00', 60, 'America/Chicago', '{}', 'COMPLETED', '[]',
          false, false, false, 'MANUAL', true, NOW(), $6, NOW(), $6, 1
        )`,
        [testOrgId, testBranchId, testClientId, `V2024-${Math.random()}`, scheduledDate, randomUUID()]
      );
    }

    // Create a soft-deleted visit (should be excluded)
    await pool.query(
      `INSERT INTO visits (
        id, organization_id, branch_id, client_id,
        visit_number, visit_type, service_type_id, service_type_name,
        scheduled_date, scheduled_start_time, scheduled_end_time,
        scheduled_duration, timezone, address, status, status_history,
        is_urgent, is_priority, requires_supervision, assignment_method,
        signature_required, created_at, created_by, updated_at, updated_by, version,
        deleted_at, deleted_by
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 'REGULAR', gen_random_uuid(), 'Personal Care',
        '2024-11-12', '09:00', '10:00', 60, 'America/Chicago', '{}', 'COMPLETED', '[]',
        false, false, false, 'MANUAL', true, NOW(), $5, NOW(), $5, 1, NOW(), $5
      )`,
      [testOrgId, testBranchId, testClientId, `V2024-DELETED-${Math.random()}`, randomUUID()]
    );

    // Create a visit for a different client in the same org (should be excluded)
    await pool.query(
      `INSERT INTO visits (
        id, organization_id, branch_id, client_id,
        visit_number, visit_type, service_type_id, service_type_name,
        scheduled_date, scheduled_start_time, scheduled_end_time,
        scheduled_duration, timezone, address, status, status_history,
        is_urgent, is_priority, requires_supervision, assignment_method,
        signature_required, created_at, created_by, updated_at, updated_by, version
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 'REGULAR', gen_random_uuid(), 'Personal Care',
        '2024-11-11', '09:00', '10:00', 60, 'America/Chicago', '{}', 'COMPLETED', '[]',
        false, false, false, 'MANUAL', true, NOW(), $5, NOW(), $5, 1
      )`,
      [testOrgId, testBranchId, otherClientId, `V2024-OTHER-${Math.random()}`, randomUUID()]
    );

    // Create a visit for the same client in a different org (should be excluded)
    await pool.query(
      `INSERT INTO visits (
        id, organization_id, branch_id, client_id,
        visit_number, visit_type, service_type_id, service_type_name,
        scheduled_date, scheduled_start_time, scheduled_end_time,
        scheduled_duration, timezone, address, status, status_history,
        is_urgent, is_priority, requires_supervision, assignment_method,
        signature_required, created_at, created_by, updated_at, updated_by, version
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 'REGULAR', gen_random_uuid(), 'Personal Care',
        '2024-11-11', '09:00', '10:00', 60, 'America/Chicago', '{}', 'COMPLETED', '[]',
        false, false, false, 'MANUAL', true, NOW(), $5, NOW(), $5, 1
      )`,
      [otherOrgId, testBranchId, testClientId, `V2024-XORG-${Math.random()}`, randomUUID()]
    );
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM visits WHERE organization_id = $1 OR organization_id = $2', [
      testOrgId,
      otherOrgId,
    ]);
    await pool.end();
  });

  it('should return paginated visit history for a client', async () => {
    const result = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(4);
    expect(result.total).toBe(4);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it('should return visits sorted by scheduled_date DESC', async () => {
    const result = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    const dates = result.items.map((v) => v.scheduledDate);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(new Date(dates[i]) >= new Date(dates[i + 1])).toBe(true);
    }
  });

  it('should support pagination', async () => {
    const page1 = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 2,
    });
    const page2 = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 2,
      limit: 2,
    });

    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.total).toBe(4);
    expect(page2.total).toBe(4);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
  });

  it('should return visits older than 31 days', async () => {
    const result = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    const oldVisit = result.items.find(
      (v) => new Date(v.scheduledDate).getTime() < new Date('2024-10-10').getTime()
    );
    expect(oldVisit).toBeDefined();
  });

  it('should exclude soft-deleted visits', async () => {
    const result = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    const deletedVisit = result.items.find((v) => v.visitNumber.includes('DELETED'));
    expect(deletedVisit).toBeUndefined();
  });

  it('should enforce organization scoping', async () => {
    const result = await repository.getClientVisitHistory(testClientId, otherOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should enforce client scoping', async () => {
    const result = await repository.getClientVisitHistory(otherClientId, testOrgId, undefined, {
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(1); // Only the visit we created for otherClientId
  });

  it('should respect branch filtering when branchIds provided', async () => {
    const differentBranchId = randomUUID();
    const result = await repository.getClientVisitHistory(
      testClientId,
      testOrgId,
      [differentBranchId],
      { page: 1, limit: 10 }
    );

    expect(result.items).toHaveLength(0);
  });

  it('should return minimum necessary fields (no internal_notes, risk_flags)', async () => {
    const result = await repository.getClientVisitHistory(testClientId, testOrgId, undefined, {
      page: 1,
      limit: 1,
    });

    const visit = result.items[0];
    expect(visit).toBeDefined();
    expect(visit.id).toBeDefined();
    expect(visit.visitNumber).toBeDefined();
    expect(visit.serviceTypeName).toBeDefined();
    expect(visit.status).toBeDefined();
    expect(visit.statusHistory).toBeDefined();
    // These fields should NOT be present
    expect((visit as any).internalNotes).toBeUndefined();
    expect((visit as any).riskFlags).toBeUndefined();
    expect((visit as any).caregiverInstructions).toBeUndefined();
  });
});
