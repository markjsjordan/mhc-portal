/**
 * AuthService & StripeService Security Unit Tests (HIPAA-002)
 */

import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth-service.js';
import { StripeService } from '../stripe.service.js';
import { initCacheService, getCacheService } from '../cache.service.js';
import { AuthenticationError, PermissionError } from '../../types/base.js';
import type { Database } from '../../db/connection.js';

describe('AuthService - Google OAuth Hardening (HIPAA-002)', () => {
  let mockDb: Database;
  let authService: AuthService;
  let verifyIdTokenSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await initCacheService();
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    authService = new AuthService(mockDb);
    verifyIdTokenSpy = vi.fn();
    (authService as unknown as { googleClient: { verifyIdToken: unknown } }).googleClient = {
      verifyIdToken: verifyIdTokenSpy,
    };
  });

  afterEach(async () => {
    const cache = getCacheService();
    await cache.clearAll();
    await cache.close();
  });

  it('rejects unverified Google email addresses (email_verified === false)', async () => {
    verifyIdTokenSpy.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified User',
      }),
    });

    await expect(authService.loginWithGoogle('google-id-token')).rejects.toThrow(
      AuthenticationError
    );
  });

  it('rejects uninvited/unprovisioned Google accounts with 403 PermissionError instead of auto-provisioning', async () => {
    verifyIdTokenSpy.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-456',
        email: 'uninvited@example.com',
        email_verified: true,
        name: 'Uninvited User',
      }),
    });

    // No user found in DB
    (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

    await expect(
      authService.loginWithGoogle('google-id-token', '11111111-1111-1111-1111-111111111111')
    ).rejects.toThrow(PermissionError);

    try {
      await authService.authenticateWithGoogle(
        'google-id-token',
        '11111111-1111-1111-1111-111111111111'
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionError);
      expect((error as PermissionError).statusCode).toBe(403);
      expect((error as PermissionError).message).toContain('Account not invited or provisioned');
    }

    // Verify no INSERT INTO users was executed
    const queries = (mockDb.query as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => String(call[0])
    );
    expect(queries.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });
});

describe('StripeService.verifyWebhookSignature (HIPAA-002)', () => {
  const secret = 'whsec_test_secret_key_for_hmac_verification';
  const payload = JSON.stringify({ id: 'evt_123', type: 'invoice.paid' });

  function signPayload(body: string, timestamp: number, webhookSecret = secret): string {
    const hmac = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  it('accepts a valid HMAC-SHA256 Stripe-Signature within timestamp tolerance', () => {
    const service = new StripeService({ apiKey: 'sk_test_123', webhookSecret: secret });
    const now = Math.floor(Date.now() / 1000);
    const sig = signPayload(payload, now);

    expect(service.verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it('rejects when webhook secret is not configured', () => {
    const originalSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
    try {
      const service = new StripeService({ apiKey: 'sk_test_123' });
      const now = Math.floor(Date.now() / 1000);
      const sig = signPayload(payload, now);
      expect(service.verifyWebhookSignature(payload, sig)).toBe(false);
    } finally {
      if (originalSecret !== undefined) {
        process.env['STRIPE_WEBHOOK_SECRET'] = originalSecret;
      }
    }
  });

  it('rejects forged or tampered signatures', () => {
    const service = new StripeService({ apiKey: 'sk_test_123', webhookSecret: secret });
    const now = Math.floor(Date.now() / 1000);
    const sig = signPayload(payload, now, 'wrong_secret');

    expect(service.verifyWebhookSignature(payload, sig)).toBe(false);
  });

  it('rejects replay attacks outside the 300s timestamp tolerance window', () => {
    const service = new StripeService({ apiKey: 'sk_test_123', webhookSecret: secret });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const sig = signPayload(payload, staleTimestamp);

    expect(service.verifyWebhookSignature(payload, sig)).toBe(false);
  });

  it('rejects malformed or empty signature headers', () => {
    const service = new StripeService({ apiKey: 'sk_test_123', webhookSecret: secret });
    expect(service.verifyWebhookSignature(payload, '')).toBe(false);
    expect(service.verifyWebhookSignature(payload, 'invalid_header')).toBe(false);
    expect(service.verifyWebhookSignature(payload, 't=notanumber,v1=abcd')).toBe(false);
  });
});
