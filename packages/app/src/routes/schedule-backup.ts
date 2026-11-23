/**
 * Schedule Backup API Routes
 * 
 * Provides weekly schedule snapshot/backup functionality for offline resilience.
 * Supports manual and automated backups with CSV and PDF export formats.
 * 
 * Requirements (ClickUp wdvf3add1c):
 * - Periodic snapshots of weekly schedule data
 * - Admin can trigger manual backup
 * - Export to PDF and CSV formats
 * - Offline fallback uses cached schedule
 * - Automated weekly backups (Friday EOB)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Database, AuthMiddleware, UserContext, AuditService, createClientProvider, createCaregiverProvider } from '@folkcare/core';
import { ScheduleRepository } from '@folkcare/scheduling-visits';

interface ScheduleBackupMetadata {
  id: string;
  organizationId: string;
  branchIds?: string[];
  startDate: string;
  endDate: string;
  format: 'CSV' | 'PDF' | 'JSON';
  triggerType: 'MANUAL' | 'AUTOMATED';
  triggeredBy: string;
  visitCount: number;
  caregiverCount: number;
  clientCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

interface ScheduleBackupData {
  metadata: ScheduleBackupMetadata;
  visits: unknown[];
  caregivers: unknown[];
  clients: unknown[];
}

/**
 * Extract user context from authenticated request
 */
function getUserContext(req: Request): UserContext {
  const user = req.user ?? (req as unknown as { userContext?: UserContext }).userContext;
  return {
    userId: user?.userId ?? '',
    organizationId: user?.organizationId ?? '',
    branchIds: user?.branchIds ?? [],
    roles: user?.roles ?? [],
    permissions: user?.permissions ?? [],
  };
}

/**
 * Check if user has admin/coordinator access
 */
function hasBackupAccess(context: UserContext): boolean {
  const allowedRoles = [
    'SUPER_ADMIN',
    'ORG_ADMIN',
    'BRANCH_ADMIN',
    'COORDINATOR',
    'SUPERVISOR',
    'ADMINISTRATOR',
  ];
  return context.roles.some(role => allowedRoles.includes(role));
}

/**
 * Middleware to require backup access
 */
function requireBackupAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = getUserContext(req);
    if (!context.organizationId) {
      res.status(400).json({ success: false, error: 'Organization ID is required' });
      return;
    }
    if (!hasBackupAccess(context)) {
      res.status(403).json({
        success: false,
        error: 'Access denied: Admin or coordinator permission required',
        code: 'PERMISSION_DENIED',
      });
      return;
    }
    next();
  };
}

/**
 * Calculate start and end dates for current week (Monday-Sunday)
 */
function getCurrentWeekRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + daysUntilMonday);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Generate CSV export of schedule data
 */
function generateCSV(data: ScheduleBackupData): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Schedule Backup');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Week: ${data.metadata.startDate} to ${data.metadata.endDate}`);
  lines.push(`# Organization: ${data.metadata.organizationId}`);
  lines.push('');
  
  // Visits section
  lines.push('## Visits');
  lines.push('Visit ID,Client ID,Client Name,Caregiver ID,Caregiver Name,Date,Start Time,End Time,Duration,Service Type,Status');
  
  for (const visit of data.visits) {
    const v = visit as Record<string, unknown>;
    const clientName = v['clientName'] ?? v['client_name'] ?? 'Unknown';
    const caregiverName = v['caregiverName'] ?? v['caregiver_name'] ?? 'Unassigned';
    const scheduledDate = v['scheduledDate'] ?? v['scheduled_date'] ?? '';
    const startTime = v['scheduledStartTime'] ?? v['scheduled_start_time'] ?? '';
    const endTime = v['scheduledEndTime'] ?? v['scheduled_end_time'] ?? '';
    const duration = v['scheduledDuration'] ?? v['scheduled_duration'] ?? '';
    const serviceType = v['serviceTypeName'] ?? v['service_type_name'] ?? '';
    const status = v['status'] ?? 'UNKNOWN';
    
    lines.push(
      [
        v['id'],
        v['clientId'] ?? v['client_id'],
        `"${clientName}"`,
        v['caregiverId'] ?? v['caregiver_id'] ?? '',
        `"${caregiverName}"`,
        scheduledDate,
        startTime,
        endTime,
        duration,
        `"${serviceType}"`,
        status,
      ].join(',')
    );
  }
  
  lines.push('');
  
  // Caregivers section
  lines.push('## Caregivers');
  lines.push('ID,Employee Number,First Name,Last Name,Email,Phone,Status');
  
  for (const caregiver of data.caregivers) {
    const c = caregiver as Record<string, unknown>;
    const phone = c['primaryPhone'] ?? c['primary_phone'] ?? '';
    const phoneStr = typeof phone === 'object' ? JSON.stringify(phone) : String(phone);
    
    lines.push(
      [
        c['id'],
        c['employeeNumber'] ?? c['employee_number'],
        `"${c['firstName'] ?? c['first_name']}"`,
        `"${c['lastName'] ?? c['last_name']}"`,
        c['email'] ?? '',
        `"${phoneStr}"`,
        c['status'],
      ].join(',')
    );
  }
  
  lines.push('');
  
  // Clients section
  lines.push('## Clients');
  lines.push('ID,Client Number,First Name,Last Name,Date of Birth,Primary Address,Status');
  
  for (const client of data.clients) {
    const cl = client as Record<string, unknown>;
    const dob = cl['dateOfBirth'] ?? cl['date_of_birth'] ?? '';
    const dobStr = dob instanceof Date ? formatDate(dob) : String(dob).split('T')[0];
    const address = cl['primaryAddress'] ?? cl['primary_address'] ?? {};
    const addressStr = typeof address === 'object' ? JSON.stringify(address) : String(address);
    
    lines.push(
      [
        cl['id'],
        cl['clientNumber'] ?? cl['client_number'],
        `"${cl['firstName'] ?? cl['first_name']}"`,
        `"${cl['lastName'] ?? cl['last_name']}"`,
        dobStr,
        `"${addressStr}"`,
        cl['status'],
      ].join(',')
    );
  }
  
  return lines.join('\n');
}

