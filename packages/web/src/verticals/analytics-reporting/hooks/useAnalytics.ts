/**
 * React Query hooks for analytics data
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/core/hooks';
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
} from '@/types/analytics-types';
import { AnalyticsApiService, createAnalyticsApiService, type AnalyticsFilters } from '../services/analytics-api';

/**
 * Hook to get the Analytics API service instance
 */
export function useAnalyticsApi(): AnalyticsApiService {
  const apiClient = useApiClient();
  return useMemo(() => createAnalyticsApiService(apiClient), [apiClient]);
}

/**
 * Hook to fetch operational KPIs
 */
export function useOperationalKPIs(
  filters: AnalyticsFilters,
  options?: { refetchInterval?: number }
) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<OperationalKPIs>({
    queryKey: ['analytics', 'kpis', filters],
    queryFn: () => analyticsApi.getOperationalKPIs(filters),
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to fetch compliance alerts
 */
export function useComplianceAlerts(
  filters: AnalyticsFilters,
  _options?: { refetchInterval?: number }
) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<ComplianceAlert[]>({
    queryKey: ['analytics', 'compliance-alerts', filters],
    queryFn: () => analyticsApi.getComplianceAlerts(filters),
    refetchInterval: false, // DISABLED - causing infinite loop on rate limit errors
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch revenue trends
 */
export function useRevenueTrends(filters: AnalyticsFilters) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<RevenueTrendDataPoint[]>({
    queryKey: ['analytics', 'revenue-trends', filters],
    queryFn: () => analyticsApi.getRevenueTrends(filters),
  });
}

/**
 * Hook to fetch caregiver performance
 */
export function useCaregiverPerformance(
  caregiverId: string,
  filters: AnalyticsFilters
) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<CaregiverPerformance>({
    queryKey: ['analytics', 'caregiver-performance', caregiverId, filters],
    queryFn: () => analyticsApi.getCaregiverPerformance(caregiverId, filters),
    enabled: !!caregiverId,
  });
}

/**
 * Hook to fetch all caregiver performance data
 */
export function useAllCaregiverPerformance(filters: AnalyticsFilters) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<CaregiverPerformance[]>({
    queryKey: ['analytics', 'all-caregivers-performance', filters],
    queryFn: () => analyticsApi.getAllCaregiverPerformance(filters),
  });
}

/**
 * Hook to fetch EVV exceptions
 */
export function useEVVExceptions(
  filters: AnalyticsFilters,
  _options?: { refetchInterval?: number }
) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<VisitException[]>({
    queryKey: ['analytics', 'evv-exceptions', filters],
    queryFn: () => analyticsApi.getEVVExceptions(filters),
    refetchInterval: false, // DISABLED - causing infinite loop on rate limit errors
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats(_options?: { refetchInterval?: number }) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<DashboardStats>({
    queryKey: ['analytics', 'dashboard-stats'],
    queryFn: () => analyticsApi.getDashboardStats(),
    refetchInterval: false, // DISABLED - causing infinite loop on rate limit errors
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch reports list
 */
export function useReports(filters?: Partial<AnalyticsFilters>) {
  const analyticsApi = useAnalyticsApi();
  return useQuery<Report[]>({
    queryKey: ['analytics', 'reports', filters],
    queryFn: () => analyticsApi.getReports(filters),
  });
}

/**
 * Hook to generate a report
 */
export function useGenerateReport() {
  const queryClient = useQueryClient();
  const analyticsApi = useAnalyticsApi();

  return useMutation({
    mutationFn: ({
      reportType,
      filters,
    }: {
      reportType: ReportType;
      filters: AnalyticsFilters;
    }) => analyticsApi.generateReport(reportType, filters),
    onSuccess: () => {
      // Invalidate reports list to refetch
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
    },
  });
}

/**
 * Hook to export a report
 */
export function useExportReport() {
  const analyticsApi = useAnalyticsApi();

  return useMutation({
    mutationFn: ({
      reportId,
      format,
    }: {
      reportId: string;
      format: ExportFormat;
    }) => analyticsApi.exportReport(reportId, format),
    onSuccess: (blob, variables) => {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${variables.reportId}.${variables.format.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
  });
}
