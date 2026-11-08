/**
 * Caregiver Availability Service
 *
 * Handles per-week availability overrides, template availability fallback,
 * cutoff validation, and conflict detection with booked visits.
 *
 * COMPLIANCE BOUNDARY:
 * This service manages caregiver availability preferences and per-week overrides ONLY.
 * It must NEVER write to evv_* tables, visits.actual_* columns, or timesheet tables.
 * Electronic Visit Verification and actual visit documentation are strictly protected
 * under the 21st Century Cures Act and state aggregator requirements.
 */

import {
  Database,
  UserContext,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@folkcare/core';
import { CaregiverRepository } from '../repository/caregiver-repository.js';
import {
  WeeklyAvailability,
  DayAvailability,
  TimeSlot,
} from '../types/caregiver.js';

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export interface BookedVisitConflict {
  visitId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM in caregiver timezone
  end: string; // HH:MM in caregiver timezone
}

export interface ResolvedAvailability {
  schedule: WeeklyAvailability;
  editable: boolean;
  cutoffAt: string; // ISO string
  conflicts: BookedVisitConflict[];
  version: number;
  source: 'OVERRIDE' | 'TEMPLATE';
}

export interface SaveAvailabilityInput {
  weekStart: string; // YYYY-MM-DD
  schedule: WeeklyAvailability;
  expectedVersion: number;
}

export class AvailabilityCutoffError extends ConflictError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { code: 'AVAILABILITY_EDIT_CUTOFF_PASSED', ...context });
    this.code = 'AVAILABILITY_EDIT_CUTOFF_PASSED';
  }
}

export class AvailabilityConflictError extends ConflictError {
  public conflicts: BookedVisitConflict[];

  constructor(conflicts: BookedVisitConflict[]) {
    super('Availability conflicts with booked visits', {
      code: 'AVAILABILITY_CONFLICT_BOOKED_VISITS',
      conflicts,
    });
    this.code = 'AVAILABILITY_CONFLICT_BOOKED_VISITS';
    this.conflicts = conflicts;
  }
}

export class VersionMismatchError extends ConflictError {
  constructor(message = 'Concurrent modification detected. Stale write rejected.') {
    super(message, { code: 'VERSION_MISMATCH' });
    this.code = 'VERSION_MISMATCH';
  }
}

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number];

export class CaregiverAvailabilityService {
  private repository: CaregiverRepository;

  constructor(
    private database: Database,
    private clock: Clock = new SystemClock()
  ) {
    this.repository = new CaregiverRepository(database);
  }

