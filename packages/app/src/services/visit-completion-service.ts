/**
 * Visit Documentation & Completion Service (E3 / wdvf3adf62)
 *
 * Handles visit completion submission (tasks, observations, adverse events,
 * time in/out, actual vs scheduled duration, PIN/signature identity confirmation),
 * status transitions (ASSIGNED/SCHEDULED/CONFIRMED/IN_PROGRESS -> COMPLETED | NO_SHOW),
 * coordinator post-submit review & corrections, and immutable completion audit trails.
 */

import crypto from 'node:crypto';
import { z } from 'zod';
import type { Database } from '@folkcare/core';

export const COMPLETION_OUTCOMES = ['COMPLETED', 'NO_SHOW'] as const;
export type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number];

export const CONFIRMATION_METHODS = ['PIN', 'SIGNATURE'] as const;
export type ConfirmationMethod = (typeof CONFIRMATION_METHODS)[number];

const COMPLETABLE_VISIT_STATUSES = new Set([
  'ASSIGNED',
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
]);

export const CompletedTaskSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  completed: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export type CompletedTask = z.infer<typeof CompletedTaskSchema>;

export const CompleteVisitSchema = z
  .object({
    outcome: z.enum(COMPLETION_OUTCOMES).default('COMPLETED'),
    tasksCompleted: z.array(CompletedTaskSchema).default([]),
    observations: z.string().max(5000).optional(),
    adverseEvents: z.string().max(5000).optional(),
    timeIn: z.string().min(1, 'timeIn is required'),
    timeOut: z.string().min(1, 'timeOut is required'),
    caregiverId: z.uuid('caregiverId must be a valid UUID').optional(),
    confirmationMethod: z.enum(CONFIRMATION_METHODS).default('PIN'),
    confirmationPin: z
      .string()
      .regex(/^\d{4,8}$/, 'confirmationPin must be 4 to 8 digits')
      .optional(),
    signatureName: z.string().min(2).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.timeIn);
    const end = Date.parse(data.timeOut);
    if (Number.isNaN(start)) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeIn'],
        message: 'timeIn must be a valid ISO-8601 timestamp',
      });
    }
    if (Number.isNaN(end)) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeOut'],
        message: 'timeOut must be a valid ISO-8601 timestamp',
      });
    }
    if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeOut'],
        message: 'timeOut must be greater than or equal to timeIn',
      });
    }

    if (data.outcome === 'COMPLETED') {
      if (data.confirmationMethod === 'PIN' && (data.confirmationPin === undefined || data.confirmationPin.length === 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmationPin'],
          message: 'confirmationPin is required when confirmationMethod is PIN',
        });
      }
      if (data.confirmationMethod === 'SIGNATURE' && (data.signatureName === undefined || data.signatureName.length === 0)) {
        ctx.addIssue({
          code: 'custom',
          path: ['signatureName'],
          message: 'signatureName is required when confirmationMethod is SIGNATURE',
        });
      }
    }
  });

export type CompleteVisitInput = z.infer<typeof CompleteVisitSchema>;

export const EditVisitCompletionSchema = z
  .object({
    tasksCompleted: z.array(CompletedTaskSchema).optional(),
    observations: z.string().max(5000).optional(),
    adverseEvents: z.string().max(5000).optional(),
    timeIn: z.string().min(1).optional(),
    timeOut: z.string().min(1).optional(),
    editReason: z.string().min(3, 'editReason must be at least 3 characters').max(1000),
  })
  .superRefine((data, ctx) => {
    if (data.timeIn !== undefined && Number.isNaN(Date.parse(data.timeIn))) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeIn'],
        message: 'timeIn must be a valid ISO-8601 timestamp',
      });
    }
    if (data.timeOut !== undefined && Number.isNaN(Date.parse(data.timeOut))) {
      ctx.addIssue({
        code: 'custom',
        path: ['timeOut'],
        message: 'timeOut must be a valid ISO-8601 timestamp',
      });
    }
  });

