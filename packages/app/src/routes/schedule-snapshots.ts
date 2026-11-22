/**
 * Weekly Schedule Snapshots Routes
 *
 * Data protection and business continuity feature:
 * Captures point-in-time snapshots of weekly schedule state (on-demand by admin/coordinator
 * or periodically via scheduled cron, e.g., end of business Friday) and exports them
 * as CSV, JSON, or printable HTML/PDF for offline resilience during extended outages.
 */

import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { Database, AuthMiddleware, isValidUUID } from '@folkcare/core';
import { z } from 'zod';

const SNAPSHOT_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'COORDINATOR',
  'SCHEDULER',
  'SUPERVISOR',
  'ADMINISTRATOR',
];

const SNAPSHOT_ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'ADMINISTRATOR',
];

export interface SnapshotVisitEntry {
  visitId: string;
  visitNumber: string | null;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: string;
  visitType: string | null;
  serviceTypeName: string | null;
  clientId: string | null;
  clientName: string;
  caregiverId: string | null;
  caregiverName: string;
  address: string | null;
  notes: string | null;
}

export interface ScheduleSnapshotRow extends Record<string, unknown> {
  id: string;
  organization_id: string;
  week_start_date: string | Date;
  week_end_date: string | Date;
  trigger_type: 'MANUAL' | 'SCHEDULED';
  label: string | null;
  visit_count: number;
  snapshot_data: SnapshotVisitEntry[] | string;
  created_by: string | null;
  created_by_email?: string | null;
  created_at: string | Date;
}

const createSnapshotSchema = z.object({
  weekStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStartDate must be YYYY-MM-DD')
    .optional(),
  label: z.string().trim().max(255).optional(),
});

/**
 * Compute Monday–Sunday week range for a given reference date (UTC).
 */
export function getWeekRange(referenceDateStr?: string): {
  weekStartDate: string;
  weekEndDate: string;
} {
  let base: Date;
  if (referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)) {
    const [y, m, d] = referenceDateStr.split('-').map(Number);
    base = new Date(Date.UTC(y!, m! - 1, d!));
  } else {
    const now = new Date();
    base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const day = base.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    weekStartDate: monday.toISOString().slice(0, 10),
    weekEndDate: sunday.toISOString().slice(0, 10),
  };
}

function formatDateOnly(val: string | Date): string {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

function parseSnapshotData(raw: SnapshotVisitEntry[] | string): SnapshotVisitEntry[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SnapshotVisitEntry[]) : [];
  } catch {
    return [];
  }
}

