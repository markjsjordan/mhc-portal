/**
 * Caregiver Assignment & Routing Service (E2 / wdvf3adf61)
 *
 * Manages caregiver-to-visit assignments, availability rules, specialty matching,
 * double-booking conflict detection, roster aggregation, and assignment audit trail.
 */

import { z } from 'zod';
import type { Database } from '@folkcare/core';

export const ASSIGNMENT_STATUSES = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const AssignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);

const DayWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
});

const UnavailableRangeSchema = z.object({
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  reason: z.string().max(255).optional(),
});

export const CaregiverAvailabilitySchema = z.object({
  weeklyHours: z.record(z.string(), z.array(DayWindowSchema)).default({}),
  unavailableDates: z.array(UnavailableRangeSchema).default([]),
  serviceSpecialties: z.array(z.string().min(1).max(100)).default([]),
});

export type CaregiverAvailabilityInput = z.infer<typeof CaregiverAvailabilitySchema>;

export const CreateAssignmentSchema = z.object({
  caregiverId: z.uuid('caregiverId must be a valid UUID'),
  visitId: z.uuid('visitId must be a valid UUID'),
  notes: z.string().max(1000).optional(),
  allowConflictOverride: z.boolean().optional().default(false),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

export const BulkAssignSchema = z.object({
  assignments: z
    .array(
      z.object({
        caregiverId: z.uuid('caregiverId must be a valid UUID'),
        visitId: z.uuid('visitId must be a valid UUID'),
        notes: z.string().max(1000).optional(),
      })
    )
    .min(1, 'At least one assignment is required')
    .max(100, 'Maximum 100 assignments per bulk request'),
  allowConflictOverride: z.boolean().optional().default(false),
});

export type BulkAssignInput = z.infer<typeof BulkAssignSchema>;

export const UpdateAssignmentStatusSchema = z.object({
  status: AssignmentStatusSchema,
  notes: z.string().max(1000).optional(),
});

export type UpdateAssignmentStatusInput = z.infer<typeof UpdateAssignmentStatusSchema>;

export const AssignmentQuerySchema = z.object({
  caregiverId: z.uuid().optional(),
  visitId: z.uuid().optional(),
  status: AssignmentStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type AssignmentQuery = z.infer<typeof AssignmentQuerySchema>;

export interface AssignmentAuditEntry {
  action: 'ASSIGNED' | 'STATUS_CHANGED' | 'UNASSIGNED';
  actorId: string;
  timestamp: string;
  previousStatus?: AssignmentStatus | null;
  newStatus?: AssignmentStatus | null;
  notes?: string;
}

export interface AssignmentRecord {
  id: string;
  organizationId: string;
  caregiverId: string;
  visitId: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: string;
  updatedBy: string | null;
  updatedAt: string;
  notes: string | null;
  conflictWarning: boolean;
  auditHistory: AssignmentAuditEntry[];
  visit?: {
    scheduledStart: string;
    scheduledEnd: string;
    visitType?: string;
    clientId?: string;
    status?: string;
  };
  caregiver?: {
    firstName?: string;
    lastName?: string;
  };
}

export interface ConflictDetail {
  assignmentId: string;
  visitId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AssignmentStatus;
}

export interface AssignmentRuleViolation {
  code: 'SPECIALTY_MISMATCH' | 'UNAVAILABLE_DATE' | 'OUTSIDE_WEEKLY_HOURS' | 'TIME_CONFLICT';
  message: string;
  conflicts?: ConflictDetail[];
}

export class AssignmentConflictError extends Error {
  public readonly statusCode = 409;
  public readonly violations: AssignmentRuleViolation[];

  constructor(message: string, violations: AssignmentRuleViolation[]) {
    super(message);
    this.name = 'AssignmentConflictError';
    this.violations = violations;
  }
}

export class AssignmentNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'AssignmentNotFoundError';
  }
}

export class AssignmentForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'AssignmentForbiddenError';
  }
}

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function hasTimeOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && endA > startB;
}

export function checkSpecialtyMatch(
  caregiverSpecialties: string[] | undefined,
  visitServiceType: string | undefined
): boolean {
  if (
    visitServiceType === undefined ||
    visitServiceType.trim() === '' ||
    caregiverSpecialties === undefined ||
    caregiverSpecialties.length === 0
  ) {
    return true;
  }
  const normalizedTarget = visitServiceType.trim().toLowerCase();
  return caregiverSpecialties.some(
    (s) => s.trim().toLowerCase() === normalizedTarget
  );
}