/**
 * Generate simple PDF export (HTML-based for now, can be enhanced with a PDF library)
 */
function generatePDFHTML(data: ScheduleBackupData): string {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule Backup - ${data.metadata.startDate} to ${data.metadata.endDate}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Schedule Backup</h1>
  <div class="meta">
    <p><strong>Week:</strong> ${data.metadata.startDate} to ${data.metadata.endDate}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Organization:</strong> ${data.metadata.organizationId}</p>
    <p><strong>Visits:</strong> ${data.metadata.visitCount} | <strong>Caregivers:</strong> ${data.metadata.caregiverCount} | <strong>Clients:</strong> ${data.metadata.clientCount}</p>
  </div>

  <h2>Visits (${data.visits.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Client</th>
        <th>Caregiver</th>
        <th>Service Type</th>
        <th>Duration</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.visits.map((visit) => {
        const v = visit as Record<string, unknown>;
        const clientName = v['clientName'] ?? v['client_name'] ?? 'Unknown';
        const caregiverName = v['caregiverName'] ?? v['caregiver_name'] ?? 'Unassigned';
        const scheduledDate = v['scheduledDate'] ?? v['scheduled_date'] ?? '';
        const startTime = v['scheduledStartTime'] ?? v['scheduled_start_time'] ?? '';
        const endTime = v['scheduledEndTime'] ?? v['scheduled_end_time'] ?? '';
        const duration = v['scheduledDuration'] ?? v['scheduled_duration'] ?? '';
        const serviceType = v['serviceTypeName'] ?? v['service_type_name'] ?? '';
        const status = v['status'] ?? 'UNKNOWN';
        
        return `
        <tr>
          <td>${scheduledDate}</td>
          <td>${startTime} - ${endTime}</td>
          <td>${clientName}</td>
          <td>${caregiverName}</td>
          <td>${serviceType}</td>
          <td>${duration} min</td>
          <td>${status}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>Caregivers (${data.caregivers.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Employee #</th>
        <th>Name</th>
        <th>Email</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.caregivers.map((caregiver) => {
        const c = caregiver as Record<string, unknown>;
        const firstName = c['firstName'] ?? c['first_name'] ?? '';
        const lastName = c['lastName'] ?? c['last_name'] ?? '';
        return `
        <tr>
          <td>${c['employeeNumber'] ?? c['employee_number']}</td>
          <td>${firstName} ${lastName}</td>
          <td>${c['email'] ?? ''}</td>
          <td>${c['status']}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>Clients (${data.clients.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Client #</th>
        <th>Name</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${data.clients.map((client) => {
        const cl = client as Record<string, unknown>;
        const firstName = cl['firstName'] ?? cl['first_name'] ?? '';
        const lastName = cl['lastName'] ?? cl['last_name'] ?? '';
        return `
        <tr>
          <td>${cl['clientNumber'] ?? cl['client_number']}</td>
          <td>${firstName} ${lastName}</td>
          <td>${cl['status']}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</body>
</html>
  `;
  
  return html.trim();
}

/**
 * Store backup metadata in database
 */
async function storeBackupMetadata(
  db: Database,
  metadata: ScheduleBackupMetadata,
  data: ScheduleBackupData
): Promise<void> {
  // Store in schedule_backups table (or use existing audit mechanism)
  const query = `
    INSERT INTO schedule_backups (
      id, organization_id, branch_ids, start_date, end_date,
      format, trigger_type, triggered_by,
      visit_count, caregiver_count, client_count,
      backup_data, created_at, expires_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT DO NOTHING
  `;
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90-day retention
  
  await db.query(query, [
    metadata.id,
    metadata.organizationId,
    JSON.stringify(metadata.branchIds ?? []),
    metadata.startDate,
    metadata.endDate,
    metadata.format,
    metadata.triggerType,
    metadata.triggeredBy,
    metadata.visitCount,
    metadata.caregiverCount,
    metadata.clientCount,
    JSON.stringify(data),
    metadata.createdAt,
    expiresAt,
  ]).catch((err) => {
    // If table doesn't exist yet, log error but don't fail the request
    console.error('Failed to store backup metadata (table may not exist yet):', err);
  });
}

/**
 * Create schedule backup router
 */
export function createScheduleBackupRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  
  // All routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req: Request, res: Response, next: NextFunction) =>
      authMiddleware.auditImpersonatedActions(req, res, next)
    );
  }
  
  /**
   * POST /api/schedule/backup
   * Create a manual backup of the current week's schedule
   * 
   * Body:
   * - format: 'CSV' | 'PDF' | 'JSON' (optional, default: 'CSV')
   * - startDate: YYYY-MM-DD (optional, defaults to current week Monday)
   * - endDate: YYYY-MM-DD (optional, defaults to current week Sunday)
   * - branchIds: string[] (optional, filters by branches)
   * 
   * Returns: Backup metadata and download URL/data
   */
  router.post('/backup', requireBackupAccess(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { format = 'CSV', startDate: reqStartDate, endDate: reqEndDate, branchIds } = req.body;
      
      // Validate format
      if (!['CSV', 'PDF', 'JSON'].includes(format)) {
        res.status(400).json({
          success: false,
          error: 'Invalid format. Must be one of: CSV, PDF, JSON',
        });
        return;
      }
      
      // Calculate date range
      const weekRange = getCurrentWeekRange();
      const startDate = reqStartDate ? new Date(reqStartDate) : weekRange.startDate;
      const endDate = reqEndDate ? new Date(reqEndDate) : weekRange.endDate;
      
      // Validate date range
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        });
        return;
      }
      
      if (startDate > endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date must be before or equal to end date',
        });
        return;
      }
      
      // Fetch schedule data
      const repository = new ScheduleRepository(db.getPool());
      const visits = await repository.getVisitsByDateRange(
        context.organizationId!,
        startDate,
        endDate,
        branchIds
      );
      
      // Extract unique caregiver and client IDs
      const caregiverIds = Array.from(
        new Set(
          visits
            .map((v) => (v as unknown as { caregiverId?: string }).caregiverId)
            .filter((id): id is string => id !== undefined)
        )
      );
      
      const clientIds = Array.from(
        new Set(
          visits
            .map((v) => (v as unknown as { clientId: string }).clientId)
        )
      );
      
      // Fetch caregivers and clients
      const caregiverProvider = createCaregiverProvider(db);
      const clientProvider = createClientProvider(db);
      
      const caregivers = caregiverIds.length > 0
        ? await caregiverProvider.getCaregiversByIds(caregiverIds)
        : [];
      
      const clients = clientIds.length > 0
        ? await clientProvider.getClientsByIds(clientIds)
        : [];
      
      // Generate backup ID
      const backupId = `backup-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 7)}`;
      
      // Create backup metadata
      const metadata: ScheduleBackupMetadata = {
        id: backupId,
        organizationId: context.organizationId!,
        branchIds,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        format,
        triggerType: 'MANUAL',
        triggeredBy: context.userId!,
        visitCount: visits.length,
        caregiverCount: caregivers.length,
        clientCount: clients.length,
        createdAt: new Date(),
      };
      
      const backupData: ScheduleBackupData = {
        metadata,
        visits,
        caregivers,
        clients,
      };
      
      // Store backup metadata (non-blocking)
      void storeBackupMetadata(db, metadata, backupData);
      
      // Generate export based on format
      let exportData: string;
      let contentType: string;
      let filename: string;
      
      if (format === 'CSV') {
        exportData = generateCSV(backupData);
        contentType = 'text/csv';
        filename = `schedule-backup-${metadata.startDate}-to-${metadata.endDate}.csv`;
      } else if (format === 'PDF') {
        exportData = generatePDFHTML(backupData);
        contentType = 'text/html'; // In production, would generate actual PDF
        filename = `schedule-backup-${metadata.startDate}-to-${metadata.endDate}.html`;
      } else {
        exportData = JSON.stringify(backupData, null, 2);
        contentType = 'application/json';
        filename = `schedule-backup-${metadata.startDate}-to-${metadata.endDate}.json`;
      }
      
      // Audit trail
      try {
        const auditService = new AuditService(db);
        await auditService.logEvent(context, {
          eventType: 'DATA_ACCESS',
          resource: 'SCHEDULE_BACKUP',
          resourceId: backupId,
          action: 'CREATE',
          result: 'SUCCESS',
          metadata: {
            format,
            startDate: metadata.startDate,
            endDate: metadata.endDate,
            visitCount: visits.length,
            caregiverCount: caregivers.length,
            clientCount: clients.length,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
      } catch (err) {
        console.error('Audit trail logging failed for schedule backup:', err);
      }
      
      // Return backup with inline data for download
      res.status(201).json({
        success: true,
        data: {
          metadata,
          downloadUrl: `/api/schedule/backup/${backupId}/download`,
          exportData, // Include data inline for immediate download
          filename,
          contentType,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * GET /api/schedule/backup/latest
   * Get the latest backup for offline fallback
   * 
   * Query params:
   * - format: 'CSV' | 'PDF' | 'JSON' (optional, default: 'JSON')
   * 
   * Returns: Latest backup data
   */
  router.get('/backup/latest', requireBackupAccess(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const { format = 'JSON' } = req.query;
      
      // Fetch latest backup from database
      const query = `
        SELECT * FROM schedule_backups
        WHERE organization_id = $1
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await db.query(query, [context.organizationId]).catch(() => ({ rows: [] }));
      
      if (result.rows.length === 0) {
        // No existing backup, generate one on-the-fly
        const weekRange = getCurrentWeekRange();
        const repository = new ScheduleRepository(db.getPool());
        const visits = await repository.getVisitsByDateRange(
          context.organizationId!,
          weekRange.startDate,
          weekRange.endDate
        );
        
        const caregiverIds = Array.from(
          new Set(
            visits
              .map((v) => (v as unknown as { caregiverId?: string }).caregiverId)
              .filter((id): id is string => id !== undefined)
          )
        );
        
        const clientIds = Array.from(
          new Set(
            visits
              .map((v) => (v as unknown as { clientId: string }).clientId)
          )
        );
        
        const caregiverProvider = createCaregiverProvider(db);
        const clientProvider = createClientProvider(db);
        
        const caregivers = caregiverIds.length > 0
          ? await caregiverProvider.getCaregiversByIds(caregiverIds)
          : [];
        
        const clients = clientIds.length > 0
          ? await clientProvider.getClientsByIds(clientIds)
          : [];
        
        const metadata: ScheduleBackupMetadata = {
          id: `fallback-${Date.now()}`,
          organizationId: context.organizationId!,
          startDate: formatDate(weekRange.startDate),
          endDate: formatDate(weekRange.endDate),
          format: format as 'CSV' | 'PDF' | 'JSON',
          triggerType: 'MANUAL',
          triggeredBy: context.userId!,
          visitCount: visits.length,
          caregiverCount: caregivers.length,
          clientCount: clients.length,
          createdAt: new Date(),
        };
        
        const backupData: ScheduleBackupData = {
          metadata,
          visits,
          caregivers,
          clients,
        };
        
        res.json({
          success: true,
          data: backupData,
          isFallback: true,
        });
        return;
      }
      
      // Return existing backup
      const backup = result.rows[0] as {
        id: string;
        backup_data: string;
        created_at: Date;
      };
      
      const backupData = JSON.parse(backup.backup_data);
      
      res.json({
        success: true,
        data: backupData,
        isFallback: false,
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * GET /api/schedule/backup/history
   * List backup history
   * 
   * Query params:
   * - limit: number (default: 10, max: 50)
   * - offset: number (default: 0)
   * 
   * Returns: Array of backup metadata
   */
  router.get('/backup/history', requireBackupAccess(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getUserContext(req);
      const limit = Math.min(parseInt(req.query['limit'] as string) || 10, 50);
      const offset = parseInt(req.query['offset'] as string) || 0;
      
      const query = `
        SELECT 
          id, organization_id, branch_ids, start_date, end_date,
          format, trigger_type, triggered_by,
          visit_count, caregiver_count, client_count,
          created_at, expires_at
        FROM schedule_backups
        WHERE organization_id = $1
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM schedule_backups
        WHERE organization_id = $1
          AND expires_at > NOW()
      `;
      
      const [result, countResult] = await Promise.all([
        db.query(query, [context.organizationId, limit, offset]).catch(() => ({ rows: [] })),
        db.query(countQuery, [context.organizationId]).catch(() => ({ rows: [{ total: 0 }] })),
      ]);
      
      const total = parseInt((countResult.rows[0] as { total: string }).total) || 0;
      
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
        total,
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}
