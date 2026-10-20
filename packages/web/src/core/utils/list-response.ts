/**
 * Normalizes the many list-response shapes returned by the API (and by the
 * showcase demo provider) into a plain array.
 *
 * Supported shapes:
 *  - `T[]`                                   (showcase provider)
 *  - `{ success, data: T[] }`                (e.g. /api/service-types)
 *  - `{ success, data: { items: T[] } }`     (e.g. /api/clients, paginated)
 *  - `{ items: T[] }`
 *
 * Anything else (undefined, `{ success: true }`, errors) yields `[]` so UI
 * callers can safely `.map()` the result.
 */
export function extractList<T = unknown>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    if ('items' in record && Array.isArray(record.items)) {
      return record.items as T[];
    }
    if ('data' in record) {
      return extractList<T>(record.data);
    }
  }
  return [];
}
