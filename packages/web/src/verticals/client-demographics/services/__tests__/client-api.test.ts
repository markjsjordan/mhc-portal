import { describe, it, expect, vi } from 'vitest';
import { createClientApiService } from '../client-api';
import type { ApiClient } from '@/core/services';
import type { FamilyPortalAccessRow } from '../../types';

describe('clientApi family portal access (wdvf3acun8)', () => {
  it('getFamilyPortalAccess calls GET /api/clients/:clientId/family-portal-access', async () => {
    const mockRows: FamilyPortalAccessRow[] = [
      {
        familyMemberId: 'fm-1',
        firstName: 'Jane',
        lastName: 'Doe',
        relationship: 'Daughter',
        email: 'jane@example.com',
        portalAccessLevel: 'FULL_ACCESS',
        status: 'ACTIVE',
        invitedAt: '2026-11-01T10:00:00.000Z',
        activatedAt: '2026-11-01T11:00:00.000Z',
        revokedAt: null,
        revokedReason: null,
        inviteExpiresAt: null,
        lastLoginAt: '2026-11-06T15:00:00.000Z',
        linked: true,
      },
    ];

    const mockApiClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ success: true, data: mockRows }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createClientApiService(mockApiClient);
    const result = await service.getFamilyPortalAccess('client-123');

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/clients/client-123/family-portal-access');
    expect(result).toEqual(mockRows);
  });

  it('inviteFamilyPortal calls POST /api/family-members/:id/portal-invite', async () => {
    const mockRow: FamilyPortalAccessRow = {
      familyMemberId: 'fm-1',
      firstName: 'Jane',
      lastName: 'Doe',
      relationship: 'Daughter',
      email: 'jane@example.com',
      portalAccessLevel: 'FULL_ACCESS',
      status: 'INVITED',
      invitedAt: '2026-11-07T10:00:00.000Z',
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: '2026-11-14T10:00:00.000Z',
      lastLoginAt: null,
      linked: false,
    };

    const mockApiClient: ApiClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true, data: mockRow }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createClientApiService(mockApiClient);
    const result = await service.inviteFamilyPortal('fm-1');

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/family-members/fm-1/portal-invite');
    expect(result).toEqual(mockRow);
  });

  it('revokeFamilyPortal calls POST /api/family-members/:id/portal-revoke with reason', async () => {
    const mockRow: FamilyPortalAccessRow = {
      familyMemberId: 'fm-1',
      firstName: 'Jane',
      lastName: 'Doe',
      relationship: 'Daughter',
      email: 'jane@example.com',
      portalAccessLevel: 'FULL_ACCESS',
      status: 'REVOKED',
      invitedAt: '2026-11-07T10:00:00.000Z',
      activatedAt: null,
      revokedAt: '2026-11-07T11:00:00.000Z',
      revokedReason: 'Requested by client',
      inviteExpiresAt: null,
      lastLoginAt: null,
      linked: false,
    };

    const mockApiClient: ApiClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true, data: mockRow }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createClientApiService(mockApiClient);
    const result = await service.revokeFamilyPortal('fm-1', 'Requested by client');

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/family-members/fm-1/portal-revoke', {
      reason: 'Requested by client',
    });
    expect(result).toEqual(mockRow);
  });

  it('updateClientStatus calls PATCH /api/clients/:id/status with status and optional reason', async () => {
    const mockClient = { id: 'client-123', status: 'DISCHARGED' };
    const mockApiClient: ApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn().mockResolvedValue({ success: true, data: mockClient }),
      delete: vi.fn(),
    };

    const service = createClientApiService(mockApiClient);
    const result = await service.updateClientStatus('client-123', {
      status: 'DISCHARGED',
      reason: 'Completed care goals',
    });

    expect(mockApiClient.patch).toHaveBeenCalledWith('/api/clients/client-123/status', {
      status: 'DISCHARGED',
      reason: 'Completed care goals',
    });
    expect(result).toEqual(mockClient);
  });
});
