import type { ApiError, RequestConfig } from '../types/api';
import { extractApiErrorMessage } from '../utils/api-error';
import { retryWithBackoff, requestDeduplicator, requestThrottler } from '../utils/request-utils';

export interface UserContextHeaders {
  userId?: string;
  organizationId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface ApiClientOptions {
  onRefresh?: () => Promise<{ token: string }>;
  onAuthFailure?: () => void;
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
  private onRefresh?: () => Promise<{ token: string }>;
  private onAuthFailure?: () => void;
  private refreshPromise: Promise<{ token: string }> | null = null;

  constructor(
    baseUrl: string, 
    getAuthToken: () => string | null,
    getUserContext: () => UserContextHeaders | null,
    options?: ApiClientOptions
  ) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
    this.getUserContext = getUserContext;
    this.onRefresh = options?.onRefresh;
    this.onAuthFailure = options?.onAuthFailure;
  }

  /**
   * Core fetch logic without retry/throttle wrappers.
   * Used by the retry logic to avoid infinite nesting.
   */
  private async coreFetch<T>(
    url: string,
    fetchOptions: RequestInit,
    config?: RequestConfig
  ): Promise<T> {
    const token = this.getAuthToken();
    const userContext = this.getUserContext();
    const responseType = config?.responseType ?? 'json';

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
      credentials: config?.credentials ?? 'same-origin',
      ...(config?.signal !== undefined && { signal: config.signal }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: response.statusText,
        code: response.status.toString(),
        status: response.status,
      }));

      // Attach response data to error for better error handling
      const errorMessage = extractApiErrorMessage(error, response.statusText);
      const enhancedError = new Error(errorMessage) as Error & { response?: { data: ApiError }; status?: number };
      enhancedError.response = { data: error };
      enhancedError.status = response.status;
      throw enhancedError;
    }

    if (responseType === 'text') return response.text() as Promise<T>;
    if (responseType === 'blob') return response.blob() as Promise<T>;
    return response.json();
  }

  private async request<T>(
    url: string,
    options: RequestInit & { config?: RequestConfig } = {},
    isRetry = false
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
          // Handle 401 with refresh/retry BEFORE wrapping in retryWithBackoff
          // to avoid infinite nesting when refresh succeeds
          try {
            return await retryWithBackoff(
              async () => this.coreFetch<T>(url, fetchOptions, config),
              {
                maxRetries: 3,
                initialDelayMs: 1000,
                maxDelayMs: 10000,
                maxJitterMs: 1000,
                // Don't retry 401 for auth endpoints - user should see immediate feedback
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
          } catch (error) {
            // Check if it's a 401 error that should trigger refresh
            const err = error as { status?: number };
            if (
              err.status === 401 &&
              !isRetry &&
              !url.startsWith('/api/auth/') &&
              this.onRefresh
            ) {
              try {
                // Single-flight refresh: reuse existing promise if one is in flight
                if (!this.refreshPromise) {
                  this.refreshPromise = this.onRefresh();
                }
                await this.refreshPromise;
                this.refreshPromise = null;

                // Retry the original request exactly once with new token
                // Use coreFetch directly to avoid infinite nesting
                return await this.coreFetch<T>(url, fetchOptions, config);
              } catch (refreshError) {
                // Refresh failed - clear auth and redirect
                this.refreshPromise = null;
                if (this.onAuthFailure) {
                  this.onAuthFailure();
                  // Return a promise that never resolves - we're redirecting to login
                  // This prevents errors from being shown to the user
                  return new Promise<T>(() => {
                    // Intentionally never resolve - redirect happens immediately
                  });
                }
                throw refreshError;
              }
            }

            // Not a 401 or already retried or auth endpoint - rethrow
            throw error;
          }
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
  getUserContext?: () => UserContextHeaders | null,
  options?: ApiClientOptions
): ApiClient => {
  return new ApiClientImpl(baseUrl, getAuthToken, getUserContext || (() => null), options);
};
