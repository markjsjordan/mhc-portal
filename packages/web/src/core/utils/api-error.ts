import type { ApiError } from '../types/api';

/**
 * Build a human-readable message from an API error body.
 *
 * The backend returns either `{ message }`, `{ error: 'text' }` or the structured
 * `{ error: { message, code, details } }` shape. Passing the structured object straight
 * to `new Error()` renders as "[object Object]", so always resolve to a string here.
 * Validation `details.errors` (string[]) are appended so users see the actual reason.
 */
function formatDetailErrorEntry(entry: unknown): string {
  if (typeof entry === 'string') {
    return entry.trim();
  }
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const record = entry as { field?: unknown; message?: unknown };
  const field = typeof record.field === 'string' ? record.field.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (field && message) {
    return `${field}: ${message}`;
  }
  return message || field;
}

export function extractApiErrorMessage(body: ApiError | null | undefined, fallback: string): string {
  const nested = typeof body?.error === 'object' ? body.error : undefined;
  const messageStr = typeof body?.message === 'string' ? body.message : undefined;
  const errorStr = typeof body?.error === 'string' ? body.error : undefined;
  const base = messageStr ?? errorStr ?? nested?.message ?? fallback;

  const details = nested?.details ?? body?.details;
  const detailErrors = details?.errors;
  if (!Array.isArray(detailErrors)) {
    return base;
  }

  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const entry of detailErrors) {
    const formatted = formatDetailErrorEntry(entry);
    if (formatted && !seen.has(formatted)) {
      seen.add(formatted);
      reasons.push(formatted);
      if (reasons.length >= 5) break;
    }
  }
  if (reasons.length === 0) {
    return base;
  }

  const joined = reasons.join('; ');
  const full = `${base}: ${joined}`;
  return full.length > 300 ? `${full.slice(0, 297)}...` : full;
}
