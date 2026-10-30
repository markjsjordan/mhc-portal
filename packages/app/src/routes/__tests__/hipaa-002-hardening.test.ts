/**
 * HIPAA-002 Hardening Tests:
 * - Demo Read-Only Middleware (/api/clients write blocking + JWT decoding)
 * - Demo Routes production guard
 * - Compliance Cron Scan timingSafeEqual CRON_SECRET enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { JWTUtils, type Database } from '@folkcare/core';
import { demoReadOnlyMiddleware, DEMO_WRITABLE_PATHS } from '../../middleware/demo-read-only.js';
import { createDemoRouter } from '../demo.js';
import { createComplianceRouter } from '../compliance.js';

describe('HIPAA-002 Security Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('demoReadOnlyMiddleware', () => {
    it('does not whitelist /api/clients in DEMO_WRITABLE_PATHS', () => {
      expect(DEMO_WRITABLE_PATHS).not.toContain('/api/clients');
    });

    it('blocks POST /api/clients for authenticated @folkcare.example demo user via Bearer JWT even before route-level requireAuth', async () => {
      process.env.DEMO_READ_ONLY = 'true';
      process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long';
      process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-at-least-32-characters';
      const tokens = JWTUtils.generateTokenPair({
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'admin@folkcare.example',
        organizationId: '22222222-2222-2222-2222-222222222222',
        branchIds: [],
        roles: ['ORG_ADMIN'],
        permissions: ['*'],
        tokenVersion: 1,
      });

      const app = express();
      app.disable('x-powered-by');
      app.use(express.json());
      app.use(demoReadOnlyMiddleware);
      app.post('/api/clients', (_req, res) => {
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ firstName: 'Test', lastName: 'Client' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('DEMO_READ_ONLY');
    });
  });

  describe('Demo Routes Production Guard (/api/demo/*)', () => {
    it('returns 404 in production when DEMO_MODE is not true', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEMO_MODE;

      const mockDb = { query: vi.fn() } as unknown as Database;
      const app = express();
      app.disable('x-powered-by');
      app.use(express.json());
      app.use('/api/demo', createDemoRouter(mockDb));

      const response = await request(app).get('/api/demo/stats');
      expect(response.status).toBe(404);
    });
  });

  describe('Compliance Cron Scan (/api/compliance/cron/scan)', () => {
    it('rejects User-Agent: vercel-cron bypass when CRON_SECRET is missing or not provided', async () => {
      delete process.env.CRON_SECRET;
      const mockDb = { query: vi.fn() } as unknown as Database;
      const app = express();
      app.disable('x-powered-by');
      app.use(express.json());
      app.use('/api/compliance', createComplianceRouter(mockDb));

      const response = await request(app)
        .post('/api/compliance/cron/scan')
        .set('User-Agent', 'vercel-cron/1.0');

      expect(response.status).toBe(401);
    });

    it('rejects invalid CRON_SECRET and accepts matching CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'super-secret-cron-token-12345';
      const mockDb = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Database;
      const app = express();
      app.disable('x-powered-by');
      app.use(express.json());
      app.use('/api/compliance', createComplianceRouter(mockDb));

      const badRes = await request(app)
        .post('/api/compliance/cron/scan')
        .set('Authorization', 'Bearer wrong-secret');
      expect(badRes.status).toBe(401);

      const goodRes = await request(app)
        .post('/api/compliance/cron/scan')
        .set('Authorization', 'Bearer super-secret-cron-token-12345');
      expect(goodRes.status).toBe(200);
      expect(goodRes.body.success).toBe(true);
    });
  });
});
