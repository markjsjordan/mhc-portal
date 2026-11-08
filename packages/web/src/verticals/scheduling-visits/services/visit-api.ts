import type { ApiClient } from '@/core/services';
import type { Visit, VisitSearchFilters, VisitType } from '../types';

export interface VisitApiResponse {
  success: boolean;
  data: Visit[];
  meta: {
    startDate: string;
    endDate: string;
    count: number;
  };
}

export interface CaregiverAvailability {
  caregiver_id: string;
  first_name: string;
  last_name: string;
  caregiver_status: string;
  visits: Array<{
    id: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    status: string;
    client_name: string;
  }>;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Array<{
    id: string;
    scheduled_start_time: string;
    scheduled_end_time: string;
    status: string;
    client_first_name: string;
    client_last_name: string;
    address: unknown;
  }>;
}

export interface PatternListItem {
  id: string;
  clientId: string;
  clientName: string;
  caregiverId: string | null;
  caregiverName: string | null;
  serviceTypeId: string;
  serviceTypeName: string;
  frequency: string;
  dayOfWeek: string[];
  startTime: string;
  duration: number;
  recurrenceSummary: string;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextVisitDate: string | null;
  futureVisitCount: number;
  updatedAt: string;
}

export interface ListPatternsParams {
  clientId?: string;
  caregiverId?: string;
  status?: string;
  includeEnded?: boolean;
  unassigned?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListPatternsResponse {
  patterns: PatternListItem[];
  count: number;
  total: number;
  limit: number;
  offset: number;
}

export interface EndPatternResult {
  pattern: PatternListItem;
  retainedFutureVisits: number;
}

export interface VisitApiService {
  getMyVisits(startDate: Date, endDate: Date): Promise<Visit[]>;
  getVisitsByFilters(filters: VisitSearchFilters): Promise<Visit[]>;
  getCalendarVisits(startDate: Date, endDate: Date, branchIds?: string[]): Promise<Visit[]>;
  assignCaregiver(visitId: string, caregiverId: string, checkConflicts?: boolean): Promise<Visit>;
  checkConflicts(visitId: string, caregiverId: string): Promise<ConflictCheckResult>;
  getCaregiverAvailability(date: Date, branchIds?: string[]): Promise<CaregiverAvailability[]>;
  getVisitById(visitId: string): Promise<Visit>;
  createVisit(data: CreateVisitPayload): Promise<Visit>;
  updateVisit(visitId: string, data: UpdateVisitPayload): Promise<Visit>;
  createPattern(data: CreatePatternPayload): Promise<{ pattern: unknown; visits: Visit[]; generatedVisitsCount: number; exceptions: unknown[] }>;
  getPattern(id: string): Promise<PatternDetailsResponse>;
  updatePattern(id: string, data: UpdatePatternPayload): Promise<unknown>;
  listPatterns(params?: string | ListPatternsParams): Promise<PatternListItem[]>;
  listPatternsWithPagination(params?: ListPatternsParams): Promise<ListPatternsResponse>;
  pausePattern(id: string, reason?: string): Promise<PatternListItem>;
  resumePattern(id: string): Promise<PatternListItem>;
  endPattern(id: string, payload: { reason: string; effectiveDate?: string }): Promise<EndPatternResult>;
}

export interface CreatePatternPayload {
  clientId: string;
  caregiverId?: string;
  serviceTypeId: string;
  serviceTypeName?: string;
  frequency?: string;
  rrule?: string;
  startDate: string;
  endDate?: string;
  dayOfWeek?: string[];
  startTime: string;
  duration: number;
  status?: string;
  notes?: string;
  skipHolidays?: boolean;
  horizonDays?: number;
}

export interface CreateVisitPayload {
  clientId: string;
  caregiverId?: string;
  serviceTypeId: string;
  serviceTypeName?: string;
  visitType?: VisitType | string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  address?: string;
  notes?: string;
  clientInstructions?: string;
  status?: string;
}

export interface UpdateVisitPayload {
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  duration?: number;
  scheduledDuration?: number;
  caregiverId?: string | null;
  assignedCaregiverId?: string | null;
  visitType?: string;
  serviceTypeId?: string;
  serviceTypeName?: string;
  notes?: string;
  internalNotes?: string;
  clientInstructions?: string;
}

export interface UpdatePatternPayload {
  updateMode: 'THIS_VISIT' | 'ALL_FUTURE';
  targetVisitId?: string;
  fromDate?: string;
  updates?: {
    caregiverId?: string | null;
    startTime?: string;
    duration?: number;
    notes?: string;
    status?: string;
    dayOfWeek?: string[];
    scheduledDate?: string;
  };
}

export interface PatternDetailsResponse {
  pattern: unknown;
  visits: Visit[];
  totalVisits: number;
}

export const createVisitApiService = (apiClient: ApiClient): VisitApiService => {
  return {
    async getMyVisits(startDate: Date, endDate: Date): Promise<Visit[]> {
      const params = new URLSearchParams();
      params.append('start_date', startDate.toISOString().split('T')[0]!); // YYYY-MM-DD
      params.append('end_date', endDate.toISOString().split('T')[0]!); // YYYY-MM-DD

      const response = await apiClient.get<VisitApiResponse>(
        `/api/visits/my-visits?${params.toString()}`
      );

      return response.data;
    },

    async getVisitsByFilters(filters: VisitSearchFilters): Promise<Visit[]> {
      // Use calendar endpoint to show all visits (not just caregiver's visits)
      // This allows coordinators and admins to see all organizational visits
      const startDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date();
      const endDate = filters.dateTo
        ? new Date(filters.dateTo)
        : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

      return this.getCalendarVisits(startDate, endDate, filters.branchIds);
    },

    async getCalendarVisits(startDate: Date, endDate: Date, branchIds?: string[]): Promise<Visit[]> {
      const params = new URLSearchParams();
      params.append('start_date', startDate.toISOString().split('T')[0]!); // YYYY-MM-DD
      params.append('end_date', endDate.toISOString().split('T')[0]!); // YYYY-MM-DD

      if (branchIds != null && branchIds.length > 0) {
        params.append('branch_ids', branchIds.join(','));
      }

      const response = await apiClient.get<VisitApiResponse>(
        `/api/visits/calendar?${params.toString()}`
      );

      return response.data;
    },

    async assignCaregiver(visitId: string, caregiverId: string, checkConflicts = true): Promise<Visit> {
      const response = await apiClient.put<{ success: boolean; data: Visit }>(
        `/api/visits/${visitId}/assign`,
        { caregiverId, checkConflicts }
      );

      return response.data;
    },

    async checkConflicts(visitId: string, caregiverId: string): Promise<ConflictCheckResult> {
      const response = await apiClient.post<{ success: boolean } & ConflictCheckResult>(
        `/api/visits/${visitId}/check-conflicts`,
        { caregiverId }
      );

      return {
        hasConflicts: response.hasConflicts,
        conflicts: response.conflicts,
      };
    },

    async getCaregiverAvailability(date: Date, branchIds?: string[]): Promise<CaregiverAvailability[]> {
      const params = new URLSearchParams();
      params.append('date', date.toISOString().split('T')[0]!); // YYYY-MM-DD

      if (branchIds != null && branchIds.length > 0) {
        params.append('branch_ids', branchIds.join(','));
      }

      const response = await apiClient.get<{ success: boolean; data: CaregiverAvailability[] }>(
        `/api/visits/caregivers/availability?${params.toString()}`
      );

      return response.data;
    },

    async getVisitById(visitId: string): Promise<Visit> {
      const response = await apiClient.get<{ success: boolean; data: Visit }>(
        `/api/visits/${visitId}`
      );
      return response.data;
    },

    async createVisit(data: CreateVisitPayload): Promise<Visit> {
      const response = await apiClient.post<{ success: boolean; data: Visit }>(
        '/api/visits',
        data
      );
      return response.data;
    },

    async updateVisit(visitId: string, data: UpdateVisitPayload): Promise<Visit> {
      const response = await apiClient.put<{ success: boolean; data: Visit }>(
        `/api/visits/${visitId}`,
        data
      );
      return response.data;
    },

    async createPattern(data: CreatePatternPayload): Promise<{ pattern: unknown; visits: Visit[]; generatedVisitsCount: number; exceptions: unknown[] }> {
      const response = await apiClient.post<{ success: boolean; data: { pattern: unknown; visits: Visit[]; generatedVisitsCount: number; exceptions: unknown[] } }>(
        '/api/visits/patterns',
        data
      );
      return response.data;
    },

    async getPattern(id: string): Promise<PatternDetailsResponse> {
      const response = await apiClient.get<{ success: boolean; data: PatternDetailsResponse }>(
        `/api/visits/patterns/${id}`
      );
      return response.data;
    },

    async updatePattern(id: string, data: UpdatePatternPayload): Promise<unknown> {
      const response = await apiClient.put<{ success: boolean; data: unknown }>(
        `/api/visits/patterns/${id}`,
        data
      );
      return response.data;
    },

    async listPatterns(paramsOrClientId?: string | ListPatternsParams): Promise<PatternListItem[]> {
      const response = await this.listPatternsWithPagination(
        typeof paramsOrClientId === 'string' ? { clientId: paramsOrClientId } : paramsOrClientId
      );
      return response.patterns;
    },

    async listPatternsWithPagination(params?: ListPatternsParams): Promise<ListPatternsResponse> {
      const urlParams = new URLSearchParams();
      if (params?.clientId) urlParams.append('client_id', params.clientId);
      if (params?.caregiverId) urlParams.append('caregiver_id', params.caregiverId);
      if (params?.status) urlParams.append('status', params.status);
      if (params?.includeEnded) urlParams.append('includeEnded', 'true');
      if (params?.unassigned) urlParams.append('unassigned', 'true');
      if (params?.search) urlParams.append('search', params.search);
      if (params?.limit !== undefined) urlParams.append('limit', String(params.limit));
      if (params?.offset !== undefined) urlParams.append('offset', String(params.offset));

      const url = `/api/visits/patterns${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
      const response = await apiClient.get<{
        success: boolean;
        data: PatternListItem[];
        count?: number;
        total?: number;
        limit?: number;
        offset?: number;
      }>(url);

      return {
        patterns: response.data,
        count: response.count ?? response.data.length,
        total: response.total ?? response.data.length,
        limit: response.limit ?? 50,
        offset: response.offset ?? 0,
      };
    },

    async pausePattern(id: string, reason?: string): Promise<PatternListItem> {
      const response = await apiClient.post<{ success: boolean; data: PatternListItem }>(
        `/api/visits/patterns/${id}/pause`,
        { reason }
      );
      return response.data;
    },

    async resumePattern(id: string): Promise<PatternListItem> {
      const response = await apiClient.post<{ success: boolean; data: PatternListItem }>(
        `/api/visits/patterns/${id}/resume`,
        {}
      );
      return response.data;
    },

    async endPattern(id: string, payload: { reason: string; effectiveDate?: string }): Promise<EndPatternResult> {
      const response = await apiClient.post<{ success: boolean; data: PatternListItem; retainedFutureVisits?: number }>(
        `/api/visits/patterns/${id}/end`,
        payload
      );
      return {
        pattern: response.data,
        retainedFutureVisits: response.retainedFutureVisits ?? 0,
      };
    },
  };
};
