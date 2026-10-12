import type { ApiClient } from '@/core/services/api-client';

export type IncidentType =
  | 'FALL'
  | 'MEDICATION_ERROR'
  | 'INJURY'
  | 'ABUSE_ALLEGATION'
  | 'NEGLECT_ALLEGATION'
  | 'EXPLOITATION_ALLEGATION'
  | 'EQUIPMENT_FAILURE'
  | 'EMERGENCY_HOSPITALIZATION'
  | 'DEATH'
  | 'ELOPEMENT'
  | 'BEHAVIORAL_INCIDENT'
  | 'INFECTION'
  | 'PRESSURE_INJURY'
  | 'CLIENT_REFUSAL'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'REPORTED' | 'UNDER_REVIEW' | 'INVESTIGATION_REQUIRED' | 'RESOLVED' | 'CLOSED';

export interface Incident {
  id: string;
  clientId: string;
  clientName?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  discoveredAt: string;
  location: string;
  description: string;
  reportedBy: string;
  reportedByName?: string;
  stateReportingRequired?: boolean;
  investigationRequired?: boolean;
  createdAt: string;
}

export interface CreateIncidentInput {
  clientId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  occurredAt: string;
  location: string;
  description: string;
  immediateAction?: string;
}

export interface IncidentApiService {
  getIncidents(): Promise<Incident[]>;
  createIncident(data: CreateIncidentInput): Promise<Incident>;
}

export const createIncidentApiService = (apiClient: ApiClient): IncidentApiService => ({
  async getIncidents(): Promise<Incident[]> {
    const res = await apiClient.get<Incident[]>('/api/incidents');
    return Array.isArray(res) ? res : [];
  },
  async createIncident(data: CreateIncidentInput): Promise<Incident> {
    return apiClient.post<Incident>('/api/incidents', data);
  },
});
