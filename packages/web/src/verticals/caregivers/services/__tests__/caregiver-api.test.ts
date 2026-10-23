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
});
