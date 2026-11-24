import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../../permissions/permission-service';
import {
  projectVisitForRole,
  projectVisitsForRole,
  projectCaregiverForRole,
  projectClientForRole,
} from '../../permissions/data-projections';
import { AuthMiddleware } from '../../middleware/auth-middleware';
import type { UserContext } from '../../types/base';
import type { Database } from '../../db/connection';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const CAREGIVER_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_CAREGIVER_ID = '55555555-5555-4555-8555-555555555555';

function makeContext(overrides: Partial<UserContext>): UserContext {
  return {
    userId: '99999999-9999-4999-8999-999999999999',
    organizationId: ORG_ID,
    branchIds: [BRANCH_ID],
    roles: [],
    permissions: [],
    ...overrides,
  };
}

describe('E5 RBAC — Role Matrix & PermissionService.check', () => {
  const permService = new PermissionService();

  it('grants ADMIN full access within org', () => {
    const admin = makeContext({ roles: ['ADMIN'] });
    expect(permService.check(admin, 'visits', 'read')).toBe(true);
    expect(permService.check(admin, 'visits', 'delete')).toBe(true);
    expect(permService.check(admin, 'clients', 'create')).toBe(true);
    expect(permService.check(admin, 'caregivers', 'update')).toBe(true);
    expect(permService.check(admin, 'billing', 'read')).toBe(true);
    expect(permService.check(admin, 'payroll', 'update')).toBe(true);
    expect(permService.check(admin, 'audit-logs', 'read')).toBe(true);
    expect(permService.check(admin, 'settings', 'update')).toBe(true);
  });

  it('grants COORDINATOR visits, assignments, caregivers, and clients, but denies billing/settings/audit-logs', () => {
    const coordinator = makeContext({ roles: ['COORDINATOR'] });
    expect(permService.check(coordinator, 'visits', 'read')).toBe(true);
    expect(permService.check(coordinator, 'visits', 'update')).toBe(true);
    expect(permService.check(coordinator, 'assignments', 'create')).toBe(true);
    expect(permService.check(coordinator, 'caregivers', 'update')).toBe(true);
    expect(permService.check(coordinator, 'clients', 'create')).toBe(true);
    expect(permService.check(coordinator, 'clients', 'read')).toBe(true);

    expect(permService.check(coordinator, 'billing', 'read')).toBe(false);
    expect(permService.check(coordinator, 'payroll', 'read')).toBe(false);
    expect(permService.check(coordinator, 'settings', 'update')).toBe(false);
    expect(permService.check(coordinator, 'audit-logs', 'read')).toBe(false);
  });

  it('grants CAREGIVER assigned visits, visit completion, and own profile, but denies admin/billing/client mutation', () => {
    const caregiver = makeContext({ roles: ['CAREGIVER'], caregiverId: CAREGIVER_ID });
    expect(permService.check(caregiver, 'visits', 'read')).toBe(true);
    expect(permService.check(caregiver, 'visits', 'update')).toBe(true);
    expect(permService.check(caregiver, 'visits', 'complete')).toBe(true);
    expect(permService.check(caregiver, 'caregivers', 'read-own')).toBe(true);
    expect(permService.check(caregiver, 'profile', 'read')).toBe(true);

    expect(permService.check(caregiver, 'visits', 'delete')).toBe(false);
    expect(permService.check(caregiver, 'clients', 'delete')).toBe(false);
    expect(permService.check(caregiver, 'caregivers', 'delete')).toBe(false);
    expect(permService.check(caregiver, 'billing', 'read')).toBe(false);
    expect(permService.check(caregiver, 'audit-logs', 'read')).toBe(false);
  });

  it('grants FAMILY_MEMBER read-only linked client & visit history, denying mutations and admin resources', () => {
    const family = makeContext({ roles: ['FAMILY_MEMBER'], familyClientIds: [CLIENT_ID] });
    expect(permService.check(family, 'clients', 'read')).toBe(true);
    expect(permService.check(family, 'visits', 'read')).toBe(true);
    expect(permService.check(family, 'care-plans', 'read')).toBe(true);

    expect(permService.check(family, 'visits', 'update')).toBe(false);
    expect(permService.check(family, 'visits', 'delete')).toBe(false);
    expect(permService.check(family, 'clients', 'update')).toBe(false);
    expect(permService.check(family, 'caregivers', 'read')).toBe(false);
    expect(permService.check(family, 'billing', 'read')).toBe(false);
    expect(permService.check(family, 'audit-logs', 'read')).toBe(false);
  });
});

