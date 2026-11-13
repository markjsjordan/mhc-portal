/**
 * Audit Events API Service
 * 
 * Client for HIPAA audit log API (immutable system activity trail)
 */

import type { ApiClient } from '@/core/services';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  eventType: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'CONFIGURATION' | 'SECURITY';
  resourceType: string;
  resourceId: string;
  clientName?: string;
  phiAccessed: boolean;
  result: 'SUCCESS' | 'FAILURE';
  ipAddress: string;
}

export interface AuditEventsResponse {
  events: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditEventsFilters {
  eventType?: string;
  phiOnly?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class AuditEventsApiService {
  constructor(private apiClient: ApiClient) {}

  /**
   * Fetch audit events with optional filters
   */
  async getAuditEvents(filters?: AuditEventsFilters): Promise<AuditEventsResponse> {
    const params = new URLSearchParams();

    if (filters?.eventType && filters.eventType !== 'ALL') {
      params.append('eventType', filters.eventType);
    }

    if (filters?.phiOnly) {
      params.append('phiOnly', 'true');
    }

    if (filters?.search) {
      params.append('search', filters.search);
    }

    if (filters?.startDate) {
      params.append('startDate', filters.startDate);
    }

    if (filters?.endDate) {
      params.append('endDate', filters.endDate);
    }

    if (filters?.limit !== undefined) {
      params.append('limit', filters.limit.toString());
    }

    if (filters?.offset !== undefined) {
      params.append('offset', filters.offset.toString());
    }

    const queryString = params.toString();
    const url = `/audit-events${queryString ? `?${queryString}` : ''}`;

    const response = await this.apiClient.get<{ data: AuditEventsResponse }>(url);
    return response.data;
  }

  /**
   * Record that the audit log is being exported. Resolves only once the
   * server has written the audit row.
   */
  async recordExport(details: { rowCount: number; eventType?: string; phiOnly: boolean }): Promise<void> {
    await this.apiClient.post('/audit-events/export-log', details);
  }
}