export function checkAvailabilityWindow(
  availability: CaregiverAvailabilityInput | null,
  scheduledStart: Date,
  scheduledEnd: Date
): AssignmentRuleViolation[] {
  if (availability === null) {
    return [];
  }

  const violations: AssignmentRuleViolation[] = [];
  const visitDateStr = scheduledStart.toISOString().slice(0, 10);

  // Check unavailable date ranges
  for (const range of availability.unavailableDates) {
    const startStr = range.startDate.slice(0, 10);
    const endStr = range.endDate.slice(0, 10);
    if (visitDateStr >= startStr && visitDateStr <= endStr) {
      const reasonSuffix =
        range.reason !== undefined && range.reason !== '' ? ` (${range.reason})` : '';
      violations.push({
        code: 'UNAVAILABLE_DATE',
        message: `Caregiver is unavailable on ${visitDateStr}${reasonSuffix}`,
      });
      break;
    }
  }

  // Check weekly hours if configured
  const weeklyHours = availability.weeklyHours;
  const hasAnyWeeklyHours = Object.keys(weeklyHours).length > 0;
  if (hasAnyWeeklyHours) {
    const dayName = DAY_NAMES[scheduledStart.getUTCDay()] ?? 'sunday';
    const dayEntry = Object.entries(weeklyHours).find(([k]) => k === dayName);
    const dayWindows = dayEntry !== undefined ? dayEntry[1] : [];
    const startHHMM = scheduledStart.toISOString().slice(11, 16);
    const endHHMM = scheduledEnd.toISOString().slice(11, 16);

    const fitsWindow = dayWindows.some(
      (w: { start: string; end: string }) => startHHMM >= w.start && endHHMM <= w.end
    );
    if (!fitsWindow) {
      violations.push({
        code: 'OUTSIDE_WEEKLY_HOURS',
        message: `Visit (${dayName} ${startHHMM}-${endHHMM} UTC) falls outside caregiver weekly availability`,
      });
    }
  }

  return violations;
}

interface RawAssignmentRow extends Record<string, unknown> {
  id: string;
  organization_id: string;
  caregiver_id: string;
  visit_id: string;
  status: AssignmentStatus;
  assigned_by: string;
  assigned_at: Date | string;
  updated_by: string | null;
  updated_at: Date | string;
  notes: string | null;
  conflict_warning: boolean;
  audit_history: AssignmentAuditEntry[] | string | null;
  scheduled_start?: Date | string | null;
  scheduled_end?: Date | string | null;
  visit_type?: string | null;
  client_id?: string | null;
  visit_status?: string | null;
  caregiver_first_name?: string | null;
  caregiver_last_name?: string | null;
}

function parseAuditHistory(
  raw: AssignmentAuditEntry[] | string | null | undefined
): AssignmentAuditEntry[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    return JSON.parse(raw) as AssignmentAuditEntry[];
  }
  return [];
}

function mapAssignmentRow(row: RawAssignmentRow): AssignmentRecord {
  const auditHistory = parseAuditHistory(row.audit_history);

  const record: AssignmentRecord = {
    id: row.id,
    organizationId: row.organization_id,
    caregiverId: row.caregiver_id,
    visitId: row.visit_id,
    status: row.status,
    assignedBy: row.assigned_by,
    assignedAt:
      row.assigned_at instanceof Date
        ? row.assigned_at.toISOString()
        : String(row.assigned_at),
    updatedBy: row.updated_by,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    notes: row.notes,
    conflictWarning: Boolean(row.conflict_warning),
    auditHistory,
  };

  if (
    row.scheduled_start !== undefined &&
    row.scheduled_start !== null &&
    row.scheduled_end !== undefined &&
    row.scheduled_end !== null
  ) {
    record.visit = {
      scheduledStart:
        row.scheduled_start instanceof Date
          ? row.scheduled_start.toISOString()
          : String(row.scheduled_start),
      scheduledEnd:
        row.scheduled_end instanceof Date
          ? row.scheduled_end.toISOString()
          : String(row.scheduled_end),
      visitType: row.visit_type ?? undefined,
      clientId: row.client_id ?? undefined,
      status: row.visit_status ?? undefined,
    };
  }

  const hasCaregiverName =
    (row.caregiver_first_name !== undefined &&
      row.caregiver_first_name !== null &&
      row.caregiver_first_name !== '') ||
    (row.caregiver_last_name !== undefined &&
      row.caregiver_last_name !== null &&
      row.caregiver_last_name !== '');

  if (hasCaregiverName) {
    record.caregiver = {
      firstName: row.caregiver_first_name ?? undefined,
      lastName: row.caregiver_last_name ?? undefined,
    };
  }

  return record;
}