describe('E5 RBAC — AuthMiddleware.requirePermission', () => {
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Database;

  function makeRes(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status, json } as unknown as Response;
    return { res, status, json };
  }

  it('accepts a single permission string and calls next() when authorized', () => {
    const authMiddleware = new AuthMiddleware(mockDb);
    const middleware = authMiddleware.requirePermission('visits:read');
    const req = {
      userContext: makeContext({ roles: ['CAREGIVER'] }),
      path: '/api/visits/123',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('returns 403 and logs audit event when permission is denied', () => {
    const authMiddleware = new AuthMiddleware(mockDb);
    const middleware = authMiddleware.requirePermission('billing:read');
    const req = {
      userContext: makeContext({ roles: ['FAMILY_MEMBER'] }),
      path: '/api/billing',
      method: 'GET',
      headers: { 'user-agent': 'vitest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const { res, status, json } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermissions: ['billing:read'],
      })
    );
  });

  it('returns 401 when unauthenticated', () => {
    const authMiddleware = new AuthMiddleware(mockDb);
    const middleware = authMiddleware.requirePermission('visits:read');
    const req = {
      path: '/api/visits',
      method: 'GET',
      headers: {},
      socket: {},
    } as unknown as Request;
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});

describe('E5 RBAC — Minimum-Necessary Data Projections', () => {
  const sampleVisit = {
    id: 'visit-1',
    clientId: CLIENT_ID,
    caregiverId: CAREGIVER_ID,
    caregiverName: 'Jane Doe',
    caregiverPhone: '555-0199',
    caregiverEmail: 'jane@example.com',
    caregiver: {
      id: CAREGIVER_ID,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-0199',
      email: 'jane@example.com',
      payRate: 28,
    },
    status: 'COMPLETED',
    internalNotes: 'Staff-only note',
    billingInfo: { rate: 45 },
    hourlyRate: 28,
  };

  it('strips caregiver phone, email, internal notes, and billing from visits for FAMILY_MEMBER', () => {
    const family = makeContext({ roles: ['FAMILY_MEMBER'], familyClientIds: [CLIENT_ID] });
    const projected = projectVisitForRole(sampleVisit, family);

    expect(projected.id).toBe('visit-1');
    expect(projected.caregiverName).toBe('Jane Doe');
    expect(projected.status).toBe('COMPLETED');
    expect(projected.caregiverPhone).toBeUndefined();
    expect(projected.caregiverEmail).toBeUndefined();
    expect(projected.internalNotes).toBeUndefined();
    expect(projected.billingInfo).toBeUndefined();
    expect(projected.hourlyRate).toBeUndefined();
    expect(projected.caregiver).toEqual({
      id: CAREGIVER_ID,
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('projects visit arrays consistently via projectVisitsForRole', () => {
    const family = makeContext({ roles: ['FAMILY'], familyClientIds: [CLIENT_ID] });
    const projectedList = projectVisitsForRole([sampleVisit], family);
    expect(projectedList).toHaveLength(1);
    expect(projectedList[0]?.caregiverPhone).toBeUndefined();
  });

  it('strips billing/payroll from visits for CAREGIVER while keeping operational fields', () => {
    const caregiver = makeContext({ roles: ['CAREGIVER'], caregiverId: CAREGIVER_ID });
    const projected = projectVisitForRole(sampleVisit, caregiver);

    expect(projected.id).toBe('visit-1');
    expect(projected.internalNotes).toBe('Staff-only note');
    expect(projected.billingInfo).toBeUndefined();
  });

  it('preserves full visit fields for ADMIN and COORDINATOR', () => {
    const admin = makeContext({ roles: ['ADMIN'] });
    const coordinator = makeContext({ roles: ['COORDINATOR'] });

    expect(projectVisitForRole(sampleVisit, admin).caregiverPhone).toBe('555-0199');
    expect(projectVisitForRole(sampleVisit, coordinator).caregiverPhone).toBe('555-0199');
    expect(projectVisitForRole(sampleVisit, coordinator).billingInfo).toEqual({ rate: 45 });
  });

  it('projects caregiver records so CAREGIVER sees full own profile but restricted peer profile', () => {
    const caregiver = makeContext({ roles: ['CAREGIVER'], caregiverId: CAREGIVER_ID });
    const ownProfile = { id: CAREGIVER_ID, firstName: 'Jane', phone: '555-0199', payRate: 28 };
    const peerProfile = { id: OTHER_CAREGIVER_ID, firstName: 'John', phone: '555-0100', payRate: 30 };

    expect(projectCaregiverForRole(ownProfile, caregiver).phone).toBe('555-0199');
    expect(projectCaregiverForRole(peerProfile, caregiver).phone).toBeUndefined();
    expect(projectCaregiverForRole(peerProfile, caregiver).payRate).toBeUndefined();
  });

  it('projects client records to hide SSN and billing from CAREGIVER and FAMILY_MEMBER', () => {
    const client = {
      id: CLIENT_ID,
      firstName: 'Alice',
      ssn: '123-45-6789',
      internalNotes: 'Coordinator note',
      billingInfo: { payer: 'Medicaid' },
    };
    const caregiver = makeContext({ roles: ['CAREGIVER'], caregiverId: CAREGIVER_ID });
    const family = makeContext({ roles: ['FAMILY_MEMBER'], familyClientIds: [CLIENT_ID] });

    const cgClient = projectClientForRole(client, caregiver);
    expect(cgClient.firstName).toBe('Alice');
    expect(cgClient.ssn).toBeUndefined();
    expect(cgClient.billingInfo).toBeUndefined();

    const famClient = projectClientForRole(client, family);
    expect(famClient.firstName).toBe('Alice');
    expect(famClient.ssn).toBeUndefined();
    expect(famClient.internalNotes).toBeUndefined();
    expect(famClient.billingInfo).toBeUndefined();
  });
});
