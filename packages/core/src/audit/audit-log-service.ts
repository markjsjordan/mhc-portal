/**
 * HIPAA Audit Log Service (E6 / wdvf3adf65)
 *
 * Provides Zod-validated, PHI-scrubbed, immutable audit logging backed by the
 * `audit_logs` table with state-aware retention (minimum 7 years) and
 * org-scoped export/query capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Database } from '../db/connection.js';
import { sanitizeAuditMetadata } from './audit-service.js';
import { calculateRetentionUntil } from './audit-retention.js';

export const AuditLogActionSchema = z.enum(['READ', 'WRITE', 'DELETE']);
export type AuditLogAction = z.infer<typeof AuditLogActionSchema>;

export const CreateAuditLogEntrySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  userId: z.string().min(1, 'userId is required'),
  resourceType: z.string().min(1, 'resourceType is required').max(100),
  resourceId: z.string().min(1, 'resourceId is required').max(255),
  action: AuditLogActionSchema,
  timestamp: z.coerce.date().optional(),
  ipAddress: z.string().max(64).optional(),
  userAgent: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  stateCode: z.string().length(2).optional(),
});

export type CreateAuditLogEntry = z.input<typeof CreateAuditLogEntrySchema>;

export const AuditLogQuerySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  userId: z.string().min(1).optional(),
  resourceType: z.string().min(1).max(100).optional(),
  action: AuditLogActionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AuditLogQueryInput = z.input<typeof AuditLogQuerySchema>;
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  action: AuditLogAction;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  retentionUntil: Date;
}

export interface AuditLogQueryResult {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

const RESOURCE_TYPE_MAX_LENGTH = 100;
const RESOURCE_ID_MAX_LENGTH = 255;

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function mapRowToAuditLogEntry(row: Record<string, unknown>): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: String(row['id']),
    organizationId: String(row['organization_id']),
    userId: String(row['user_id']),
    resourceType: String(row['resource_type']),
    resourceId: String(row['resource_id']),
    action: row['action'] as AuditLogAction,
    timestamp:
      row['timestamp'] instanceof Date
        ? row['timestamp']
        : new Date(String(row['timestamp'])),
    metadata: parseMetadata(row['metadata']),
    retentionUntil:
      row['retention_until'] instanceof Date
        ? row['retention_until']
        : new Date(String(row['retention_until'])),
  };

  if (typeof row['ip_address'] === 'string' && row['ip_address'].length > 0) {
    entry.ipAddress = row['ip_address'];
  }
  if (typeof row['user_agent'] === 'string' && row['user_agent'].length > 0) {
    entry.userAgent = row['user_agent'];
  }
  return entry;
}

export class AuditLogService {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Validate, sanitize (strip any PHI), and persist an immutable audit log entry.
   */
  async record(input: CreateAuditLogEntry): Promise<AuditLogEntry> {
    const parsed = CreateAuditLogEntrySchema.parse({
      ...input,
      resourceType: input.resourceType.slice(0, RESOURCE_TYPE_MAX_LENGTH),
      resourceId: input.resourceId.slice(0, RESOURCE_ID_MAX_LENGTH),
    });

    const id = uuidv4();
    const timestamp = parsed.timestamp ?? new Date();
    const retentionUntil = calculateRetentionUntil(timestamp, parsed.stateCode);
    const sanitizedMetadata = sanitizeAuditMetadata(parsed.metadata);

    const query = `
      INSERT INTO audit_logs (
        id, organization_id, user_id, resource_type, resource_id,
        action, timestamp, ip_address, user_agent, metadata, retention_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await this.database.query(query, [
      id,
      parsed.organizationId,
      parsed.userId,
      parsed.resourceType,
      parsed.resourceId,
      parsed.action,
      timestamp,
      parsed.ipAddress ?? null,
      parsed.userAgent ?? null,
      JSON.stringify(sanitizedMetadata),
      retentionUntil,
    ]);

    const entry: AuditLogEntry = {
      id,
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId,
      action: parsed.action,
      timestamp,
      metadata: sanitizedMetadata,
      retentionUntil,
    };

    if (parsed.ipAddress !== undefined) {
      entry.ipAddress = parsed.ipAddress;
    }
    if (parsed.userAgent !== undefined) {
      entry.userAgent = parsed.userAgent;
    }
    return entry;
  }

  /**
   * Convenience helper for recording PHI access (e.g., client or visit access).
   * Always tags metadata with `phiAccessed: true` and strips any direct PHI.
   */
  async logPhiAccess(params: {
    organizationId: string;
    userId: string;
    resourceType: string;
    resourceId: string;
    action: AuditLogAction;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    stateCode?: string;
  }): Promise<AuditLogEntry> {
    return this.record({
      ...params,
      metadata: {
        ...params.metadata,
        phiAccessed: true,
      },
    });
  }

  /**
   * Query audit logs for an organization by date range, user, resource type, and action.
   * Always scoped to `organizationId` for multi-tenant isolation.
   */
  async queryLogs(
    organizationId: string,
    rawQuery: AuditLogQueryInput = {}
  ): Promise<AuditLogQueryResult> {
    const query = AuditLogQuerySchema.parse(rawQuery);
    const conditions: string[] = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let paramIndex = 2;

    if (query.startDate !== undefined) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate !== undefined) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(query.endDate);
      paramIndex++;
    }

    if (query.userId !== undefined) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(query.userId);
      paramIndex++;
    }

    if (query.resourceType !== undefined) {
      conditions.push(`resource_type = $${paramIndex}`);
      params.push(query.resourceType);
      paramIndex++;
    }

    if (query.action !== undefined) {
      conditions.push(`action = $${paramIndex}`);
      params.push(query.action);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.database.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    const dataParams = [...params, query.limit, query.offset];
    const dataResult = await this.database.query<Record<string, unknown>>(
      `SELECT id, organization_id, user_id, resource_type, resource_id,
              action, timestamp, ip_address, user_agent, metadata, retention_until
       FROM audit_logs
       WHERE ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex}
       OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return {
      logs: dataResult.rows.map(mapRowToAuditLogEntry),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
