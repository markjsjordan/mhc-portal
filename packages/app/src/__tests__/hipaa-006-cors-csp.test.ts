/**
 * HIPAA-006: Lock Down Wildcard/Substring CORS Bypass and Restore Strict Content-Security-Policy (CSP)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import cors from 'cors';
import request from 'supertest';
import { isOriginAllowed } from '../server.js';
import { securityHeaders } from '../middleware/security-headers.js';

describe('HIPAA-006: CORS Origin Validation & Strict CSP/HSTS Hardening', () => {
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    process.env['NODE_ENV'] = 'production';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  describe('CORS Origin Enforcement', () => {
    let app: Express;
    let allowedOrigins: string[];

    beforeEach(() => {
      allowedOrigins = ['https://folk.care'];
      app = express();
      app.use(
        cors({
          origin: (origin, callback) => {
            if (isOriginAllowed(origin, allowedOrigins, process.env['NODE_ENV'] ?? 'production')) {
              callback(null, true);
              return;
            }
            callback(new Error(`Origin ${origin ?? 'unknown'} not allowed by CORS`), false);
          },
          credentials: true,
        })
      );
      app.get('/api/test', (_req, res) => {
        res.json({ ok: true });
      });
    });

    it('rejects third-party Vercel origin https://evil-project.vercel.app without Access-Control-Allow-Origin', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://evil-project.vercel.app');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.status).toBe(500);
    });

    it('rejects substring spoofing origin https://folk.care.vercel.app.evil.com and https://folk-care.vercel.app.evil.com', async () => {
      const res1 = await request(app)
        .get('/api/test')
        .set('Origin', 'https://folk.care.vercel.app.evil.com');
      expect(res1.headers['access-control-allow-origin']).toBeUndefined();

      const res2 = await request(app)
        .get('/api/test')
        .set('Origin', 'https://folk-care.vercel.app.evil.com');
      expect(res2.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects wildcard "*" in allowedOrigins when credentialed CORS is active', async () => {
      allowedOrigins = ['*'];
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://untrusted.example.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows organization Vercel deployments https://mhc-family-portal.vercel.app and https://folk-care-preview-123.vercel.app', async () => {
      const res1 = await request(app)
        .get('/api/test')
        .set('Origin', 'https://mhc-family-portal.vercel.app')
        .expect(200);
      expect(res1.headers['access-control-allow-origin']).toBe('https://mhc-family-portal.vercel.app');
      expect(res1.headers['access-control-allow-credentials']).toBe('true');

      const res2 = await request(app)
        .get('/api/test')
        .set('Origin', 'https://folk-care-preview-123.vercel.app')
        .expect(200);
      expect(res2.headers['access-control-allow-origin']).toBe('https://folk-care-preview-123.vercel.app');
    });

    it('allows exact configured origins in CORS_ORIGIN in production and preview', async () => {
      process.env['NODE_ENV'] = 'preview';
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://folk.care')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://folk.care');
    });
  });

  describe('Security Headers (CSP & HSTS)', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(securityHeaders);
      app.get('/api/test', (_req, res) => {
        res.json({ ok: true });
      });
    });

    it('includes Content-Security-Policy without script-src unsafe-inline and restricts connect-src', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("connect-src 'self' https://*.vercel.app https://*.neon.tech");
    });

    it('includes Strict-Transport-Security with max-age=31536000; includeSubDomains; preload in production', async () => {
      process.env['NODE_ENV'] = 'production';
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
    });
  });
});