export type EditVisitCompletionInput = z.infer<typeof EditVisitCompletionSchema>;

export interface CompletionAuditEntry {
  action: 'COMPLETED' | 'NO_SHOW' | 'EDITED';
  actorId: string;
  actorRoles: string[];
  timestamp: string;
  reason?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  summary?: string;
}

export interface VisitCompletionRecord {
  id: string;
  organizationId: string;
  visitId: string;
  caregiverId: string | null;
  outcome: CompletionOutcome;
  tasksCompleted: CompletedTask[];
  observations: string | null;
  adverseEvents: string | null;
  timeIn: string;
  timeOut: string;
  actualDuration: number;
  scheduledDuration: number;
  durationVariance: number;
  confirmationMethod: ConfirmationMethod;
  confirmedBy: string;
  confirmedAt: string;
  auditHistory: CompletionAuditEntry[];
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface CompletionActor {
  userId: string;
  roles: string[];
  caregiverId?: string;
}

export class VisitCompletionError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'VisitCompletionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function calculateActualDurationMinutes(timeIn: string, timeOut: string): number {
  const startMs = Date.parse(timeIn);
  const endMs = Date.parse(timeOut);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new VisitCompletionError(
      'Invalid timeIn or timeOut timestamp',
      400,
      'INVALID_TIMESTAMPS'
    );
  }
  if (endMs < startMs) {
    throw new VisitCompletionError(
      'timeOut must be greater than or equal to timeIn',
      400,
      'INVALID_TIME_RANGE'
    );
  }
  return Math.round((endMs - startMs) / 60000);
}

export function hashConfirmationValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

interface VisitCompletionRow extends Record<string, unknown> {
  id: string;
  organization_id: string;
  visit_id: string;
  caregiver_id: string | null;
  outcome: CompletionOutcome;
  tasks_completed: CompletedTask[] | string;
  observations: string | null;
  adverse_events: string | null;
  time_in: Date | string;
  time_out: Date | string;
  actual_duration: number;
  scheduled_duration: number;
  duration_variance: number;
  confirmation_method: ConfirmationMethod;
  confirmed_by: string;
  confirmed_at: Date | string;
  audit_history: CompletionAuditEntry[] | string;
  created_by: string;
  created_at: Date | string;
  updated_by: string | null;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapCompletionRow(row: VisitCompletionRow): VisitCompletionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    visitId: row.visit_id,
    caregiverId: row.caregiver_id,
    outcome: row.outcome,
    tasksCompleted: parseJsonArray<CompletedTask>(row.tasks_completed),
    observations: row.observations,
    adverseEvents: row.adverse_events,
    timeIn: toIso(row.time_in),
    timeOut: toIso(row.time_out),
    actualDuration: Number(row.actual_duration),
    scheduledDuration: Number(row.scheduled_duration),
    durationVariance: Number(row.duration_variance),
    confirmationMethod: row.confirmation_method,
    confirmedBy: row.confirmed_by,
    confirmedAt: toIso(row.confirmed_at),
    auditHistory: parseJsonArray<CompletionAuditEntry>(row.audit_history),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedBy: row.updated_by,
    updatedAt: toIso(row.updated_at),
  };
}

export class VisitCompletionService {
  constructor(private readonly db: Database) {}