export class AssignmentService {
  constructor(private readonly db: Database) {}

  async getAvailability(
    organizationId: string,
    caregiverId: string
  ): Promise<CaregiverAvailabilityInput | null> {
    const result = await this.db.query<{
      weekly_hours: CaregiverAvailabilityInput['weeklyHours'] | null;
      unavailable_dates: CaregiverAvailabilityInput['unavailableDates'] | null;
      service_specialties: string[] | null;
    }>(
      `SELECT weekly_hours, unavailable_dates, service_specialties
       FROM caregiver_availability
       WHERE organization_id = $1 AND caregiver_id = $2`,
      [organizationId, caregiverId]
    );

    const row = result.rows[0];
    if (row === undefined) {
      return null;
    }

    return {
      weeklyHours: row.weekly_hours ?? {},
      unavailableDates: row.unavailable_dates ?? [],
      serviceSpecialties: row.service_specialties ?? [],
    };
  }

  async upsertAvailability(
    organizationId: string,
    caregiverId: string,
    actorUserId: string,
    input: CaregiverAvailabilityInput
  ): Promise<CaregiverAvailabilityInput> {
    await this.db.query(
      `INSERT INTO caregiver_availability
         (organization_id, caregiver_id, weekly_hours, unavailable_dates, service_specialties, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::text[], $6, NOW())
       ON CONFLICT (organization_id, caregiver_id)
       DO UPDATE SET
         weekly_hours = EXCLUDED.weekly_hours,
         unavailable_dates = EXCLUDED.unavailable_dates,
         service_specialties = EXCLUDED.service_specialties,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        organizationId,
        caregiverId,
        JSON.stringify(input.weeklyHours),
        JSON.stringify(input.unavailableDates),
        input.serviceSpecialties,
        actorUserId,
      ]
    );

    return input;
  }

  async assignCaregiver(
    organizationId: string,
    actorUserId: string,
    input: CreateAssignmentInput
  ): Promise<{ assignment: AssignmentRecord; warnings: AssignmentRuleViolation[] }> {
    // 1. Load visit within org
    const visitResult = await this.db.query<{
      id: string;
      scheduled_start: Date | string;
      scheduled_end: Date | string;
      visit_type: string | null;
    }>(
      `SELECT
         id,
         (scheduled_date + scheduled_start_time) AS scheduled_start,
         (scheduled_date + scheduled_end_time) AS scheduled_end,
         visit_type
       FROM visits
       WHERE id = $1 AND organization_id = $2`,
      [input.visitId, organizationId]
    );

    const visit = visitResult.rows[0];
    if (visit === undefined) {
      throw new AssignmentNotFoundError(`Visit ${input.visitId} not found in organization`);
    }

    const scheduledStart = new Date(visit.scheduled_start);
    const scheduledEnd = new Date(visit.scheduled_end);

    // 2. Check availability & specialty
    const availability = await this.getAvailability(organizationId, input.caregiverId);
    const violations: AssignmentRuleViolation[] = [];

    if (
      availability !== null &&
      !checkSpecialtyMatch(availability.serviceSpecialties, visit.visit_type ?? undefined)
    ) {
      violations.push({
        code: 'SPECIALTY_MISMATCH',
        message: `Caregiver specialties do not include required service type '${visit.visit_type}'`,
      });
    }

    violations.push(
      ...checkAvailabilityWindow(availability, scheduledStart, scheduledEnd)
    );

    // 3. Check overlapping assignments for double-booking
    const overlapResult = await this.db.query<{
      id: string;
      visit_id: string;
      status: AssignmentStatus;
      scheduled_start: Date | string;
      scheduled_end: Date | string;
    }>(
      `SELECT
         a.id,
         a.visit_id,
         a.status,
         (v.scheduled_date + v.scheduled_start_time) AS scheduled_start,
         (v.scheduled_date + v.scheduled_end_time) AS scheduled_end
       FROM assignments a
       JOIN visits v ON v.id = a.visit_id
       WHERE a.organization_id = $1
         AND a.caregiver_id = $2
         AND a.status != 'CANCELLED'
         AND a.visit_id != $3
         AND (v.scheduled_date + v.scheduled_start_time) < $5
         AND (v.scheduled_date + v.scheduled_end_time) > $4`,
      [
        organizationId,
        input.caregiverId,
        input.visitId,
        scheduledStart.toISOString(),
        scheduledEnd.toISOString(),
      ]
    );

    if (overlapResult.rows.length > 0) {
      const conflicts: ConflictDetail[] = overlapResult.rows.map((r) => ({
        assignmentId: r.id,
        visitId: r.visit_id,
        scheduledStart:
          r.scheduled_start instanceof Date
            ? r.scheduled_start.toISOString()
            : String(r.scheduled_start),
        scheduledEnd:
          r.scheduled_end instanceof Date
            ? r.scheduled_end.toISOString()
            : String(r.scheduled_end),
        status: r.status,
      }));
      violations.push({
        code: 'TIME_CONFLICT',
        message: `Caregiver already has ${conflicts.length} overlapping assignment(s) during this time slot`,
        conflicts,
      });
    }

    if (violations.length > 0 && !input.allowConflictOverride) {
      throw new AssignmentConflictError(
        violations.map((v) => v.message).join('; '),
        violations
      );
    }

    const nowIso = new Date().toISOString();
    const auditEntry: AssignmentAuditEntry = {
      action: 'ASSIGNED',
      actorId: actorUserId,
      timestamp: nowIso,
      previousStatus: null,
      newStatus: 'PENDING_ACCEPTANCE',
      notes: input.notes,
    };

    const insertResult = await this.db.query<RawAssignmentRow>(
      `INSERT INTO assignments
         (organization_id, caregiver_id, visit_id, status, assigned_by, assigned_at, updated_by, updated_at, notes, conflict_warning, audit_history)
       VALUES ($1, $2, $3, 'PENDING_ACCEPTANCE', $4, NOW(), $4, NOW(), $5, $6, $7::jsonb)
       RETURNING *`,
      [
        organizationId,
        input.caregiverId,
        input.visitId,
        actorUserId,
        input.notes ?? null,
        violations.length > 0,
        JSON.stringify([auditEntry]),
      ]
    );

    // Keep visits.caregiver_id synchronized for existing schedule views
    await this.db.query(
      `UPDATE visits SET caregiver_id = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
      [input.caregiverId, input.visitId, organizationId]
    );

    return {
      assignment: mapAssignmentRow(insertResult.rows[0]!),
      warnings: violations,
    };
  }