function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralize formula injection for spreadsheet apps
  const safe = /^[\t\r+=@-]/.test(str) ? `'${str}` : str;
  if (/[\n\r",]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function serializeSnapshotToCsv(visits: SnapshotVisitEntry[]): string {
  const headers = [
    'Date',
    'Start Time',
    'End Time',
    'Visit Number',
    'Status',
    'Visit Type',
    'Service Type',
    'Client Name',
    'Caregiver Name',
    'Address',
    'Notes',
  ];

  const lines = [headers.join(',')];
  for (const v of visits) {
    lines.push(
      [
        v.scheduledDate,
        v.scheduledStartTime,
        v.scheduledEndTime,
        v.visitNumber,
        v.status,
        v.visitType,
        v.serviceTypeName,
        v.clientName,
        v.caregiverName,
        v.address,
        v.notes,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function serializeSnapshotToPrintableHtml(snapshot: {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  triggerType: string;
  label: string | null;
  visitCount: number;
  createdAt: string;
  visits: SnapshotVisitEntry[];
}): string {
  const rowsHtml =
    snapshot.visits.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">No visits scheduled for this week.</td></tr>`
      : snapshot.visits
          .map(
            (v) => `<tr>
          <td>${escapeHtml(v.scheduledDate)}</td>
          <td>${escapeHtml(v.scheduledStartTime)} – ${escapeHtml(v.scheduledEndTime)}</td>
          <td>${escapeHtml(v.clientName)}</td>
          <td>${escapeHtml(v.caregiverName)}</td>
          <td>${escapeHtml(v.serviceTypeName ?? v.visitType ?? '—')}</td>
          <td>${escapeHtml(v.status)}</td>
          <td>${escapeHtml(v.address ?? '—')}</td>
        </tr>`
          )
          .join('\n');

  const title = snapshot.label
    ? `Weekly Schedule Backup — ${snapshot.label}`
    : `Weekly Schedule Backup (${snapshot.weekStartDate} to ${snapshot.weekEndDate})`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px 0; }
    .meta { font-size: 13px; color: #475569; margin-bottom: 16px; }
    .print-bar { margin-bottom: 16px; }
    .print-btn { background: #0f172a; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    @media print { .print-bar { display: none; } body { margin: 8px; } }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    Week: <strong>${escapeHtml(snapshot.weekStartDate)}</strong> to <strong>${escapeHtml(snapshot.weekEndDate)}</strong>
    &bull; Visits: <strong>${snapshot.visitCount}</strong>
    &bull; Type: <strong>${escapeHtml(snapshot.triggerType)}</strong>
    &bull; Captured: <strong>${escapeHtml(snapshot.createdAt)}</strong>
    &bull; Snapshot ID: <code>${escapeHtml(snapshot.id)}</code>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Client</th>
        <th>Caregiver</th>
        <th>Service</th>
        <th>Status</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}

function hasRole(req: Request, allowedRoles: string[]): boolean {
  const roles = req.user?.roles ?? [];
  return roles.some((r) => allowedRoles.includes(r));
}

function requireSnapshotAccess(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID is required' });
      return;
    }
    if (!hasRole(req, allowedRoles)) {
      res.status(403).json({
        success: false,
        error: 'Access denied: Insufficient permissions for schedule backups',
        code: 'PERMISSION_DENIED',
      });
      return;
    }
    next();
  };
}

function formatSnapshotSummary(row: ScheduleSnapshotRow): {
  id: string;
  organizationId: string;
  weekStartDate: string;
  weekEndDate: string;
  triggerType: 'MANUAL' | 'SCHEDULED';
  label: string | null;
  visitCount: number;
  createdBy: string | null;
  createdByEmail: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    organizationId: row.organization_id,
    weekStartDate: formatDateOnly(row.week_start_date),
    weekEndDate: formatDateOnly(row.week_end_date),
    triggerType: row.trigger_type,
    label: row.label,
    visitCount: Number(row.visit_count),
    createdBy: row.created_by,
    createdByEmail: row.created_by_email ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function captureOrganizationSnapshot(
  db: Database,
  params: {
    organizationId: string;
    weekStartDate: string;
    weekEndDate: string;
    triggerType: 'MANUAL' | 'SCHEDULED';
    label: string | null;
    createdBy: string | null;
  }
): Promise<ScheduleSnapshotRow> {
  const visitsResult = await db.query<{
    id: string;
    visit_number: string | null;
    scheduled_date: string | Date;
    scheduled_start_time: string;
    scheduled_end_time: string;
    status: string;
    visit_type: string | null;
    service_type_name: string | null;
    client_id: string | null;
    client_first_name: string | null;
    client_last_name: string | null;
    assigned_caregiver_id: string | null;
    caregiver_first_name: string | null;
    caregiver_last_name: string | null;
    address: string | null;
    notes: string | null;
  }>(
    `SELECT
       v.id,
       v.visit_number,
       v.scheduled_date,
       v.scheduled_start_time,
       v.scheduled_end_time,
       v.status,
       v.visit_type,
       v.service_type_name,
       v.client_id,
       c.first_name AS client_first_name,
       c.last_name AS client_last_name,
       v.assigned_caregiver_id,
       cg.first_name AS caregiver_first_name,
       cg.last_name AS caregiver_last_name,
       v.address,
       NULL::text AS notes
     FROM visits v
     LEFT JOIN clients c ON v.client_id = c.id
     LEFT JOIN caregivers cg ON v.assigned_caregiver_id = cg.id
     WHERE v.organization_id = $1
       AND v.deleted_at IS NULL
       AND v.scheduled_date >= $2
       AND v.scheduled_date <= $3
     ORDER BY v.scheduled_date ASC, v.scheduled_start_time ASC`,
    [params.organizationId, params.weekStartDate, params.weekEndDate]
  );

  const entries: SnapshotVisitEntry[] = visitsResult.rows.map((r) => {
    const clientName = [r.client_first_name, r.client_last_name].filter(Boolean).join(' ') || 'Unknown Client';
    const caregiverName =
      [r.caregiver_first_name, r.caregiver_last_name].filter(Boolean).join(' ') || 'Unassigned';
    return {
      visitId: r.id,
      visitNumber: r.visit_number ?? null,
      scheduledDate: formatDateOnly(r.scheduled_date),
      scheduledStartTime: r.scheduled_start_time,
      scheduledEndTime: r.scheduled_end_time,
      status: r.status,
      visitType: r.visit_type ?? null,
      serviceTypeName: r.service_type_name ?? null,
      clientId: r.client_id ?? null,
      clientName,
      caregiverId: r.assigned_caregiver_id ?? null,
      caregiverName,
      address: r.address ?? null,
      notes: r.notes ?? null,
    };
  });

  const insertResult = await db.query<ScheduleSnapshotRow>(
    `INSERT INTO schedule_snapshots (
       organization_id,
       week_start_date,
       week_end_date,
       trigger_type,
       label,
       visit_count,
       snapshot_data,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [
      params.organizationId,
      params.weekStartDate,
      params.weekEndDate,
      params.triggerType,
      params.label,
      entries.length,
      JSON.stringify(entries),
      params.createdBy,
    ]
  );

  return insertResult.rows[0]!;
}

export function createScheduleSnapshotsRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);

  /**
   * Automated periodic snapshot capture (e.g., Friday EOB via Vercel Cron)
   * Authenticated via CRON_SECRET Bearer token using timingSafeEqual.
   */
  const handleCronCapture = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers['authorization'];
      const cronSecret = process.env['CRON_SECRET'];

      if (cronSecret === undefined || cronSecret.trim() === '') {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: CRON_SECRET is not configured',
        });
        return;
      }

      if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid cron secret',
        });
        return;
      }

      const expectedBuffer = Buffer.from(`Bearer ${cronSecret}`, 'utf8');
      const providedBuffer = Buffer.from(authHeader, 'utf8');

      if (
        expectedBuffer.length !== providedBuffer.length ||
        !timingSafeEqual(expectedBuffer, providedBuffer)
      ) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid cron secret',
        });
        return;
      }

      const { weekStartDate, weekEndDate } = getWeekRange();
      const orgResult = await db.query<{ id: string; name: string }>(
        `SELECT id, name FROM organizations WHERE deleted_at IS NULL`
      );

      const results: {
        organizationId: string;
        snapshotId?: string;
        visitCount?: number;
        error?: string;
      }[] = [];

      for (const org of orgResult.rows) {
        try {
          const snapshot = await captureOrganizationSnapshot(db, {
            organizationId: org.id,
            weekStartDate,
            weekEndDate,
            triggerType: 'SCHEDULED',
            label: `Weekly Backup (${weekStartDate} to ${weekEndDate})`,
            createdBy: null,
          });
          results.push({
            organizationId: org.id,
            snapshotId: snapshot.id,
            visitCount: snapshot.visit_count,
          });
        } catch (err) {
          results.push({
            organizationId: org.id,
            error: err instanceof Error ? err.message : 'Capture failed',
          });
        }
      }

      res.json({
        success: true,
        data: {
          weekStartDate,
          weekEndDate,
          capturedCount: results.filter((r) => r.snapshotId !== undefined).length,
          results,
        },
      });
    } catch (error) {
      console.error('[ScheduleSnapshots Cron] Capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to capture scheduled weekly snapshots',
      });
    }
  };

  router.get('/cron/capture', handleCronCapture);
  router.post('/cron/capture', handleCronCapture);

  /**
   * List weekly schedule snapshots for the current organization
   */
  router.get(
    '/',
    authMiddleware.requireAuth,
    requireSnapshotAccess(SNAPSHOT_ALLOWED_ROLES),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const organizationId = req.user!.organizationId;
        const limitParam = parseInt(String(req.query['limit'] ?? '25'), 10);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 25;

        const result = await db.query<ScheduleSnapshotRow>(
          `SELECT s.id, s.organization_id, s.week_start_date, s.week_end_date,
                  s.trigger_type, s.label, s.visit_count, s.created_by, s.created_at,
                  u.email AS created_by_email
           FROM schedule_snapshots s
           LEFT JOIN users u ON s.created_by = u.id
           WHERE s.organization_id = $1
           ORDER BY s.created_at DESC
           LIMIT $2`,
          [organizationId, limit]
        );

        res.json({
          success: true,
          data: result.rows.map(formatSnapshotSummary),
        });
      } catch (error) {
        console.error('[ScheduleSnapshots] List error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list schedule snapshots',
        });
      }
    }
  );

  /**
   * Create an on-demand weekly schedule snapshot
   */
  router.post(
    '/',
    authMiddleware.requireAuth,
    requireSnapshotAccess(SNAPSHOT_ALLOWED_ROLES),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const parsed = createSnapshotSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message ?? 'Invalid request body',
          });
          return;
        }

        const organizationId = req.user!.organizationId;
        const userId = req.user!.userId;
        const { weekStartDate, weekEndDate } = getWeekRange(parsed.data.weekStartDate);
        const label =
          parsed.data.label && parsed.data.label.length > 0
            ? parsed.data.label
            : `Manual Backup (${weekStartDate} to ${weekEndDate})`;

        const snapshot = await captureOrganizationSnapshot(db, {
          organizationId,
          weekStartDate,
          weekEndDate,
          triggerType: 'MANUAL',
          label,
          createdBy: userId,
        });

        res.status(201).json({
          success: true,
          data: {
            ...formatSnapshotSummary(snapshot),
            visits: parseSnapshotData(snapshot.snapshot_data),
          },
        });
      } catch (error) {
        console.error('[ScheduleSnapshots] Create error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create schedule snapshot',
        });
      }
    }
  );

  /**
   * Get a single schedule snapshot with its full visit list
   */
  router.get(
    '/:id',
    authMiddleware.requireAuth,
    requireSnapshotAccess(SNAPSHOT_ALLOWED_ROLES),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const snapshotId = String(req.params['id'] ?? '');
        if (!isValidUUID(snapshotId)) {
          res.status(400).json({ success: false, error: 'Invalid snapshot ID' });
          return;
        }

        const organizationId = req.user!.organizationId;
        const result = await db.query<ScheduleSnapshotRow>(
          `SELECT s.*, u.email AS created_by_email
           FROM schedule_snapshots s
           LEFT JOIN users u ON s.created_by = u.id
           WHERE s.id = $1 AND s.organization_id = $2`,
          [snapshotId, organizationId]
        );

        const row = result.rows[0];
        if (!row) {
          res.status(404).json({ success: false, error: 'Schedule snapshot not found' });
          return;
        }

        res.json({
          success: true,
          data: {
            ...formatSnapshotSummary(row),
            visits: parseSnapshotData(row.snapshot_data),
          },
        });
      } catch (error) {
        console.error('[ScheduleSnapshots] Get error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve schedule snapshot',
        });
      }
    }
  );

  /**
   * Export a schedule snapshot as CSV, JSON, or printable HTML (for offline PDF)
   */
  router.get(
    '/:id/export',
    authMiddleware.requireAuth,
    requireSnapshotAccess(SNAPSHOT_ALLOWED_ROLES),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const snapshotId = String(req.params['id'] ?? '');
        if (!isValidUUID(snapshotId)) {
          res.status(400).json({ success: false, error: 'Invalid snapshot ID' });
          return;
        }

        const format = String(req.query['format'] ?? 'csv').toLowerCase();
        if (!['csv', 'json', 'html'].includes(format)) {
          res.status(400).json({
            success: false,
            error: 'Unsupported export format. Use csv, json, or html.',
          });
          return;
        }

        const organizationId = req.user!.organizationId;
        const result = await db.query<ScheduleSnapshotRow>(
          `SELECT * FROM schedule_snapshots WHERE id = $1 AND organization_id = $2`,
          [snapshotId, organizationId]
        );

        const row = result.rows[0];
        if (!row) {
          res.status(404).json({ success: false, error: 'Schedule snapshot not found' });
          return;
        }

        const summary = formatSnapshotSummary(row);
        const visits = parseSnapshotData(row.snapshot_data);
        const baseFilename = `schedule-backup-${summary.weekStartDate}-${summary.id.slice(0, 8)}`;

        if (format === 'csv') {
          const csv = serializeSnapshotToCsv(visits);
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.csv"`);
          res.send(csv);
          return;
        }

        if (format === 'html') {
          const html = serializeSnapshotToPrintableHtml({
            ...summary,
            visits,
          });
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Disposition', `inline; filename="${baseFilename}.html"`);
          res.send(html);
          return;
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.json"`);
        res.json({
          ...summary,
          visits,
        });
      } catch (error) {
        console.error('[ScheduleSnapshots] Export error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export schedule snapshot',
        });
      }
    }
  );

  /**
   * Delete a schedule snapshot (admin only)
   */
  router.delete(
    '/:id',
    authMiddleware.requireAuth,
    requireSnapshotAccess(SNAPSHOT_ADMIN_ROLES),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const snapshotId = String(req.params['id'] ?? '');
        if (!isValidUUID(snapshotId)) {
          res.status(400).json({ success: false, error: 'Invalid snapshot ID' });
          return;
        }

        const organizationId = req.user!.organizationId;
        const result = await db.query(
          `DELETE FROM schedule_snapshots WHERE id = $1 AND organization_id = $2 RETURNING id`,
          [snapshotId, organizationId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ success: false, error: 'Schedule snapshot not found' });
          return;
        }

        res.json({ success: true, data: { id: snapshotId } });
      } catch (error) {
        console.error('[ScheduleSnapshots] Delete error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete schedule snapshot',
        });
      }
    }
  );

  return router;
}
