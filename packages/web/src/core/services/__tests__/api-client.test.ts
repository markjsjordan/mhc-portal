import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../api-client';

describe('api-client 401 refresh/retry interceptor', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function jsonResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 401 ? 'Unauthorized' : 'Error',
      json: () => Promise.resolve(body),
    };
  }

  it('retries request after successful refresh on 401', async () => {
    const onRefresh = vi.fn().mockResolvedValue({ token: 'new-token' });
    const onAuthFailure = vi.fn();

    // First call returns 401, second call (retry) succeeds
    mockFetch
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '123' } }));

    const client = createApiClient('https://api.test', () => 'stale-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    const result = await client.get('/api/clients/123');

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, data: { id: '123' } });
  });

  it('calls onAuthFailure when refresh fails', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('Refresh failed'));
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));

    const client = createApiClient('https://api.test', () => 'stale-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.get('/api/clients/123')).rejects.toThrow('Refresh failed');

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('does NOT refresh for 401 from /api/auth/* endpoints', async () => {
    const onRefresh = vi.fn();
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Invalid credentials' }));

    const client = createApiClient('https://api.test', () => null, undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.post('/api/auth/login', { email: 'x', password: 'y' })).rejects.toThrow();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('does NOT refresh for 401 from /api/auth/refresh', async () => {
    const onRefresh = vi.fn();
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Refresh token expired' }));

    const client = createApiClient('https://api.test', () => 'stale-refresh', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.post('/api/auth/refresh')).rejects.toThrow();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('does NOT refresh for 401 from /api/auth/logout', async () => {
    const onRefresh = vi.fn();
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

    const client = createApiClient('https://api.test', () => 'token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.post('/api/auth/logout')).rejects.toThrow();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('does not refresh on successful response', async () => {
    const onRefresh = vi.fn();
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(200, { success: true, data: [] }));

    const client = createApiClient('https://api.test', () => 'valid-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await client.get('/api/clients');

    expect(onRefresh).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('does not refresh on non-401 errors', async () => {
    const onRefresh = vi.fn();
    const onAuthFailure = vi.fn();

    mockFetch.mockResolvedValue(jsonResponse(403, { message: 'Forbidden' }));

    const client = createApiClient('https://api.test', () => 'valid-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.get('/api/clients')).rejects.toThrow();

    expect(onRefresh).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('CRITICAL: concurrent 401s trigger exactly ONE refresh call (single-flight)', async () => {
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          // Simulate slow refresh
          setTimeout(() => resolve({ token: 'new-token' }), 50);
        })
    );
    const onAuthFailure = vi.fn();

    // All calls return 401 first, then succeed on retry
    mockFetch.mockImplementation((url: string) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      // Return 401 on first call, 200 on retry
      if (mockFetch.mock.calls.length <= 3) {
        return Promise.resolve(jsonResponse(401, { message: 'Token expired' }));
      }
      return Promise.resolve(
        jsonResponse(200, {
          success: true,
          data: { endpoint: urlStr.split('/').pop() },
        })
      );
    });

    const client = createApiClient('https://api.test', () => 'stale-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    // Fire 3 concurrent requests that all get 401
    const [result1, result2, result3] = await Promise.all([
      client.get('/api/clients/1'),
      client.get('/api/clients/2'),
      client.get('/api/clients/3'),
    ]);

    // All should succeed
    expect(result1).toEqual({ success: true, data: { endpoint: '1' } });
    expect(result2).toEqual({ success: true, data: { endpoint: '2' } });
    expect(result3).toEqual({ success: true, data: { endpoint: '3' } });

    // Critical: refresh should be called exactly ONCE (single-flight)
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();

    // Should be 3 initial calls (all 401) + 3 retries (all 200) = 6 total
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('does not retry more than once (prevents infinite loop)', async () => {
    const onRefresh = vi.fn().mockResolvedValue({ token: 'new-token' });
    const onAuthFailure = vi.fn();

    // Always return 401, even after refresh
    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));

    const client = createApiClient('https://api.test', () => 'stale-token', undefined, {
      onRefresh,
      onAuthFailure,
    });

    await expect(client.get('/api/clients/123')).rejects.toThrow();

    // Should refresh once, retry once, then give up
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });
});
