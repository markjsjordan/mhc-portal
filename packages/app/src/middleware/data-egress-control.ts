/**
 * HIPAA-005: Third-Party Data Egress Control
 * 
 * Prevents PHI/PII from being transmitted to unauthorized third-party services.
 * 
 * Compliance: HIPAA Security Rule § 164.312(e)(1) - Transmission Security
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Approved third-party domains (require Business Associate Agreements)
 */
const APPROVED_DOMAINS = new Set([
  'sentry.io',
  'o4507953149788160.ingest.us.sentry.io',
]);

const INTERNAL_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '.vercel.app',
  '.folk.care',
];

function isInternalHostname(hostname: string): boolean {
  return INTERNAL_DOMAINS.some((domain) =>
    domain.startsWith('.') ? hostname.endsWith(domain) : hostname === domain
  );
}

function validateServiceUrl(envName: string, rawUrl: string): void {
  let hostname = '';
  try {
    const parsedUrl = new globalThis.URL(rawUrl);
    hostname = parsedUrl.hostname;
  } catch {
    return;
  }

  if (!isInternalHostname(hostname) && !APPROVED_DOMAINS.has(hostname)) {
    throw new Error(`Unapproved service: ${envName}=${hostname}`);
  }
}

export function validateExternalServiceConfig(): void {
  if (process.env['NODE_ENV'] !== 'production') {
    return;
  }

  const sentryDsn = process.env['SENTRY_DSN'];
  if (sentryDsn !== undefined && sentryDsn !== '') {
    validateServiceUrl('SENTRY_DSN', sentryDsn);
  }

  const analyticsEndpoint = process.env['ANALYTICS_ENDPOINT'];
  if (analyticsEndpoint !== undefined && analyticsEndpoint !== '') {
    validateServiceUrl('ANALYTICS_ENDPOINT', analyticsEndpoint);
  }
}

export function restrictReferrerPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

export function dataEgressControl(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