  async completeVisit(
    organizationId: string,
    visitId: string,
    input: CompleteVisitInput,
    actor: CompletionActor
  ): Promise<VisitCompletionRecord> {
    const visitResult = await this.db.query<{
      id: string;
      status: string;
      scheduled_duration: number | null;
      assigned_caregiver_id: string | null;
    }>(
      `SELECT id, status, scheduled_duration, assigned_caregiver_id
       FROM visits
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [visitId, organizationId]
    );

    const visit = visitResult.rows[0];
    if (visit === undefined) {
      throw new VisitCompletionError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }
    if (!COMPLETABLE_VISIT_STATUSES.has(visit.status)) {
      throw new VisitCompletionError(
        `Cannot complete visit with status ${visit.status}. Allowed statuses: ${Array.from(COMPLETABLE_VISIT_STATUSES).join(', ')}`,
        409,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const actualDuration = calculateActualDurationMinutes(input.timeIn, input.timeOut);
    const scheduledDuration = Number(visit.scheduled_duration ?? 60);
    const durationVariance = actualDuration - scheduledDuration;
    const caregiverId = input.caregiverId ?? visit.assigned_caregiver_id ?? actor.caregiverId ?? null;
    const rawConfirmation =
      input.confirmationMethod === 'PIN' ? input.confirmationPin : input.signatureName;
    const confirmationHash =
      rawConfirmation !== undefined && rawConfirmation.length > 0
        ? hashConfirmationValue(rawConfirmation)
        : null;

    const nowIso = new Date().toISOString();
    const completedCount = input.tasksCompleted.filter((t) => t.completed).length;
    const totalCount = input.tasksCompleted.length;
    const hasAdverseEvents =
      input.adverseEvents !== undefined && input.adverseEvents.trim().length > 0;

    const initialAuditEntry: CompletionAuditEntry = {
      action: input.outcome,
      actorId: actor.userId,
      actorRoles: actor.roles,
      timestamp: nowIso,
      summary: `Visit marked ${input.outcome} (${completedCount}/${totalCount} tasks, ${actualDuration}m actual vs ${scheduledDuration}m scheduled)`,
    };

    const completionResult = await this.db.query<VisitCompletionRow>(
      `INSERT INTO visit_completions (
        organization_id,
        visit_id,
        caregiver_id,
        outcome,
        tasks_completed,
        observations,
        adverse_events,
        time_in,
        time_out,
        actual_duration,
        scheduled_duration,
        duration_variance,
        confirmation_method,
        confirmation_value_hash,
        confirmed_by,
        confirmed_at,
        audit_history,
        created_by,
        created_at,
        updated_by,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $16, $18, $16
      )
      RETURNING *`,
      [
        organizationId,
        visitId,
        caregiverId,
        input.outcome,
        JSON.stringify(input.tasksCompleted),
        input.observations ?? null,
        input.adverseEvents ?? null,
        input.timeIn,
        input.timeOut,
        actualDuration,
        scheduledDuration,
        durationVariance,
        input.confirmationMethod,
        confirmationHash,
        actor.userId,
        nowIso,
        JSON.stringify([initialAuditEntry]),
        actor.userId,
      ]
    );

    await this.db.query(
      `UPDATE visits
       SET status = $1,
           actual_start_time = $2,
           actual_end_time = $3,
           actual_duration = $4,
           completed_at = $5,
           completion_notes = $6,
           tasks_completed = $7,
           tasks_total = $8,
           incident_reported = $9,
           updated_by = $10,
           updated_at = NOW()
       WHERE id = $11 AND organization_id = $12 AND deleted_at IS NULL`,
      [
        input.outcome,
        input.timeIn,
        input.timeOut,
        actualDuration,
        nowIso,
        input.observations ?? null,
        completedCount,
        totalCount,
        hasAdverseEvents,
        actor.userId,
        visitId,
        organizationId,
      ]
    );

    const inserted = completionResult.rows[0];
    if (inserted === undefined) {
      throw new VisitCompletionError(
        'Failed to create visit completion record',
        500,
        'COMPLETION_INSERT_FAILED'
      );
    }

    return mapCompletionRow(inserted);
  }

  async getCompletion(
    organizationId: string,
    visitId: string
  ): Promise<VisitCompletionRecord | null> {
    const result = await this.db.query<VisitCompletionRow>(
      `SELECT *
       FROM visit_completions
       WHERE organization_id = $1 AND visit_id = $2`,
      [organizationId, visitId]
    );

    const row = result.rows[0];
    if (row === undefined) {
      return null;
    }

    return mapCompletionRow(row);
  }

  async editCompletion(
    organizationId: string,
    visitId: string,
    input: EditVisitCompletionInput,
    actor: CompletionActor
  ): Promise<VisitCompletionRecord> {
    const existing = await this.getCompletion(organizationId, visitId);
    if (existing === null) {
      throw new VisitCompletionError(
        'Visit completion record not found',
        404,
        'COMPLETION_NOT_FOUND'
      );
    }

    const nextTimeIn = input.timeIn ?? existing.timeIn;
    const nextTimeOut = input.timeOut ?? existing.timeOut;
    const nextActualDuration = calculateActualDurationMinutes(nextTimeIn, nextTimeOut);
    const nextDurationVariance = nextActualDuration - existing.scheduledDuration;
    const nextTasks = input.tasksCompleted ?? existing.tasksCompleted;
    const nextObservations =
      input.observations !== undefined ? input.observations : existing.observations;
    const nextAdverseEvents =
      input.adverseEvents !== undefined ? input.adverseEvents : existing.adverseEvents;

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (input.tasksCompleted !== undefined) {
      changes.tasksCompleted = { before: existing.tasksCompleted, after: nextTasks };
    }
    if (input.observations !== undefined && input.observations !== existing.observations) {
      changes.observations = { before: existing.observations, after: nextObservations };
    }
    if (input.adverseEvents !== undefined && input.adverseEvents !== existing.adverseEvents) {
      changes.adverseEvents = { before: existing.adverseEvents, after: nextAdverseEvents };
    }
    if (nextTimeIn !== existing.timeIn) {
      changes.timeIn = { before: existing.timeIn, after: nextTimeIn };
    }
    if (nextTimeOut !== existing.timeOut) {
      changes.timeOut = { before: existing.timeOut, after: nextTimeOut };
    }
    if (nextActualDuration !== existing.actualDuration) {
      changes.actualDuration = { before: existing.actualDuration, after: nextActualDuration };
    }

    const nowIso = new Date().toISOString();
    const editAuditEntry: CompletionAuditEntry = {
      action: 'EDITED',
      actorId: actor.userId,
      actorRoles: actor.roles,
      timestamp: nowIso,
      reason: input.editReason,
      changes,
    };

    const updatedHistory = [...existing.auditHistory, editAuditEntry];

    const updatedResult = await this.db.query<VisitCompletionRow>(
      `UPDATE visit_completions
       SET tasks_completed = $1::jsonb,
           observations = $2,
           adverse_events = $3,
           time_in = $4,
           time_out = $5,
           actual_duration = $6,
           duration_variance = $7,
           audit_history = $8::jsonb,
           updated_by = $9,
           updated_at = $10
       WHERE organization_id = $11 AND visit_id = $12
       RETURNING *`,
      [
        JSON.stringify(nextTasks),
        nextObservations,
        nextAdverseEvents,
        nextTimeIn,
        nextTimeOut,
        nextActualDuration,
        nextDurationVariance,
        JSON.stringify(updatedHistory),
        actor.userId,
        nowIso,
        organizationId,
        visitId,
      ]
    );

    const completedCount = nextTasks.filter((t) => t.completed).length;
    const totalCount = nextTasks.length;
    const hasAdverseEvents =
      nextAdverseEvents !== null && nextAdverseEvents.trim().length > 0;

    await this.db.query(
      `UPDATE visits
       SET actual_start_time = $1,
           actual_end_time = $2,
           actual_duration = $3,
           completion_notes = $4,
           tasks_completed = $5,
           tasks_total = $6,
           incident_reported = $7,
           updated_by = $8,
           updated_at = NOW()
       WHERE id = $9 AND organization_id = $10 AND deleted_at IS NULL`,
      [
        nextTimeIn,
        nextTimeOut,
        nextActualDuration,
        nextObservations,
        completedCount,
        totalCount,
        hasAdverseEvents,
        actor.userId,
        visitId,
        organizationId,
      ]
    );

    const updated = updatedResult.rows[0];
    if (updated === undefined) {
      throw new VisitCompletionError(
        'Visit completion record not found',
        404,
        'COMPLETION_NOT_FOUND'
      );
    }

    return mapCompletionRow(updated);
  }
}
