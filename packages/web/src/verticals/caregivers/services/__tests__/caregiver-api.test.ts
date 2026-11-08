import { describe, it, expect, vi } from 'vitest';
import { createCaregiverApiService } from '../caregiver-api.js';
import type { ApiClient } from '@/core/services/index.js';

describe('caregiverApi (wdvf3abxat)', () => {
  it('forwards sortBy and sortOrder parameters in searchCaregivers', async () => {
    const mockApiClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createCaregiverApiService(mockApiClient);

    await service.searchCaregivers({
      sortBy: 'first_name',
      sortOrder: 'desc',
    }, 2, 10);

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/caregivers?page=2&limit=10&sortBy=first_name&sortOrder=desc'
    );
  });

  it('getMyCaregiverProfile calls GET /api/caregivers/me', async () => {
    const mockApiClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ id: 'cg-1' }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createCaregiverApiService(mockApiClient);
    const profile = await service.getMyCaregiverProfile();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/caregivers/me');
    expect(profile).toEqual({ id: 'cg-1' });
  });

  it('getPortalAccess calls GET /api/caregivers/:id/portal-access', async () => {
    const summary = {
      status: 'INVITED',
      invitedAt: '2026-11-07T12:00:00.000Z',
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: '2026-11-14T12:00:00.000Z',
      lastLoginAt: null,
      linked: false,
    };
    const mockApiClient: ApiClient = {
      get: vi.fn().mockResolvedValue({ success: true, data: summary }),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createCaregiverApiService(mockApiClient);
    const result = await service.getPortalAccess('cg-123');

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/caregivers/cg-123/portal-access');
    expect(result).toEqual(summary);
  });

  it('invitePortal calls POST /api/caregivers/:id/portal-invite', async () => {
    const summary = {
      status: 'INVITED',
      invitedAt: '2026-11-07T12:00:00.000Z',
      activatedAt: null,
      revokedAt: null,
      revokedReason: null,
      inviteExpiresAt: '2026-11-14T12:00:00.000Z',
      lastLoginAt: null,
      linked: false,
    };
    const mockApiClient: ApiClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true, data: summary }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createCaregiverApiService(mockApiClient);
    const result = await service.invitePortal('cg-123');

    expect(mockApiClient.post).toHaveBeenCalledWith('/api/caregivers/cg-123/portal-invite');
    expect(result).toEqual(summary);
  });

  it('revokePortal calls POST /api/caregivers/:id/portal-revoke with reason', async () => {
    const summary = {
      status: 'REVOKED',
      invitedAt: '2026-11-07T12:00:00.000Z',
      activatedAt: null,
      revokedAt: '2026-11-07T12:30:00.000Z',
      revokedReason: 'Staff departure',
      inviteExpiresAt: null,
      lastLoginAt: null,
      linked: false,
    };
    const mockApiClient: ApiClient = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ success: true, data: summary }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = createCaregiverApiService(mockApiClient);
    const result = await service.revokePortal('cg-123', 'Staff departure');

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/caregivers/cg-123/portal-revoke',
      { reason: 'Staff departure' }
    );
    expect(result).toEqual(summary);
  });
});
