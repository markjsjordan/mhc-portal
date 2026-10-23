import type { ApiError, RequestConfig } from '../types/api';
import { extractApiErrorMessage } from '../utils/api-error';
import { retryWithBackoff, requestDeduplicator, requestThrottler } from '../utils/request-utils';

export interface UserContextHeaders {
  userId?: string;
  organizationId?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Global 401 handler, registered once by the app shell (see App.tsx).
 *
 * The server rejects an expired/invalid/revoked token with 401 on any
 * request. Before this existed, nothing reacted to that: the SPA's
 * `isAuthenticated` flag (persisted in localStorage/zustand) stayed
 * true, `ProtectedRoute` kept rendering the authenticated shell, and
 * every query/mutation on the page just failed silently or showed a
 * generic error — the user was never redirected to /login even though
 * their session was no longer valid server-side.
 *
 * Login/refresh/logout calls are intentionally excluded (see the
 * `isAuthEndpoint` check below) since a 401 there is an expected,
 * normal outcome (bad credentials, expired refresh token) handled by
 * the calling form/flow, not a "your session died mid-use" event.
 */
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout')
  );
}

export interface ApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  delete<T>(url: string, config?: RequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
}

class ApiClientImpl implements ApiClient {
  private baseUrl: string;
  private getAuthToken: () => string | null;
  private getUserContext: () => UserContextHeaders | null;

  constructor(
    baseUrl: string, 
    getAuthToken: () => string | null,
    getUserContext: () => UserContextHeaders | null
  ) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
    this.getUserContext = getUserContext;
  }

  private async request<T>(
    url: string,
    options: RequestInit & { config?: RequestConfig } = {}
  ): Promise<T> {
    const { config, ...fetchOptions } = options;
    const method = fetchOptions.method ?? 'GET';

    // Create request key for deduplication (method + url + body hash)
    const bodyHash = fetchOptions.body ? JSON.stringify(fetchOptions.body).slice(0, 50) : '';
    const responseType = config?.responseType ?? 'json';
    const requestKey = `${method}:${url}${bodyHash}${responseType === 'json' ? '' : `:${responseType}`}`;

    // For GET requests, use deduplication to prevent duplicate concurrent requests
    // For mutations (POST/PUT/PATCH/DELETE), skip deduplication to allow multiple submissions
    const shouldDeduplicate = method === 'GET';

    const executeRequest = async (): Promise<T> => {
      // Apply throttling for all requests (max 1 request per endpoint per 500ms)
      return requestThrottler.throttle(
        url,
        async () => {
          // Apply retry logic with exponential backoff
          return retryWithBackoff(
            async () => {
              const token = this.getAuthToken();
              const userContext = this.getUserContext();

              const headers: HeadersInit = {
                'Content-Type': 'application/json',
                ...config?.headers,
              };

              if (token) {
                headers['Authorization'] = `Bearer ${token}`;
              }

              // Add user context headers for backend filtering
              if (userContext) {
                if (userContext.userId) {
                  headers['X-User-Id'] = userContext.userId;
                }
                if (userContext.organizationId) {
                  headers['X-Organization-Id'] = userContext.organizationId;
                }
                if (userContext.roles && userContext.roles.length > 0) {
                  headers['X-User-Roles'] = userContext.roles.join(',');
                }
                if (userContext.permissions && userContext.permissions.length > 0) {
                  headers['X-User-Permissions'] = userContext.permissions.join(',');
                }
              }

              const response = await fetch(`${this.baseUrl}${url}`, {
                ...fetchOptions,
                headers,
                ...(config?.signal !== undefined && { signal: config.signal }),
              });

              if (!response.ok) {
                const error: ApiError = await response.json().catch(() => ({
                  message: response.statusText,
                  code: response.status.toString(),
                  status: response.status,
                }));

                // Fire the global "session died" handler on 401s outside
                // the auth flow itself. Fire-and-continue: still throw
                // below so the calling query/mutation also sees the
                // rejection and can show its own error state briefly
                // before the redirect takes effect.
                if (response.status === 401 && !isAuthEndpoint(url) && onUnauthorized) {
                  onUnauthorized();
                }

                // Attach response data to error for better error handling
                const errorMessage = extractApiErrorMessage(error, response.statusText);
                const enhancedError = new Error(errorMessage) as Error & { response?: { data: ApiError }; status?: number };
                enhancedError.response = { data: error };
                enhancedError.status = response.status;
                throw enhancedError;
              }

              if (responseType === 'text') return response.text();
              if (responseType === 'blob') return response.blob();
              return response.json();
            },
            {
              maxRetries: 3,
              initialDelayMs: 1000,
              maxDelayMs: 10000,
              maxJitterMs: 1000,
              // Don't retry 429 for auth endpoints - user should see immediate feedback
              retryableStatuses: url.includes('/auth/') ? [500, 502, 503, 504] : [429, 500, 502, 503, 504],
              onRetry: (attempt, delayMs, error) => {
                console.warn(
                  'Request failed, retrying...',
                  'url:', url,
                  'attempt:', attempt,
                  'delay:', delayMs + 'ms',
                  error
                );
              },
            }
          );
        },
        { minIntervalMs: 500 }
      );
    };

    // Apply deduplication for GET requests only
    if (shouldDeduplicate) {
      return requestDeduplicator.deduplicate(requestKey, executeRequest);
    }

    return executeRequest();
  }

  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { 
      method: 'GET', 
      ...(config !== undefined && { config: config }) 
    });
  }

  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...(config !== undefined && { config: config }),
    });
  }

  async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...(config !== undefined && { config: config }),
    });
  }

  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...(config !== undefined && { config: config }),
    });
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, { 
      method: 'DELETE', 
      ...(config !== undefined && { config: config }) 
    });
  }
}

export const createApiClient = (
  baseUrl: string,
  getAuthToken: () => string | null,
  getUserContext?: () => UserContextHeaders | null
): ApiClient => {
  return new ApiClientImpl(baseUrl, getAuthToken, getUserContext || (() => null));
};
