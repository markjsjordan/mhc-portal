/**
 * Analytics API Service
 * Provides methods to interact with the analytics and reporting backend
 */

import type { ApiClient } from '@/core/services';
import { useAuthStore } from '@/core/hooks/auth';
import type {
  OperationalKPIs,
  ComplianceAlert,
  CaregiverPerformance,
  RevenueTrendDataPoint,
  VisitException,
  DashboardStats,
  Report,
  ReportType,
  ExportFormat,
  DateRange,
} from '@/types/analytics-types';

export interface AnalyticsFilters {
  dateRange: DateRange;
  clientIds?: string[];
  caregiverIds?: string[];
  serviceTypes?: string[];
  status?: string[];
  branchId?: string;
}

export class AnalyticsApiService {
  private apiClient?: ApiClient;
  private baseUrl: string;

  constructor(clientOrBaseUrl?: ApiClient | string) {
    if (typeof clientOrBaseUrl === 'string') {
      this.baseUrl = clientOrBaseUrl;
    } else if (clientOrBaseUrl) {
      this.apiClient = clientOrBaseUrl;
      this.baseUrl = '';
    } else {
      this.baseUrl = '';
    }
  }

  /**
   * Get auth headers with token from in-memory Zustand auth store
   */
  private getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get operational KPIs for dashboards
   */
  async getOperationalKPIs(filters: AnalyticsFilters): Promise<OperationalKPIs> {
    const params = new URLSearchParams({
      startDate: filters.dateRange.startDate.toISOString(),
      endDate: filters.dateRange.endDate.toISOString(),
    });

    if (filters.branchId) {
      params.append('branchId', filters.branchId);
    }

    const path = `/api/analytics/kpis?${params.toString()}`;
    if (this.apiClient) {
      return this.apiClient.get<OperationalKPIs>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch operational KPIs');
    }

    return response.json();
  }

  /**
   * Get compliance alerts requiring attention
   */
  async getComplianceAlerts(filters: AnalyticsFilters): Promise<ComplianceAlert[]> {
    const params = new URLSearchParams();

    if (filters.branchId) {
      params.append('branchId', filters.branchId);
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/analytics/compliance-alerts?${queryString}`
      : '/api/analytics/compliance-alerts';

    if (this.apiClient) {
      return this.apiClient.get<ComplianceAlert[]>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch compliance alerts');
    }

    return response.json();
  }

  /**
   * Get revenue trends over time
   */
  async getRevenueTrends(filters: AnalyticsFilters): Promise<RevenueTrendDataPoint[]> {
    const params = new URLSearchParams();

    if (filters.branchId) {
      params.append('branchId', filters.branchId);
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/analytics/revenue-trends?${queryString}`
      : '/api/analytics/revenue-trends';

    if (this.apiClient) {
      return this.apiClient.get<RevenueTrendDataPoint[]>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch revenue trends');
    }

    return response.json();
  }

  /**
   * Get caregiver performance metrics
   */
  async getCaregiverPerformance(
    caregiverId: string,
    filters: AnalyticsFilters
  ): Promise<CaregiverPerformance> {
    const params = new URLSearchParams({
      startDate: filters.dateRange.startDate.toISOString(),
      endDate: filters.dateRange.endDate.toISOString(),
    });

    const path = `/api/analytics/caregiver-performance/${caregiverId}?${params.toString()}`;

    if (this.apiClient) {
      return this.apiClient.get<CaregiverPerformance>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch caregiver performance');
    }

    return response.json();
  }

  /**
   * Get all caregiver performance data
   */
  async getAllCaregiverPerformance(
    filters: AnalyticsFilters
  ): Promise<CaregiverPerformance[]> {
    const params = new URLSearchParams({
      startDate: filters.dateRange.startDate.toISOString(),
      endDate: filters.dateRange.endDate.toISOString(),
    });

    if (filters.branchId) {
      params.append('branchId', filters.branchId);
    }

    const path = `/api/analytics/caregiver-performance?${params.toString()}`;

    if (this.apiClient) {
      return this.apiClient.get<CaregiverPerformance[]>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch all caregiver performance');
    }

    return response.json();
  }

  /**
   * Get EVV exceptions
   */
  async getEVVExceptions(filters: AnalyticsFilters): Promise<VisitException[]> {
    const params = new URLSearchParams();

    if (filters.branchId) {
      params.append('branchId', filters.branchId);
    }

    const queryString = params.toString();
    const path = queryString
      ? `/api/analytics/evv-exceptions?${queryString}`
      : '/api/analytics/evv-exceptions';

    if (this.apiClient) {
      return this.apiClient.get<VisitException[]>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch EVV exceptions');
    }

    return response.json();
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const path = '/api/analytics/dashboard-stats';

    if (this.apiClient) {
      return this.apiClient.get<DashboardStats>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    return response.json();
  }

  /**
   * Generate a report
   */
  async generateReport(
    reportType: ReportType,
    filters: AnalyticsFilters
  ): Promise<Report> {
    const path = '/api/analytics/reports/generate';
    const payload = { reportType, ...filters };

    if (this.apiClient) {
      return this.apiClient.post<Report>(path, payload);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to generate report');
    }

    return response.json();
  }

  /**
   * Get list of generated reports
   */
  async getReports(filters?: Partial<AnalyticsFilters>): Promise<Report[]> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>)}` : '';
    const path = `/api/analytics/reports${queryParams}`;

    if (this.apiClient) {
      return this.apiClient.get<Report[]>(path);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch reports');
    }

    return response.json();
  }

  /**
   * Export a report in a specific format
   */
  async exportReport(
    reportId: string,
    format: ExportFormat
  ): Promise<Blob> {
    const path = `/api/analytics/reports/${reportId}/export?format=${format}`;

    if (this.apiClient) {
      return this.apiClient.get<Blob>(path, { responseType: 'blob' });
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export report');
    }

    return response.blob();
  }
}

export const createAnalyticsApiService = (apiClient: ApiClient): AnalyticsApiService =>
  new AnalyticsApiService(apiClient);
