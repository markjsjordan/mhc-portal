import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsApiService, createAnalyticsApiService } from '../analytics-api';
import type { ApiClient } from '@/core/services';
import { useAuthStore } from '@/core/hooks/auth';

describe('AnalyticsApiService', () => {
  let mockApiClient: Partial<ApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: null, user: null, isAuthenticated: false });

    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
  });

  describe('with ApiClient', () => {
    it('calls apiClient.get for getOperationalKPIs with query parameters', async () => {
      const mockKPIs = { clientMetrics: { activeClients: 10 } };
      vi.mocked(mockApiClient.get!).mockResolvedValue(mockKPIs);

      const service = createAnalyticsApiService(mockApiClient as ApiClient);
      const startDate = new Date('2026-01-01T00:00:00Z');
      const endDate = new Date('2026-01-31T00:00:00Z');

      const result = await service.getOperationalKPIs({
        dateRange: { startDate, endDate },
        branchId: 'branch-123',
      });

      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      const calledUrl = vi.mocked(mockApiClient.get!).mock.calls[0][0];
      expect(calledUrl).toContain('/api/analytics/kpis?');
      expect(calledUrl).toContain('startDate=2026-01-01T00%3A00%3A00.000Z');
      expect(calledUrl).toContain('endDate=2026-01-31T00%3A00%3A00.000Z');
      expect(calledUrl).toContain('branchId=branch-123');
      expect(result).toEqual(mockKPIs);
    });

    it('calls apiClient.get for getComplianceAlerts', async () => {
      const mockAlerts = [{ id: '1', title: 'Test Alert', severity: 'warning' }];
      vi.mocked(mockApiClient.get!).mockResolvedValue(mockAlerts);

      const service = new AnalyticsApiService(mockApiClient as ApiClient);
      const result = await service.getComplianceAlerts({
        dateRange: { startDate: new Date(), endDate: new Date() },
        branchId: 'branch-abc',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/analytics/compliance-alerts?branchId=branch-abc');
      expect(result).toEqual(mockAlerts);
    });

    it('calls apiClient.get for getDashboardStats', async () => {
      const mockStats = { inProgress: 5, completedToday: 12, needsReview: 2 };
      vi.mocked(mockApiClient.get!).mockResolvedValue(mockStats);

      const service = new AnalyticsApiService(mockApiClient as ApiClient);
      const result = await service.getDashboardStats();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/analytics/dashboard-stats');
      expect(result).toEqual(mockStats);
    });

    it('calls apiClient.post for generateReport', async () => {
      const mockReport = { id: 'rep-1', title: 'Monthly' };
      vi.mocked(mockApiClient.post!).mockResolvedValue(mockReport);

      const service = new AnalyticsApiService(mockApiClient as ApiClient);
      const filters = {
        dateRange: { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') },
      };

      const result = await service.generateReport('COMPLIANCE' as any, filters);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/analytics/reports/generate', {
        reportType: 'COMPLIANCE',
        ...filters,
      });
      expect(result).toEqual(mockReport);
    });

    it('calls apiClient.get with blob responseType for exportReport', async () => {
      const mockBlob = new Blob(['data'], { type: 'application/pdf' });
      vi.mocked(mockApiClient.get!).mockResolvedValue(mockBlob);

      const service = new AnalyticsApiService(mockApiClient as ApiClient);
      const result = await service.exportReport('rep-123', 'PDF' as any);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/analytics/reports/rep-123/export?format=PDF',
        { responseType: 'blob' }
      );
      expect(result).toEqual(mockBlob);
    });
  });

  describe('fallback mode with baseUrl', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('attaches in-memory token from useAuthStore to Authorization header', async () => {
      useAuthStore.setState({ token: 'jwt-access-token-xyz', isAuthenticated: true });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'ok' }),
      } as any);

      const service = new AnalyticsApiService('https://api.example.com');
      await service.getDashboardStats();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.example.com/api/analytics/dashboard-stats');
      expect((options as any)?.headers?.['Authorization']).toBe('Bearer jwt-access-token-xyz');
    });
  });
});
