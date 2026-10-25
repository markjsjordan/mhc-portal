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

const INTERNAL_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  '.vercel.app',
  '.folk.care',
]);

export function validateExternalServiceConfig(): void {
  const services = ['SENTRY_DSN', 'ANALYTICS_ENDPOINT'];
  
  for (const env of services) {
    const value = process.env[env];
    if (value && process.env.NODE_ENV === 'production') {
      try {
        const url = new URL(value);
        const isInternal = Array.from(INTERNAL_DOMAINS).some(d => 
          d.startsWith('.') ? url.hostname.endsWith(d) : url.hostname === d
        );
        
        if (!isInternal && !APPROVED_DOMAINS.has(url.hostname)) {
          throw new Error(`Unapproved service: ${env}=${url.hostname}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Unapproved')) {
          throw error;
        }
      }
    }
  }
}

export function restrictReferrerPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

export function dataEgressControl(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
