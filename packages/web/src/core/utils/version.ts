/**
 * Application version and PWA force-update URL helpers.
 */

const DEFAULT_VERSION = '1.5.0';
const DEFAULT_ORIGIN = 'https://mhc-family-portal.vercel.app';

/**
 * Formats a raw version string (e.g. "1.5.0" or "v1.5.0") into a display badge
 * such as "v1.5.0".
 */
export function formatAppVersion(rawVersion?: string): string {
  const trimmed = rawVersion?.trim();
  if (!trimmed || trimmed === 'dev') {
    return `v${DEFAULT_VERSION}`;
  }
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

/**
 * Returns the formatted application version injected at build time via
 * `import.meta.env.VITE_APP_VERSION` (sourced from package.json or
 * REACT_APP_VERSION / VITE_APP_VERSION).
 */
export function getAppVersion(): string {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_APP_VERSION
      : undefined;
  return formatAppVersion(raw);
}

/**
 * Returns the deterministic public URL for triggering a PWA force-update.
 */
export function getForceUpdateUrl(origin?: string): string {
  const resolvedOrigin =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : DEFAULT_ORIGIN);
  return `${resolvedOrigin.replace(/\/+$/, '')}/force-update`;
}
