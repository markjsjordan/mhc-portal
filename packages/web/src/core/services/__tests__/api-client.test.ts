import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, registerUnauthorizedHandler } from '../api-client';

describe('api-client global 401 handling', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    // Reset the module-level handler between tests
    registerUnauthorizedHandler(() => {});
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

  it('calls the registered handler on a 401 from a protected endpoint', async () => {
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));

    const client = createApiClient('https://api.test', () => 'stale-token');

    await expect(client.get('/api/clients')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT call the handler for a 401 from /api/auth/login (expected bad-credentials case)', async () => {
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Invalid credentials' }));

    const client = createApiClient('https://api.test', () => null);

    await expect(client.post('/api/auth/login', { email: 'x', password: 'y' })).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT call the handler for a 401 from /api/auth/refresh', async () => {
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    mockFetch.mockResolvedValue(jsonResponse(401, { message: 'Refresh token expired' }));

    const client = createApiClient('https://api.test', () => 'stale-refresh');

    await expect(client.post('/api/auth/refresh')).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler on a successful response', async () => {
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    mockFetch.mockResolvedValue(jsonResponse(200, { success: true, data: [] }));

    const client = createApiClient('https://api.test', () => 'valid-token');
    await client.get('/api/clients');

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call the handler on a non-401 error (e.g. 403, non-retryable)', async () => {
    const handler = vi.fn();
    registerUnauthorizedHandler(handler);
    mockFetch.mockResolvedValue(jsonResponse(403, { message: 'Forbidden' }));

    const client = createApiClient('https://api.test', () => 'valid-token');
    await expect(client.get('/api/clients')).rejects.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });
});
