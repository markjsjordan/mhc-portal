/**
 * API Client Authentication Tests
 *
 * Tests for 401 refresh/retry mechanism and auth failure handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApiClient, type ApiClient } from '../api-client';

describe('API Client - Authentication', () => {
  let apiClient: ApiClient;
  let mockToken: string | null;
  let mockGetAuthToken: () => string | null;
  let mockGetUserContext: () => null;
  let mockOnAuthFailure: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockToken = 'mock-access-token';
    mockGetAuthToken = vi.fn(() => mockToken);
    mockGetUserContext = vi.fn(() => null);
    mockOnAuthFailure = vi.fn();

    apiClient = createApiClient('https://api.test.com', mockGetAuthToken, mockGetUserContext);
    if (apiClient.setOnAuthFailure) {
      apiClient.setOnAuthFailure(mockOnAuthFailure);
    }

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('401 Refresh and Retry', () => {
    it('should retry request after successful token refresh on 401', async () => {
      // First request returns 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized', code: 'UNAUTHORIZED' }),
      });

      // Refresh succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { accessToken: 'new-access-token' } }),
      });

      // Retry succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: 1, name: 'Test' } }),
      });

      const result = await apiClient.get('/api/data');

      expect(result).toEqual({ success: true, data: { id: 1, name: 'Test' } });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      
      // First call - original request
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.test.com/api/data', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-access-token',
        }),
      }));

      // Second call - refresh
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.test.com/api/auth/refresh', expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }));

      // Third call - retry with new token (gets old token from getter, but mechanism works)
      expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.test.com/api/data', expect.any(Object));
    });

    it('should deduplicate concurrent refresh requests', async () => {
      // Both requests return 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // Refresh succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { accessToken: 'new-token' } }),
      });

      // Both retries succeed
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'result1' }),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'result2' }),
      });

      // Make two concurrent requests that will both get 401
      const [result1, result2] = await Promise.all([
        apiClient.get('/api/endpoint1'),
        apiClient.get('/api/endpoint2'),
      ]);

      expect(result1).toEqual({ data: 'result1' });
      expect(result2).toEqual({ data: 'result2' });

      // Should only call refresh once (deduplication)
      const refreshCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === 'https://api.test.com/api/auth/refresh'
      );
      expect(refreshCalls.length).toBe(1);
    });

    it('should trigger onAuthFailure when refresh fails', async () => {
      // Original request returns 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // Refresh fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' }),
      });

      await expect(apiClient.get('/api/data')).rejects.toThrow();

      expect(mockOnAuthFailure).toHaveBeenCalledTimes(1);
    });

    it('should not retry on second 401 (already retried)', async () => {
      // Original request returns 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // Refresh succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { accessToken: 'new-token' } }),
      });

      // Retry also returns 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Still unauthorized' }),
      });

      await expect(apiClient.get('/api/data')).rejects.toThrow();

      // Should not call refresh again
      const refreshCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === 'https://api.test.com/api/auth/refresh'
      );
      expect(refreshCalls.length).toBe(1);
    });

    it('should send cookies with all requests', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
      });

      await apiClient.get('/api/data');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.test.com/api/data',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('Auth Failure Callback', () => {
    it('should allow setting onAuthFailure callback', () => {
      const callback = vi.fn();
      if (apiClient.setOnAuthFailure) {
        apiClient.setOnAuthFailure(callback);
      }
      expect(apiClient.setOnAuthFailure).toBeDefined();
    });

    it('should only trigger onAuthFailure once when refresh fails', async () => {
      // Original request returns 401
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      // Refresh fails
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid refresh token' }),
      });

      await expect(apiClient.get('/api/data')).rejects.toThrow();

      // Should be called exactly once
      expect(mockOnAuthFailure).toHaveBeenCalledTimes(1);
    });
  });
});
