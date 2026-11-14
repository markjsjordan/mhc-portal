/**
 * Extract a human-readable error message from an API error response.
 *
 * The backend error handler responds with `{ success: false, error: "<message>" }`,
 * while some endpoints or client-side errors may use `message`.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })
      .response?.data;
    if (typeof data?.error === 'string' && data.error.length > 0) {
      return data.error;
    }
    if (typeof data?.message === 'string' && data.message.length > 0) {
      return data.message;
    }
  }
  return fallback;
}
