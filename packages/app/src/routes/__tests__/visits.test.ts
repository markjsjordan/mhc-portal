/**
 * Visit Routes Tests
 *
 * Tests for visit API endpoints including my-visits, calendar, assignments, and notes
 */

 

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVisitRouter } from '../visits';
import type { Database } from '@folkcare/core';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

describe('Visit Routes', () => {
  let mockDb: Database;
  let mockPool: Pool;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let nextMock: NextFunction;

  beforeEach(() => {
    // Mock pool
    mockPool = {} as Pool;

    // Mock database
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getPool: vi.fn().mockReturnValue(mockPool),
    } as unknown as Database;

    // Mock response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnThis();
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    } as unknown as Response;

    // Mock next function
    nextMock = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /my-visits', () => {
    beforeEach(() => {
      mockRequest = {
        query: {
          start_date: '2025-01-01',
          end_date: '2025-01-31',
        },
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          tokenVersion: 0,
          organizationId: 'org-123',
          branchIds: ['branch-123'],
          roles: ['CAREGIVER'],
          permissions: ['visits:read'],
        },
      };
    });

    it('should lookup user email and caregiver record', async () => {
      // NOTE: Full integration test would require mocking ScheduleRepository
      // This test verifies that the route exists and is properly configured
      const router = createVisitRouter(mockDb);
      const myVisitsRoute = router.stack.find((layer: any) =>
        layer.route?.path === '/my-visits'
      );

      expect(myVisitsRoute).toBeDefined();
      expect(myVisitsRoute?.route?.path).toBe('/my-visits');
    });

    it('should return empty array for user without caregiver record', async () => {
      // Mock user lookup
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{ email: 'coordinator@example.com' }],
        } as any)
        // Mock caregiver lookup - no results
        .mockResolvedValueOnce({
          rows: [],
        } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          meta: expect.objectContaining({
            count: 0,
            message: 'No caregiver record found for this user',
          }),
        })
      );
    });

    it('should return 400 for missing start_date', async () => {
      mockRequest.query = { end_date: '2025-01-31' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing required parameters: start_date and end_date',
        })
      );
    });

    it('should return 400 for invalid date format', async () => {
      mockRequest.query = { start_date: 'invalid', end_date: '2025-01-31' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format',
        })
      );
    });

    it('should return 400 for date range exceeding 31 days', async () => {
      mockRequest.query = { start_date: '2025-01-01', end_date: '2025-03-01' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Date range cannot exceed 31 days',
        })
      );
    });

    it('should return 400 for end date before start date', async () => {
      mockRequest.query = { start_date: '2025-01-31', end_date: '2025-01-01' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'End date must be after start date',
        })
      );
    });

    it('should return 404 when user not found', async () => {
      // Mock user lookup - no results
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/my-visits')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found',
        })
      );
    });
  });

  describe('GET /calendar', () => {
    beforeEach(() => {
      mockRequest = {
        query: {
          start_date: '2025-01-01',
          end_date: '2025-01-31',
        },
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          tokenVersion: 0,
          organizationId: 'org-123',
          branchIds: ['branch-123'],
          roles: ['COORDINATOR'],
          permissions: ['visits:read'],
        },
      };
    });

    it('should have calendar route configured', async () => {
      // NOTE: Full integration test would require mocking ScheduleRepository
      // This test verifies that the route exists and is properly configured
      const router = createVisitRouter(mockDb);
      const calendarRoute = router.stack.find((layer: any) =>
        layer.route?.path === '/calendar'
      );

      expect(calendarRoute).toBeDefined();
      expect(calendarRoute?.route?.path).toBe('/calendar');
    });

    it('should return 400 for date range exceeding 60 days', async () => {
      mockRequest.query = { start_date: '2025-01-01', end_date: '2025-04-01' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/calendar')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Date range cannot exceed 60 days',
        })
      );
    });

    it('should return 400 when organization_id is missing', async () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        tokenVersion: 0,
        organizationId: undefined as unknown as string, // token without an org claim
        branchIds: ['branch-123'],
        roles: ['COORDINATOR'],
        permissions: ['visits:read'],
      };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/calendar')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Organization ID is required for this endpoint',
        })
      );
    });

    it('should return 400 when organization_id is invalid UUID', async () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        tokenVersion: 0,
        organizationId: 'invalid-uuid',
        branchIds: ['branch-123'],
        roles: ['COORDINATOR'],
        permissions: ['visits:read'],
      };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/calendar')?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid organization ID format',
        })
      );
    });
  });

  describe('PUT /:id/assign', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'visit-123' },
        body: {
          caregiverId: 'caregiver-456',
          checkConflicts: true,
          checkCompliance: false, // Skip compliance checks in tests (not mocked)
        },
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          tokenVersion: 0,
          organizationId: '550e8400-e29b-41d4-a716-446655440000',
          branchIds: ['branch-123'],
          roles: ['COORDINATOR'],
          permissions: ['visits:update'],
        },
      };
    });

    it('should assign caregiver to visit successfully', async () => {
      // Mock visit lookup
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{
            id: 'visit-123',
            organization_id: '550e8400-e29b-41d4-a716-446655440000',
            branch_id: 'branch-123',
            scheduled_date: new Date('2025-01-15'),
            scheduled_start_time: '09:00:00',
            scheduled_end_time: '10:00:00',
            status: 'UNASSIGNED',
          }],
        } as any)
        // Mock caregiver lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'caregiver-456', status: 'ACTIVE' }],
        } as any)
        // Mock conflict check
        .mockResolvedValueOnce({
          rows: [],
        } as any)
        // Mock assignment update
        .mockResolvedValueOnce({
          rows: [{
            id: 'visit-123',
            assigned_caregiver_id: 'caregiver-456',
            status: 'ASSIGNED',
          }],
        } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/assign')?.route?.stack.find((s: any) => s.method === 'put')?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'visit-123',
            assigned_caregiver_id: 'caregiver-456',
            status: 'ASSIGNED',
          }),
        })
      );
    });

    it('should return 400 for missing caregiverId', async () => {
      mockRequest.body = { checkConflicts: true };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/assign')?.route?.stack.find((s: any) => s.method === 'put')?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'caregiverId is required',
        })
      );
    });

    it('should return 404 for non-existent visit', async () => {
      // Mock visit lookup - no results
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/assign')?.route?.stack.find((s: any) => s.method === 'put')?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Visit not found',
        })
      );
    });

    it('should return 409 for scheduling conflicts', async () => {
      // Mock visit lookup
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{
            id: 'visit-123',
            organization_id: '550e8400-e29b-41d4-a716-446655440000',
            branch_id: 'branch-123',
            scheduled_date: new Date('2025-01-15'),
            scheduled_start_time: '09:00:00',
            scheduled_end_time: '10:00:00',
            status: 'UNASSIGNED',
          }],
        } as any)
        // Mock caregiver lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'caregiver-456', status: 'ACTIVE' }],
        } as any)
        // Mock conflict check - conflicts found
        .mockResolvedValueOnce({
          rows: [{
            id: 'visit-789',
            scheduled_start_time: '09:30:00',
            scheduled_end_time: '11:00:00',
            client_id: 'client-999',
          }],
        } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/assign')?.route?.stack.find((s: any) => s.method === 'put')?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Scheduling conflict detected',
          conflicts: expect.any(Array),
        })
      );
    });
  });

  describe('POST /:id/notes', () => {
    beforeEach(() => {
      mockRequest = {
        params: { id: 'visit-123' },
        body: {
          noteType: 'GENERAL',
          noteText: 'Client was happy and engaged during the visit.',
          clientMood: 'GOOD',
          activitiesPerformed: ['MEAL_PREP', 'LIGHT_HOUSEKEEPING'],
          isIncident: false,
        },
        user: {
          userId: 'user-123',
          email: 'user@example.com',
          tokenVersion: 0,
          organizationId: 'org-123',
          branchIds: ['branch-123'],
          roles: ['CAREGIVER'],
          permissions: ['visit_notes:create'],
        },
      };
    });

    it('should create visit note successfully', async () => {
      // Mock visit lookup
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{
            id: 'visit-123',
            assigned_caregiver_id: 'caregiver-456',
            organization_id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'COMPLETED',
          }],
        } as any)
        // Mock caregiver lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'caregiver-456' }],
        } as any)
        // Mock note insertion
        .mockResolvedValueOnce({
          rows: [{
            id: 'note-789',
            visit_id: 'visit-123',
            note_type: 'GENERAL',
            note_text: 'Client was happy and engaged during the visit.',
            client_mood: 'GOOD',
          }],
        } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/notes' && layer.route?.methods?.post)?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'note-789',
            visit_id: 'visit-123',
          }),
        })
      );
    });

    it('should return 400 for missing noteText', async () => {
      mockRequest.body = {
        noteType: 'GENERAL',
        clientMood: 'GOOD',
      };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/notes' && layer.route?.methods?.post)?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'noteText is required',
        })
      );
    });

    it('should return 400 for incident without severity', async () => {
      mockRequest.body = {
        noteText: 'Client fell.',
        isIncident: true,
        // Missing incidentSeverity
      };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/notes' && layer.route?.methods?.post)?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'incidentSeverity is required when isIncident is true',
        })
      );
    });

    it('should return 404 for non-existent visit', async () => {
      // Mock visit lookup - no results
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/notes' && layer.route?.methods?.post)?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Visit not found',
        })
      );
    });

    it('should return 400 for visit without assigned caregiver', async () => {
      // Mock visit lookup - visit with no caregiver
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: 'visit-123',
          assigned_caregiver_id: null,
          organization_id: 'org-123',
          status: 'UNASSIGNED',
        }],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find((layer: any) => layer.route?.path === '/:id/notes' && layer.route?.methods?.post)?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Visit is not assigned to a caregiver',
        })
      );
    });
  });

  describe('PUT /:id and PATCH /:id (Edit Scheduled Visit)', () => {
    const validVisitId = '550e8400-e29b-41d4-a716-446655440001';
    const validOrgId = '550e8400-e29b-41d4-a716-446655440000';
    const validCaregiverId = '550e8400-e29b-41d4-a716-446655440002';

    beforeEach(() => {
      mockRequest = {
        params: { id: validVisitId },
        body: {
          scheduledDate: '2026-10-25',
          scheduledStartTime: '18:10',
          scheduledEndTime: '21:10',
          duration: 180,
          caregiverId: validCaregiverId,
          visitType: 'RESPITE',
          notes: 'Respite care visit - Margaret Thompson',
        },
        user: {
          userId: 'user-coordinator-1',
          email: 'coordinator@example.com',
          tokenVersion: 0,
          organizationId: validOrgId,
          branchIds: ['branch-123'],
          roles: ['COORDINATOR'],
          permissions: ['visits:update'],
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent'),
      };
    });

    it('should edit a scheduled visit successfully with audit logging', async () => {
      // Mock existing visit lookup
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [{
            id: validVisitId,
            organization_id: validOrgId,
            client_id: '550e8400-e29b-41d4-a716-446655440099',
            assigned_caregiver_id: null,
            assignment_method: null,
            service_type_id: 'svc-respite',
            service_type_name: 'Respite Care',
            visit_type: 'REGULAR',
            scheduled_date: '2026-10-20',
            scheduled_start_time: '14:00:00',
            scheduled_end_time: '16:00:00',
            scheduled_duration: 120,
            status: 'UNASSIGNED',
            actual_start_time: null,
            internal_notes: null,
            client_instructions: null,
          }],
        } as any)
        // Mock caregiver lookup
        .mockResolvedValueOnce({
          rows: [{ id: validCaregiverId, status: 'ACTIVE' }],
        } as any)
        // Mock visit update
        .mockResolvedValueOnce({
          rows: [{
            id: validVisitId,
            organization_id: validOrgId,
            client_id: '550e8400-e29b-41d4-a716-446655440099',
            assigned_caregiver_id: validCaregiverId,
            assignment_method: 'MANUAL',
            service_type_id: 'svc-respite',
            service_type_name: 'Respite Care',
            visit_type: 'RESPITE',
            scheduled_date: '2026-10-25',
            scheduled_start_time: '18:10',
            scheduled_end_time: '21:10',
            scheduled_duration: 180,
            status: 'ASSIGNED',
            internal_notes: 'Respite care visit - Margaret Thompson',
          }],
        } as any)
        // Mock audit event insert
        .mockResolvedValueOnce({ rows: [] } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) {
        throw new Error('Handler not found');
      }

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: validVisitId,
            visit_type: 'RESPITE',
            scheduled_duration: 180,
            status: 'ASSIGNED',
          }),
        })
      );
    });

    it('should return 400 for invalid visit ID format', async () => {
      mockRequest.params = { id: 'invalid-id' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid visit ID format',
        })
      );
    });

    it('should return 403 when user lacks scheduling permissions', async () => {
      mockRequest.user = {
        userId: 'user-family-1',
        email: 'family@example.com',
        tokenVersion: 0,
        organizationId: validOrgId,
        branchIds: [],
        roles: ['FAMILY'],
        permissions: ['visits:read'],
      };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'PERMISSION_DENIED',
        })
      );
    });

    it('should return 404 for non-existent visit', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({ rows: [] } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Visit not found',
        })
      );
    });

    it('should return 422 when visit is COMPLETED (locked visit)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: validVisitId,
          organization_id: validOrgId,
          status: 'COMPLETED',
          actual_start_time: '2026-10-25T18:10:00Z',
        }],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'VISIT_LOCKED',
        })
      );
    });

    it('should return 422 when visit has recorded actual_start_time (EVV locked)', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: validVisitId,
          organization_id: validOrgId,
          status: 'IN_PROGRESS',
          actual_start_time: '2026-10-25T18:10:00Z',
        }],
      } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'VISIT_LOCKED_EVV',
        })
      );
    });

    it('should return 400 for invalid scheduledDate format', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: validVisitId,
          organization_id: validOrgId,
          status: 'SCHEDULED',
          actual_start_time: null,
        }],
      } as any);

      mockRequest.body = { scheduledDate: '25-10-2026' }; // Invalid format

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'scheduledDate must be in YYYY-MM-DD format',
        })
      );
    });

    it('should return 400 for duration out of bounds', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: validVisitId,
          organization_id: validOrgId,
          status: 'SCHEDULED',
          actual_start_time: null,
          scheduled_date: '2026-10-25',
          scheduled_start_time: '10:00',
        }],
      } as any);

      mockRequest.body = { duration: 5 }; // Minimum is 15 minutes

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Scheduled duration must be between 15 and 1440 minutes',
        })
      );
    });

    it('should return 400 for invalid visitType', async () => {
      vi.mocked(mockDb.query).mockResolvedValueOnce({
        rows: [{
          id: validVisitId,
          organization_id: validOrgId,
          status: 'SCHEDULED',
          actual_start_time: null,
          scheduled_date: '2026-10-25',
          scheduled_start_time: '10:00',
        }],
      } as any);

      mockRequest.body = { visitType: 'INVALID_TYPE' };

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/:id' && layer.route?.methods?.put
      )?.route?.stack[0]?.handle;

      if (!handler) throw new Error('Handler not found');

      await handler(mockRequest as Request, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid visitType'),
        })
      );
    });
  });

  describe('POST / (Create Visit)', () => {
    it('should create visit with valid fields and client address/branch resolution', async () => {
      const mockReq = {
        body: {
          clientId: 'c1234567-0000-0000-0000-000000000001',
          serviceTypeId: 'personal-care',
          serviceTypeName: 'Personal Care / Companionship',
          visitType: 'REGULAR',
          scheduledDate: '2026-10-25',
          scheduledStartTime: '09:00',
          scheduledEndTime: '11:00',
          notes: 'Test internal notes',
          clientInstructions: 'Ring doorbell twice',
        },
        user: {
          userId: '00000000-0000-0000-0000-000000000001',
          organizationId: '00000000-0000-0000-0000-000000000001',
          branchIds: ['00000000-0000-0000-0000-000000000002'],
          roles: ['COORDINATOR'],
          permissions: ['visits:write'],
        },
      } as unknown as Request;

      // Mock client check
      vi.mocked(mockDb.query)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'c1234567-0000-0000-0000-000000000001',
              organization_id: '00000000-0000-0000-0000-000000000001',
              branch_id: '00000000-0000-0000-0000-000000000002',
              primary_address: { street: '100 Main St', city: 'Austin', state: 'TX', zipCode: '78701' },
              timezone: 'America/Chicago',
            },
          ],
        } as any)
        // Mock visit count check for visit number generation
        .mockResolvedValueOnce({
          rows: [{ count: '5' }],
        } as any)
        // Mock INSERT visits RETURNING *
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'v1234567-0000-0000-0000-000000000001',
              organization_id: '00000000-0000-0000-0000-000000000001',
              branch_id: '00000000-0000-0000-0000-000000000002',
              client_id: 'c1234567-0000-0000-0000-000000000001',
              visit_number: 'V2026-000006',
              scheduled_date: '2026-10-25',
              scheduled_start_time: '09:00',
              scheduled_end_time: '11:00',
              scheduled_duration: 120,
              timezone: 'America/Chicago',
              status: 'UNASSIGNED',
            },
          ],
        } as any);

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      expect(handler).toBeDefined();

      await handler!(mockReq, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            visit_number: 'V2026-000006',
          }),
        })
      );
    });

    it('should return 400 when required fields are missing', async () => {
      const mockReq = {
        body: {
          clientId: 'c123',
        },
        user: {
          userId: 'u1',
          organizationId: 'o1',
          branchIds: ['b1'],
          roles: ['COORDINATOR'],
          permissions: ['visits:write'],
        },
      } as unknown as Request;

      const router = createVisitRouter(mockDb);
      const handler = router.stack.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.post
      )?.route?.stack[0]?.handle;

      expect(handler).toBeDefined();

      await handler!(mockReq, mockResponse as Response, nextMock);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Missing required fields'),
        })
      );
    });
  });
});
