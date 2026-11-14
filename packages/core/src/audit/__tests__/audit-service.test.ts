import { describe, it, expect, vi } from 'vitest';
import {
  AuditService,
  GENESIS_AUDIT_HASH,
  computeAuditEntryHash,
} from '../audit-service.js';

describe('AuditService hash-chaining', () => {
  it('computes a deterministic 64-char hex SHA-256 hash', () => {
    const fixedDate = new Date('2026-11-14T00:00:00.000Z');
    const hash1 = computeAuditEntryHash({
      previousHash: GENESIS_AUDIT_HASH,
      eventId: 'evt-1',
      timestamp: fixedDate,
      userId: 'user-1',
      organizationId: 'org-1',
      eventType: 'DATA_ACCESS',
      resource: 'client',
      resourceId: 'client-1',
      action: 'READ',
      result: 'SUCCESS',
    });
    const hash2 = computeAuditEntryHash({
      previousHash: GENESIS_AUDIT_HASH,
      eventId: 'evt-1',
      timestamp: fixedDate,
      userId: 'user-1',
      organizationId: 'org-1',
      eventType: 'DATA_ACCESS',
      resource: 'client',
      resourceId: 'client-1',
      action: 'READ',
      result: 'SUCCESS',
    });
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('writes previous_hash fallback and 64-char entry_hash on logEvent', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });

    const service = new AuditService({ query } as never);
    await service.logEvent(
      { userId: 'u1', organizationId: 'o1', roles: [], permissions: [] } as never,
      {
        eventType: 'DATA_ACCESS',
        resource: 'visit',
        resourceId: 'v1',
        action: 'READ',
        result: 'SUCCESS',
      }
    );

    expect(query).toHaveBeenCalledTimes(1);
    const insertArgs = query.mock.calls[0]?.[1] as unknown[];
    expect(insertArgs[12]).toBe(GENESIS_AUDIT_HASH);
    expect(typeof insertArgs[13]).toBe('string');
    expect((insertArgs[13] as string)).toHaveLength(64);
  });
});
