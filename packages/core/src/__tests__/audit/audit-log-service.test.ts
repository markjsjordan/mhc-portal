import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import type { Database } from '../../db/connection.js';
import {
  AuditLogService,
  CreateAuditLogEntrySchema,
  AuditLogQuerySchema,
} from '../../audit/audit-log-service.js';
import {
  MINIMUM_AUDIT_RETENTION_YEARS,
  getAuditRetentionYears,
  calculateRetentionUntil,
} from '../../audit/audit-retention.js';
import { FieldEncryptionService } from '../../security/field-encryption.js';

const FIXED_TIMESTAMP = new Date('2026-11-23T12:00:00.000Z');
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function createMockDb() {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Database & { query: ReturnType<typeof vi.fn> };
}

describe('Audit Retention Policy (E6 / wdvf3adf65)', () => {
  it('enforces a minimum 7-year retention floor by default', () => {
    expect(MINIMUM_AUDIT_RETENTION_YEARS).toBe(7);
    expect(getAuditRetentionYears()).toBe(7);
    expect(getAuditRetentionYears(null)).toBe(7);
    expect(getAuditRetentionYears('ZZ')).toBe(7);
    expect(getAuditRetentionYears('TX')).toBe(7);
    expect(getAuditRetentionYears('FL')).toBe(7);
  });

  it('applies extended state retention periods where required', () => {
    expect(getAuditRetentionYears('or')).toBe(10);
    expect(getAuditRetentionYears('MN')).toBe(8);
  });

  it('calculates retention_until deterministically', () => {
    const txRetention = calculateRetentionUntil(FIXED_TIMESTAMP, 'TX');
    expect(txRetention.toISOString()).toBe('2033-11-23T12:00:00.000Z');

    const orRetention = calculateRetentionUntil(FIXED_TIMESTAMP, 'OR');
    expect(orRetention.toISOString()).toBe('2036-11-23T12:00:00.000Z');
  });
});

describe('AuditLogService (E6 / wdvf3adf65)', () => {
  it('validates entries with Zod and rejects invalid actions', () => {
    const invalid = CreateAuditLogEntrySchema.safeParse({
      organizationId: ORG_ID,
      userId: USER_ID,
      resourceType: 'client',
      resourceId: 'client-1',
      action: 'UPSERT',
    });
    expect(invalid.success).toBe(false);
  });

  it('records PHI access with resource_id only and strips direct PHI from metadata', async () => {
    const db = createMockDb();
    const service = new AuditLogService(db);

    const entry = await service.logPhiAccess({
      organizationId: ORG_ID,
      userId: USER_ID,
      resourceType: 'client',
      resourceId: 'client-123',
      action: 'READ',
      ipAddress: '10.0.0.1',
      userAgent: 'Vitest/1.0',
      stateCode: 'TX',
      metadata: {
        ssn: '123-45-6789',
        clientName: 'Jane Doe',
        diagnosis: 'Hypertension',
        noteSummary: 'Verified 123-45-6789 on file',
        method: 'GET',
      },
    });

    expect(entry.resourceType).toBe('client');
    expect(entry.resourceId).toBe('client-123');
    expect(entry.action).toBe('READ');
    expect(entry.metadata).toEqual({
      phiAccessed: true,
      method: 'GET',
      noteSummary: 'Verified [SSN-REDACTED] on file',
    });
    expect(entry.metadata).not.toHaveProperty('ssn');
    expect(entry.metadata).not.toHaveProperty('clientName');
    expect(entry.metadata).not.toHaveProperty('diagnosis');

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_logs');
    expect(params[1]).toBe(ORG_ID);
    expect(params[2]).toBe(USER_ID);
    expect(params[3]).toBe('client');
    expect(params[4]).toBe('client-123');
    expect(params[5]).toBe('READ');
    expect(params[7]).toBe('10.0.0.1');
    expect(params[8]).toBe('Vitest/1.0');
  });

  it('queries audit logs by date range, user, resourceType, and action (org-scoped)', async () => {
    const db = createMockDb();
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            organization_id: ORG_ID,
            user_id: USER_ID,
            resource_type: 'visit',
            resource_id: 'visit-456',
            action: 'WRITE',
            timestamp: FIXED_TIMESTAMP,
            ip_address: '10.0.0.2',
            user_agent: 'MobileApp/1.0',
            metadata: { phiAccessed: true },
            retention_until: new Date('2033-11-23T12:00:00.000Z'),
          },
        ],
      });

    const service = new AuditLogService(db);
    const result = await service.queryLogs(ORG_ID, {
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.000Z',
      userId: USER_ID,
      resourceType: 'visit',
      action: 'WRITE',
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.resourceType).toBe('visit');
    expect(result.logs[0]?.resourceId).toBe('visit-456');
    expect(result.logs[0]?.action).toBe('WRITE');

    const [countSql, countParams] = db.query.mock.calls[0] as [string, unknown[]];
    expect(countSql).toContain('organization_id = $1');
    expect(countSql).toContain('timestamp >= $2');
    expect(countSql).toContain('timestamp <= $3');
    expect(countSql).toContain('user_id = $4');
    expect(countSql).toContain('resource_type = $5');
    expect(countSql).toContain('action = $6');
    expect(countParams).toEqual([
      ORG_ID,
      '2026-11-01T00:00:00.000Z',
      '2026-11-30T23:59:59.000Z',
      USER_ID,
      'visit',
      'WRITE',
    ]);
  });

  it('rejects invalid query parameters via AuditLogQuerySchema', () => {
    expect(AuditLogQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
    expect(AuditLogQuerySchema.safeParse({ action: 'INVALID' }).success).toBe(false);
  });

  it('encrypts and decrypts SSN at rest using FieldEncryptionService', () => {
    const encryption = new FieldEncryptionService({
      keys: { k1: randomBytes(32) },
      activeKeyId: 'k1',
      blindIndexKey: randomBytes(32),
    });

    const ssn = '123-45-6789';
    const encrypted = encryption.encrypt(ssn);
    expect(encrypted).not.toContain(ssn);
    expect(encrypted.startsWith('v1:k1:')).toBe(true);
    expect(encryption.decrypt(encrypted)).toBe(ssn);
  });
});
