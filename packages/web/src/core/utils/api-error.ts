import type { ApiError } from '../types/api';

/**
 * Build a human-readable message from an API error body.
 *
 * The backend returns either `{ message }`, `{ error: 'text' }` or the structured
 * `{ error: { message, code, details } }` shape. Passing the structured object straight
 * to `new Error()` renders as "[object Object]", so always resolve to a string here.
 * Validation `details.errors` (string[]) are appended so users see the actual reason.
 */
export function extractApiErrorMessage(body: ApiError | null | undefined, fallback: string): string {
  const nested = typeof body?.error === 'object' ? body.error : undefined;
  const base =
    (typeof body?.message === 'string' && body.message) ||
    (typeof body?.error === 'string' && body.error) ||
    nested?.message ||
    fallback;

  const details = nested?.details ?? body?.details;
  const detailErrors = details?.errors;
  if (Array.isArray(detailErrors)) {
    const reasons = detailErrors.filter((e): e is string => typeof e === 'string' && e.length > 0);
    if (reasons.length > 0) return `${base}: ${reasons.join('; ')}`;
  }
  return base;
}
