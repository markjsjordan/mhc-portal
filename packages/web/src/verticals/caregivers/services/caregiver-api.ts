/**
 * Caregiver API client
 */

import type { ApiClient } from '@/core/services/index.js';
import type { Caregiver, CaregiverSearchFilters, PaginatedCaregivers, PortalAccessSummary } from '../types/index.js';

export interface CaregiverApiService {
  searchCaregivers(filters?: CaregiverSearchFilters, page?: number, limit?: number): Promise<PaginatedCaregivers>;
  getCaregiverById(id: string): Promise<Caregiver>;
  createCaregiver(data: Partial<Caregiver>): Promise<Caregiver>;
  updateCaregiver(id: string, data: Partial<Caregiver>): Promise<Caregiver>;
  deleteCaregiver(id: string): Promise<void>;
  /**
   * Get the caregiver profile linked to the currently authenticated
   * user (via GET /api/caregivers/me, which resolves by the linked user_id
   * server-side). Throws (404) for users with no linked caregiver record —
   * e.g. admins, coordinators.
   */
  getMyCaregiverProfile(): Promise<Caregiver>;
  getPortalAccess(id: string): Promise<PortalAccessSummary>;
  invitePortal(id: string): Promise<PortalAccessSummary>;
  revokePortal(id: string, reason: string): Promise<PortalAccessSummary>;
}

export const createCaregiverApiService = (apiClient: ApiClient): CaregiverApiService => {
  return {
    async searchCaregivers(
      filters: CaregiverSearchFilters = {},
      page: number = 1,
      limit: number = 20
    ): Promise<PaginatedCaregivers> {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filters.query) params.append('query', filters.query);
      if (filters.branchId) params.append('branchId', filters.branchId);
      if (filters.status?.length) params.append('status', filters.status.join(','));
      if (filters.role?.length) params.append('role', filters.role.join(','));
      if (filters.employmentType?.length) params.append('employmentType', filters.employmentType.join(','));
      if (filters.complianceStatus?.length) params.append('complianceStatus', filters.complianceStatus.join(','));
      if (filters.credentialExpiring) params.append('credentialExpiring', 'true');
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

      return apiClient.get<PaginatedCaregivers>(`/api/caregivers?${params}`);
    },

    async getCaregiverById(id: string): Promise<Caregiver> {
      return apiClient.get<Caregiver>(`/api/caregivers/${id}`);
    },

    async createCaregiver(data: Partial<Caregiver>): Promise<Caregiver> {
      return apiClient.post<Caregiver>('/api/caregivers', data);
    },

    async updateCaregiver(id: string, data: Partial<Caregiver>): Promise<Caregiver> {
      return apiClient.patch<Caregiver>(`/api/caregivers/${id}`, data);
    },

    async deleteCaregiver(id: string): Promise<void> {
      await apiClient.delete(`/api/caregivers/${id}`);
    },

    async getMyCaregiverProfile(): Promise<Caregiver> {
      return apiClient.get<Caregiver>('/api/caregivers/me');
    },

    async getPortalAccess(id: string): Promise<PortalAccessSummary> {
      const response = await apiClient.get<{ success?: boolean; data?: PortalAccessSummary } | PortalAccessSummary>(
        `/api/caregivers/${id}/portal-access`
      );
      if ('data' in response && response.data) {
        return response.data;
      }
      return response as PortalAccessSummary;
    },

    async invitePortal(id: string): Promise<PortalAccessSummary> {
      const response = await apiClient.post<{ success?: boolean; data?: PortalAccessSummary } | PortalAccessSummary>(
        `/api/caregivers/${id}/portal-invite`
      );
      if ('data' in response && response.data) {
        return response.data;
      }
      return response as PortalAccessSummary;
    },

    async revokePortal(id: string, reason: string): Promise<PortalAccessSummary> {
      const response = await apiClient.post<{ success?: boolean; data?: PortalAccessSummary } | PortalAccessSummary>(
        `/api/caregivers/${id}/portal-revoke`,
        { reason }
      );
      if ('data' in response && response.data) {
        return response.data;
      }
      return response as PortalAccessSummary;
    },
  };
};