  /**
   * Calculate local week start instant (00:00:00 on weekStart in target timezone)
   */
  public getWeekStartInstant(weekStartStr: string, timeZone: string): Date {
    const [year, month, day] = weekStartStr.split('-').map((v) => parseInt(v, 10)) as [number, number, number];
    let guess = Date.UTC(year, month - 1, day, 0, 0, 0);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });

    const getParts = (timestamp: number): {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
    } => {
      const parts = formatter.formatToParts(new Date(timestamp));
      const obj: Record<string, string> = {};
      for (const p of parts) {
        if (p.type !== 'literal') obj[p.type] = p.value;
      }
      return {
        year: parseInt(obj['year'] ?? '0', 10),
        month: parseInt(obj['month'] ?? '0', 10),
        day: parseInt(obj['day'] ?? '0', 10),
        hour: parseInt(obj['hour'] ?? '0', 10),
        minute: parseInt(obj['minute'] ?? '0', 10),
        second: parseInt(obj['second'] ?? '0', 10),
      };
    };

    for (let i = 0; i < 5; i++) {
      const parts = getParts(guess);
      const localAsUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      );
      const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
      const diff = targetUtc - localAsUtc;
      if (diff === 0) break;
      guess += diff;
    }

    return new Date(guess);
  }

  /**
   * Convert timestamp to weekday, date (YYYY-MM-DD), and time (HH:MM) in timeZone
   */
  public getLocalDayAndTime(instant: Date, timeZone: string): {
    weekday: WeekdayKey;
    date: string;
    time: string;
  } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(instant);
    const obj: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') obj[p.type] = p.value;
    }
    const weekday = (obj['weekday'] ?? '').toLowerCase() as WeekdayKey;
    const date = `${obj['year']}-${obj['month']}-${obj['day']}`;
    const time = `${obj['hour']}:${obj['minute']}`;
    return { weekday, date, time };
  }

  /**
   * Validate weekly schedule format
   */
  public validateSchedule(schedule: WeeklyAvailability): void {
    if (!schedule || typeof schedule !== 'object') {
      throw new ValidationError('Schedule must be an object');
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const day of WEEKDAYS) {
      const daySched = schedule[day] as DayAvailability | undefined;
      if (!daySched) {
        continue;
      }

      if (typeof daySched.available !== 'boolean') {
        throw new ValidationError(`Day ${day} must specify boolean available`);
      }

      if (!daySched.available) {
        if (daySched.timeSlots && daySched.timeSlots.length > 0) {
          throw new ValidationError(
            `Day ${day} is marked unavailable but has time slots defined`
          );
        }
        continue;
      }

      if (daySched.timeSlots && daySched.timeSlots.length > 0) {
        // Validate slots
        const sortedSlots: TimeSlot[] = [...daySched.timeSlots].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );

        for (let i = 0; i < sortedSlots.length; i++) {
          const slot = sortedSlots[i]!;
          if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
            throw new ValidationError(
              `Time slot in ${day} must be in HH:MM format (got ${slot.startTime}-${slot.endTime})`
            );
          }
          if (slot.startTime >= slot.endTime) {
            throw new ValidationError(
              `Time slot start (${slot.startTime}) must be before end (${slot.endTime}) in ${day}`
            );
          }

          // Check overlap with next slot
          if (i < sortedSlots.length - 1) {
            const nextSlot = sortedSlots[i + 1]!;
            if (slot.endTime > nextSlot.startTime) {
              throw new ValidationError(
                `Overlapping time slots detected in ${day}: ${slot.startTime}-${slot.endTime} and ${nextSlot.startTime}-${nextSlot.endTime}`
              );
            }
          }
        }
      }
    }
  }

  /**
   * Validate that weekStart is a Monday (organization week start convention: default Monday)
   */
  public validateWeekStart(weekStart: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new ValidationError('weekStart must be in YYYY-MM-DD format');
    }
    const [year, month, day] = weekStart.split('-').map((v) => parseInt(v, 10)) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(date.getTime())) {
      throw new ValidationError('Invalid weekStart date');
    }
    // Sunday is 0, Monday is 1, Saturday is 6
    if (date.getUTCDay() !== 1) {
      throw new ValidationError(
        `weekStart (${weekStart}) must be a Monday in the organization week-start convention`
      );
    }
  }

  /**
   * Resolve caregiver effective timezone (falls back to organization timezone)
   */
  private async getEffectiveTimezone(
    caregiverTimezone: string | null | undefined,
    organizationId: string
  ): Promise<string> {
    if (caregiverTimezone && caregiverTimezone !== '') {
      return caregiverTimezone;
    }
    const orgRes = await this.database.query(
      'SELECT timezone FROM organizations WHERE id = $1 AND deleted_at IS NULL',
      [organizationId]
    );
    if (orgRes.rows.length > 0 && orgRes.rows[0]?.['timezone']) {
      return String(orgRes.rows[0]['timezone']);
    }
    return 'UTC';
  }

  /**
   * Check if a visit is fully covered by a daily schedule
   */
  private isVisitCovered(
    visitStart: string,
    visitEnd: string,
    daySchedule: DayAvailability | undefined
  ): boolean {
    if (!daySchedule || !daySchedule.available || !daySchedule.timeSlots) {
      return false;
    }
    return daySchedule.timeSlots.some(
      (slot) => slot.startTime <= visitStart && slot.endTime >= visitEnd
    );
  }

  /**
   * Get resolved availability for a caregiver
   */
  public async getAvailability(
    caregiverId: string,
    weekStart: string,
    context: UserContext
  ): Promise<ResolvedAvailability> {
    this.validateWeekStart(weekStart);

    const caregiver = await this.repository.findById(caregiverId);
    if (!caregiver) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }
    if (context.organizationId && caregiver.organizationId !== context.organizationId) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    const timeZone = await this.getEffectiveTimezone(
      caregiver.timezone,
      caregiver.organizationId
    );

    const weekStartInstant = this.getWeekStartInstant(weekStart, timeZone);
    const cutoffAtInstant = new Date(weekStartInstant.getTime() - 24 * 60 * 60 * 1000);
    const now = this.clock.now();
    const editable = now.getTime() < cutoffAtInstant.getTime();

    // Check for override
    const overrideRes = await this.database.query(
      `SELECT id, schedule, version FROM caregiver_availability_overrides
       WHERE caregiver_id = $1 AND week_start = $2 AND organization_id = $3 AND deleted_at IS NULL`,
      [caregiverId, weekStart, caregiver.organizationId]
    );

    let schedule: WeeklyAvailability;
    let version = caregiver.version;
    let source: 'OVERRIDE' | 'TEMPLATE' = 'TEMPLATE';

    if (overrideRes.rows.length > 0) {
      const row = overrideRes.rows[0]!;
      schedule = typeof row['schedule'] === 'string' ? JSON.parse(row['schedule']) : row['schedule'];
      version = Number(row['version'] ?? 1);
      source = 'OVERRIDE';
    } else {
      schedule = caregiver.availability?.schedule ?? {
        monday: { available: false },
        tuesday: { available: false },
        wednesday: { available: false },
        thursday: { available: false },
        friday: { available: false },
        saturday: { available: false },
        sunday: { available: false },
      };
    }

    return {
      schedule,
      editable,
      cutoffAt: cutoffAtInstant.toISOString(),
      conflicts: [],
      version,
      source,
    };
  }

  /**
   * Query booked visits that conflict with proposed schedule
   */
  public async findVisitConflicts(
    caregiverId: string,
    organizationId: string,
    proposedSchedule: WeeklyAvailability,
    timeZone: string,
    weekStartStr?: string
  ): Promise<BookedVisitConflict[]> {
    let query = `
      SELECT id, scheduled_date, scheduled_start_time, scheduled_end_time, timezone
      FROM visits
      WHERE assigned_caregiver_id = $1
        AND organization_id = $2
        AND status NOT IN ('CANCELLED', 'NO_SHOW_CAREGIVER', 'REJECTED', 'COMPLETED')
        AND deleted_at IS NULL
    `;
    const params: unknown[] = [caregiverId, organizationId];

    if (weekStartStr) {
      // Single week scope: from Monday to Sunday inclusive
      const [year, month, day] = weekStartStr.split('-').map((v) => parseInt(v, 10)) as [number, number, number];
      const startDate = new Date(Date.UTC(year, month - 1, day));
      const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      const endStr = endDate.toISOString().slice(0, 10);

      query += ` AND scheduled_date >= $3 AND scheduled_date <= $4`;
      params.push(weekStartStr, endStr);
    } else {
      // Future visits
      const todayStr = this.clock.now().toISOString().slice(0, 10);
      query += ` AND scheduled_date >= $3`;
      params.push(todayStr);
    }

    const visitsRes = await this.database.query(query, params);
    const conflicts: BookedVisitConflict[] = [];

    for (const row of visitsRes.rows) {
      const visitId = String(row['id']);
      const scheduledDate = String(row['scheduled_date']).slice(0, 10);
      const startTimeStr = String(row['scheduled_start_time']).slice(0, 5);
      const endTimeStr = String(row['scheduled_end_time']).slice(0, 5);
      const visitTz = (row['timezone'] as string) || timeZone;

      // Construct start and end instants in visit's timezone
      const startInstant = this.getWeekStartInstant(scheduledDate, visitTz);
      const [sH, sM] = startTimeStr.split(':').map((v) => parseInt(v, 10)) as [number, number];
      const [eH, eM] = endTimeStr.split(':').map((v) => parseInt(v, 10)) as [number, number];

      const visitStartUtc = new Date(startInstant.getTime() + (sH * 60 + sM) * 60 * 1000);
      const visitEndUtc = new Date(startInstant.getTime() + (eH * 60 + eM) * 60 * 1000);

      // Convert to caregiver's timezone
      const localStart = this.getLocalDayAndTime(visitStartUtc, timeZone);
      const localEnd = this.getLocalDayAndTime(visitEndUtc, timeZone);

      const daySched = proposedSchedule[localStart.weekday];
      const covered = this.isVisitCovered(localStart.time, localEnd.time, daySched);

      if (!covered) {
        conflicts.push({
          visitId,
          date: localStart.date,
          start: localStart.time,
          end: localEnd.time,
        });
      }
    }

    return conflicts;
  }

  /**
   * Save availability override for a single week
   */
  public async saveAvailabilityOverride(
    caregiverId: string,
    input: SaveAvailabilityInput,
    context: UserContext
  ): Promise<{ version: number; schedule: WeeklyAvailability; before?: unknown }> {
    this.validateWeekStart(input.weekStart);
    this.validateSchedule(input.schedule);

    // Verify caregiver belongs to organization
    const caregiver = await this.repository.findById(caregiverId);
    if (!caregiver) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }
    if (context.organizationId && caregiver.organizationId !== context.organizationId) {
      throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
    }

    const timeZone = await this.getEffectiveTimezone(
      caregiver.timezone,
      caregiver.organizationId
    );

    // Cutoff check: 00:00 on weekStart in caregiver timezone - 24 hours
    const weekStartInstant = this.getWeekStartInstant(input.weekStart, timeZone);
    const cutoffAtInstant = new Date(weekStartInstant.getTime() - 24 * 60 * 60 * 1000);
    const now = this.clock.now();

    if (now.getTime() >= cutoffAtInstant.getTime()) {
      throw new AvailabilityCutoffError(
        `Availability edit cutoff passed for week ${input.weekStart} (cutoff was ${cutoffAtInstant.toISOString()})`
      );
    }

    // Check conflicts with booked visits in this week
    const conflicts = await this.findVisitConflicts(
      caregiverId,
      caregiver.organizationId,
      input.schedule,
      timeZone,
      input.weekStart
    );

    if (conflicts.length > 0) {
      throw new AvailabilityConflictError(conflicts);
    }

    // Single transaction with SELECT ... FOR UPDATE on caregiver row
    return await this.database.transaction(async (client) => {
      const lockRes = await client.query(
        'SELECT id, version FROM caregivers WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [caregiverId, caregiver.organizationId]
      );
      if (lockRes.rows.length === 0) {
        throw new NotFoundError(`Caregiver not found: ${caregiverId}`);
      }

      // Check existing override for this week
      const existingOverride = await client.query(
        `SELECT id, schedule, version FROM caregiver_availability_overrides
         WHERE caregiver_id = $1 AND week_start = $2 AND organization_id = $3 AND deleted_at IS NULL FOR UPDATE`,
        [caregiverId, input.weekStart, caregiver.organizationId]
      );

      let currentVersion: number;
      let beforeSchedule: unknown = null;

      if (existingOverride.rows.length > 0) {
        const row = existingOverride.rows[0]!;
        currentVersion = Number(row['version'] ?? 1);
        beforeSchedule = typeof row['schedule'] === 'string' ? JSON.parse(row['schedule']) : row['schedule'];
      } else {
        currentVersion = Number(lockRes.rows[0]!['version'] ?? 1);
        beforeSchedule = caregiver.availability?.schedule ?? null;
      }

      // Optimistic lock check
      if (input.expectedVersion !== currentVersion) {
        throw new VersionMismatchError(
          `Version mismatch: expected version ${input.expectedVersion}, but found version ${currentVersion}`
        );
      }

      const nextVersion = currentVersion + 1;

      if (existingOverride.rows.length > 0) {
        const overrideId = existingOverride.rows[0]!['id'];
        await client.query(
          `UPDATE caregiver_availability_overrides
           SET schedule = $1, version = $2, updated_by = $3, updated_at = NOW()
           WHERE id = $4`,
          [JSON.stringify(input.schedule), nextVersion, context.userId, overrideId]
        );
      } else {
        await client.query(
          `INSERT INTO caregiver_availability_overrides (
             id, organization_id, caregiver_id, week_start, schedule, version, created_by, updated_by, created_at, updated_at
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6, NOW(), NOW()
           )`,
          [
            caregiver.organizationId,
            caregiverId,
            input.weekStart,
            JSON.stringify(input.schedule),
            nextVersion,
            context.userId,
          ]
        );
      }

      return {
        version: nextVersion,
        schedule: input.schedule,
        before: beforeSchedule,
      };
    });
  }
}
