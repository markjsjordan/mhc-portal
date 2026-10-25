/**
 * Sync Push Endpoint Tests
 *
 * Tests for idempotent /sync/push endpoint with capture-time EVV preservation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Database } from '@folkcare/core';
import { createSyncRouter } from '../sync.js';
import type { Router, Request, Response } from 'express';

// Fixed deterministic timestamps for testing
const FIXED_CAPTURE_TIME = new Date('2024-01-15T14:30:00.000Z');
const FIXED_SERVER_TIME = new Date('2024-01-15T14:32:00.000Z');

// Mock Date.now() for deterministic tests
const originalDateNow = Date.now;
beforeEach(() => {
  Date.now = vi.fn(() => FIXED_SERVER_TIME.getTime());
});

afterEach(() => {
  Date.now = originalDateNow;
});

describe('POST /sync/push - Idempotent Capture-Time EVV', () => {
  let mockDb: Database;
  let router: Router;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock database
    const queryResults = new Map<string, { rows: unknown[] }>();
    
    mockDb = {
      query: vi.fn(async (sql: string, _params?: unknown[]) => {
        // Handle different query types
        if (sql.includes('BEGIN')) {
          return { rows: [] };
        }
        if (sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sync_metadata')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT id, sync_status, conflict_data, sync_error')) {
          // Idempotency check - return empty for first call
          return queryResults.get('idempotency_check') ?? { rows: [] };
        }
        if (sql.includes('SELECT * FROM tasks WHERE id')) {
          return queryResults.get('task_lookup') ?? { rows: [] };
        }
        if (sql.includes('SELECT * FROM visits WHERE id')) {
          return queryResults.get('visit_lookup') ?? { rows: [] };
        }
        if (sql.includes('UPDATE sync_metadata')) {
          return { rows: [] };
        }
        if (sql.includes('UPDATE tasks')) {
          return { rows: [] };
        }
        if (sql.includes('UPDATE visits')) {
          return { rows: [] };
        }
        
        return { rows: [] };
      }),
      pool: {} as any,
      getConnection: vi.fn(),
      releaseConnection: vi.fn(),
    } as unknown as Database;

    // Store query results for stubbing
    (mockDb as any).__setQueryResult = (key: string, rows: unknown[]) => {
      queryResults.set(key, { rows });
    };

    // Create router
    router = createSyncRouter(mockDb);

    // Mock request and response
    jsonSpy = vi.fn();
    statusSpy = vi.fn(() => ({ json: jsonSpy }));

    mockReq = {
      user: {
        userId: 'user-123',
        organizationId: 'org-456',
        email: 'caregiver@example.com',
        branchIds: [],
        roles: ['caregiver'],
        permissions: ['sync:write'],
        tokenVersion: 1,
      },
      body: {},
    };

    mockRes = {
      json: jsonSpy as any,
      status: statusSpy as any,
    };
  });

  it('should reject unauthenticated requests', async () => {
    mockReq.user = undefined;

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('should require mutations array', async () => {
    mockReq.body = { deviceId: 'device-abc' };

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: 'mutations array required',
    });
  });

  it('should require deviceId', async () => {
    mockReq.body = { mutations: [] };

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: 'deviceId required',
    });
  });

  it('should process a valid task mutation with capture timestamp', async () => {
    const clientMutationId = 'mutation-001';
    
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'TASK',
          entityId: 'task-123',
          operation: 'UPDATE',
          data: {
            completed: true,
            completedAt: FIXED_CAPTURE_TIME.toISOString(),
            notes: 'Task completed',
          },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
          capturedOffline: false,
        },
      ],
    };

    // Stub: task exists
    (mockDb as any).__setQueryResult('task_lookup', [
      { id: 'task-123', completed: false, notes: '' },
    ]);

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          syncedCount: 1,
          failedCount: 0,
          conflictCount: 0,
          results: [
            {
              success: true,
              clientMutationId,
              entityType: 'TASK',
              entityId: 'task-123',
            },
          ],
        }),
      })
    );

    // Verify sync_metadata was inserted with capture timestamp
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_metadata'),
      expect.arrayContaining([
        'device-abc',
        'user-123',
        'org-456',
        'TASK',
        'task-123',
        'UPDATE',
        FIXED_CAPTURE_TIME, // client_timestamp should use capture time
        expect.any(String),
        clientMutationId,
      ])
    );
  });

  it('should be idempotent - replay of same clientMutationId returns original result', async () => {
    const clientMutationId = 'mutation-replay-001';
    
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'TASK',
          entityId: 'task-456',
          operation: 'UPDATE',
          data: { completed: true },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
        },
      ],
    };

    // Stub: sync_metadata already exists (mutation already processed)
    (mockDb as any).__setQueryResult('idempotency_check', [
      {
        id: 'sync-meta-123',
        sync_status: 'SYNCED',
        conflict_data: null,
        sync_error: null,
      },
    ]);

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          syncedCount: 1,
          results: [
            {
              success: true,
              clientMutationId,
              entityType: 'TASK',
              entityId: 'task-456',
            },
          ],
        }),
      })
    );

    // Should NOT insert duplicate sync_metadata
    const insertCalls = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0].includes('INSERT INTO sync_metadata')
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('should surface conflicts, not drop them', async () => {
    const clientMutationId = 'mutation-conflict-001';
    
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'TASK',
          entityId: 'task-nonexistent',
          operation: 'UPDATE',
          data: { completed: true },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
        },
      ],
    };

    // Stub: task does not exist (conflict)
    (mockDb as any).__setQueryResult('task_lookup', []);

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          syncedCount: 0,
          failedCount: 1,
          conflictCount: 1,
          results: [
            {
              success: false,
              clientMutationId,
              entityType: 'TASK',
              entityId: 'task-nonexistent',
              conflict: {
                reason: 'ENTITY_NOT_FOUND',
              },
            },
          ],
        }),
      })
    );

    // Verify conflict was recorded in sync_metadata
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_metadata'),
      expect.arrayContaining([
        clientMutationId,
        expect.stringContaining('ENTITY_NOT_FOUND'),
      ])
    );
  });

  it('should preserve device capture timestamp for EVV events, not sync time', async () => {
    const clientMutationId = 'mutation-evv-001';
    
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'VISIT',
          entityId: 'visit-789',
          operation: 'UPDATE',
          data: {
            status: 'IN_PROGRESS',
            actualStart: true, // Signal to set actual_start_time
          },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
          capturedOffline: true,
          gps: {
            latitude: 30.2672,
            longitude: -97.7431,
            accuracy: 10,
          },
        },
      ],
    };

    // Stub: visit exists
    (mockDb as any).__setQueryResult('visit_lookup', [
      { id: 'visit-789', status: 'SCHEDULED' },
    ]);

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          syncedCount: 1,
          results: [
            {
              success: true,
              clientMutationId,
              entityType: 'VISIT',
              entityId: 'visit-789',
            },
          ],
        }),
      })
    );

    // Verify actual_start_time uses CAPTURE time, not NOW()
    const updateVisitCalls = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE visits')
    );

    expect(updateVisitCalls.length).toBeGreaterThan(0);
    
    // Find the call that sets actual_start_time
    const actualStartCall = updateVisitCalls.find((call) => 
      call[0].includes('actual_start_time')
    );

    expect(actualStartCall).toBeDefined();
    // Check that the params array includes the capture timestamp
    expect(actualStartCall?.[1]).toEqual(expect.arrayContaining([FIXED_CAPTURE_TIME]));

    // Verify GPS and offline flag stored in verification_data
    const verificationDataCall = updateVisitCalls.find((call) =>
      call[0].includes('verification_data')
    );

    expect(verificationDataCall).toBeDefined();
    expect(verificationDataCall?.[1]).toEqual(
      expect.arrayContaining([
        'visit-789',
        expect.stringContaining('"latitude":30.2672'),
        FIXED_CAPTURE_TIME.toISOString(),
        true, // capturedOffline
        'device-abc',
      ])
    );
  });

  it('should validate GPS coordinates', async () => {
    const clientMutationId = 'mutation-gps-invalid';
    
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'VISIT',
          entityId: 'visit-999',
          operation: 'UPDATE',
          data: { status: 'IN_PROGRESS' },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
          gps: {
            latitude: 200, // Invalid: out of range
            longitude: -97.7431,
            accuracy: 10,
          },
        },
      ],
    };

    (mockDb as any).__setQueryResult('visit_lookup', [{ id: 'visit-999' }]);

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          failedCount: 1,
          results: [
            {
              success: false,
              clientMutationId,
              entityType: 'VISIT',
              entityId: 'visit-999',
              error: expect.stringContaining('Invalid GPS latitude'),
            },
          ],
        }),
      })
    );
  });

  it('should validate capture-time geofence and flag conflict without dropping visit mutation', async () => {
    const clientMutationId = 'mutation-out-of-geofence';
    const scheduledStart = new Date(FIXED_CAPTURE_TIME.getTime());

    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId,
          entityType: 'VISIT',
          entityId: 'visit-geo-flag',
          operation: 'UPDATE',
          data: {
            status: 'IN_PROGRESS',
            actualStart: FIXED_CAPTURE_TIME.toISOString(),
            distanceFromVisitMeters: 250, // Beyond TX 100m + 50m tolerance + 15m GPS = 165m
            state: 'TX',
          },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
          capturedOffline: true,
          gps: {
            latitude: 30.2672,
            longitude: -97.7431,
            accuracy: 15,
          },
        },
      ],
    };

    (mockDb as any).__setQueryResult('visit_lookup', [
      {
        id: 'visit-geo-flag',
        state: 'TX',
        scheduled_start_time: scheduledStart.toISOString(),
      },
    ]);

    const handler = router.stack.find((layer: any) =>
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          conflictCount: 1,
          results: [
            expect.objectContaining({
              success: true,
              clientMutationId,
              entityType: 'VISIT',
              entityId: 'visit-geo-flag',
              conflict: expect.objectContaining({
                reason: 'OUT_OF_GEOFENCE',
                details: expect.arrayContaining([
                  expect.stringContaining('exceeds effective geofence radius'),
                ]),
              }),
            }),
          ],
        }),
      })
    );

    // Verify verification_data records FLAGGED status
    const updateVisitCalls = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE visits')
    );
    const verificationCall = updateVisitCalls.find((call) =>
      call[0].includes('verification_data')
    );
    expect(verificationCall).toBeDefined();
    expect(verificationCall?.[1]).toEqual(
      expect.arrayContaining(['FLAGGED'])
    );
  });

  it('should handle batch mutations with mixed success/conflict/error', async () => {
    mockReq.body = {
      deviceId: 'device-abc',
      mutations: [
        {
          clientMutationId: 'mutation-success',
          entityType: 'TASK',
          entityId: 'task-success',
          operation: 'UPDATE',
          data: { completed: true },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
        },
        {
          clientMutationId: 'mutation-conflict',
          entityType: 'TASK',
          entityId: 'task-conflict',
          operation: 'UPDATE',
          data: { completed: true },
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
        },
        {
          clientMutationId: 'mutation-unsupported',
          entityType: 'UNSUPPORTED_TYPE',
          entityId: 'entity-123',
          operation: 'UPDATE',
          data: {},
          capturedAt: FIXED_CAPTURE_TIME.toISOString(),
        },
      ],
    };

    // First mutation succeeds
    let lookupCallCount = 0;
    (mockDb.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM tasks WHERE id')) {
        lookupCallCount++;
        if (lookupCallCount === 1) {
          return { rows: [{ id: 'task-success' }] }; // exists
        } else {
          return { rows: [] }; // not found
        }
      }
      return { rows: [] };
    });

    const handler = router.stack.find((layer: any) => 
      layer.route?.path === '/sync/push' && layer.route?.methods?.post
    )?.route?.stack[0]?.handle;

    if (!handler) {
      throw new Error('POST /sync/push handler not found');
    }

    await handler(mockReq as Request, mockRes as Response, vi.fn());

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          syncedCount: 1,
          failedCount: 2,
          conflictCount: 1,
          results: expect.arrayContaining([
            {
              success: true,
              clientMutationId: 'mutation-success',
              entityType: 'TASK',
              entityId: 'task-success',
            },
            {
              success: false,
              clientMutationId: 'mutation-conflict',
              entityType: 'TASK',
              entityId: 'task-conflict',
              conflict: expect.any(Object),
            },
            {
              success: false,
              clientMutationId: 'mutation-unsupported',
              entityType: 'UNSUPPORTED_TYPE',
              entityId: 'entity-123',
              error: expect.stringContaining('Unsupported operation'),
            },
          ]),
        }),
      })
    );
  });
});