  async bulkAssign(
    organizationId: string,
    actorUserId: string,
    input: BulkAssignInput
  ): Promise<{
    assigned: AssignmentRecord[];
    failed: Array<{ caregiverId: string; visitId: string; error: string }>;
  }> {
    const assigned: AssignmentRecord[] = [];
    const failed: Array<{ caregiverId: string; visitId: string; error: string }> = [];

    for (const item of input.assignments) {
      try {
        const result = await this.assignCaregiver(organizationId, actorUserId, {
          caregiverId: item.caregiverId,
          visitId: item.visitId,
          notes: item.notes,
          allowConflictOverride: input.allowConflictOverride,
        });
        assigned.push(result.assignment);
      } catch (err) {
        failed.push({
          caregiverId: item.caregiverId,
          visitId: item.visitId,
          error: err instanceof Error ? err.message : 'Failed to assign caregiver',
        });
      }
    }

    return { assigned, failed };
  }

  async listAssignments(
    organizationId: string,
    query: AssignmentQuery,
    caregiverFilterId?: string
  ): Promise<{ assignments: AssignmentRecord[]; total: number }> {
    const conditions: string[] = ['a.organization_id = $1'];
    const params: unknown[] = [organizationId];
    let idx = 2;

    const effectiveCaregiverId = caregiverFilterId ?? query.caregiverId;
    if (effectiveCaregiverId !== undefined && effectiveCaregiverId !== '') {
      conditions.push(`a.caregiver_id = $${idx++}`);
      params.push(effectiveCaregiverId);
    }

    if (query.visitId !== undefined && query.visitId !== '') {
      conditions.push(`a.visit_id = $${idx++}`);
      params.push(query.visitId);
    }

    if (query.status !== undefined) {
      conditions.push(`a.status = $${idx++}`);
      params.push(query.status);
    }

    if (query.startDate !== undefined && query.startDate !== '') {
      conditions.push(`v.scheduled_date >= $${idx++}`);
      params.push(query.startDate);
    }

    if (query.endDate !== undefined && query.endDate !== '') {
      conditions.push(`v.scheduled_date <= $${idx++}`);
      params.push(query.endDate);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM assignments a
       LEFT JOIN visits v ON v.id = a.visit_id
       WHERE ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    const rowsResult = await this.db.query<RawAssignmentRow>(
      `SELECT
         a.*,
         (v.scheduled_date + v.scheduled_start_time) AS scheduled_start,
         (v.scheduled_date + v.scheduled_end_time) AS scheduled_end,
         v.visit_type,
         v.client_id,
         v.status AS visit_status,
         c.first_name AS caregiver_first_name,
         c.last_name AS caregiver_last_name
       FROM assignments a
       LEFT JOIN visits v ON v.id = a.visit_id
       LEFT JOIN caregivers c ON c.id = a.caregiver_id
       WHERE ${whereClause}
       ORDER BY COALESCE((v.scheduled_date + v.scheduled_start_time), a.assigned_at) ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, query.limit, query.offset]
    );

    return {
      assignments: rowsResult.rows.map(mapAssignmentRow),
      total,
    };
  }

  async getRoster(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<
    Array<{
      caregiverId: string;
      caregiverName: string;
      assignments: AssignmentRecord[];
    }>
  > {
    const { assignments } = await this.listAssignments(organizationId, {
      startDate,
      endDate,
      limit: 200,
      offset: 0,
    });

    const grouped = new Map<
      string,
      { caregiverId: string; caregiverName: string; assignments: AssignmentRecord[] }
    >();

    for (const assignment of assignments) {
      const existing = grouped.get(assignment.caregiverId);
      const joinedName = [assignment.caregiver?.firstName, assignment.caregiver?.lastName]
        .filter((part): part is string => part !== undefined && part !== '')
        .join(' ');
      const name = joinedName !== '' ? joinedName : assignment.caregiverId;

      if (existing !== undefined) {
        existing.assignments.push(assignment);
      } else {
        grouped.set(assignment.caregiverId, {
          caregiverId: assignment.caregiverId,
          caregiverName: name,
          assignments: [assignment],
        });
      }
    }

    return Array.from(grouped.values());
  }

  async updateStatus(
    organizationId: string,
    assignmentId: string,
    actorUserId: string,
    input: UpdateAssignmentStatusInput,
    caregiverFilterId?: string
  ): Promise<AssignmentRecord> {
    const existingResult = await this.db.query<RawAssignmentRow>(
      `SELECT * FROM assignments WHERE id = $1 AND organization_id = $2`,
      [assignmentId, organizationId]
    );

    const existing = existingResult.rows[0];
    if (existing === undefined) {
      throw new AssignmentNotFoundError(`Assignment ${assignmentId} not found`);
    }

    if (
      caregiverFilterId !== undefined &&
      caregiverFilterId !== '' &&
      existing.caregiver_id !== caregiverFilterId
    ) {
      throw new AssignmentForbiddenError('Caregivers can only update their own assignments');
    }

    const currentHistory = parseAuditHistory(existing.audit_history);

    const updatedHistory: AssignmentAuditEntry[] = [
      ...currentHistory,
      {
        action: 'STATUS_CHANGED',
        actorId: actorUserId,
        timestamp: new Date().toISOString(),
        previousStatus: existing.status,
        newStatus: input.status,
        notes: input.notes,
      },
    ];

    const updatedResult = await this.db.query<RawAssignmentRow>(
      `UPDATE assignments
       SET status = $1,
           updated_by = $2,
           updated_at = NOW(),
           notes = COALESCE($3, notes),
           audit_history = $4::jsonb
       WHERE id = $5 AND organization_id = $6
       RETURNING *`,
      [
        input.status,
        actorUserId,
        input.notes ?? null,
        JSON.stringify(updatedHistory),
        assignmentId,
        organizationId,
      ]
    );

    return mapAssignmentRow(updatedResult.rows[0]!);
  }

  async unassign(
    organizationId: string,
    assignmentId: string,
    actorUserId: string
  ): Promise<AssignmentRecord> {
    return this.updateStatus(organizationId, assignmentId, actorUserId, {
      status: 'CANCELLED',
      notes: 'Unassigned by coordinator',
    });
  }
}
