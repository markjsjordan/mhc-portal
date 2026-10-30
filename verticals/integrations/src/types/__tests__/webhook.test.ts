/**
 * Tests for Webhook Schema SSRF & HTTPS Enforcement (HIPAA-005)
 */

import { describe, it, expect } from 'vitest';
import { CreateWebhookSchema, UpdateWebhookSchema } from '../webhook.js';

describe('CreateWebhookSchema & UpdateWebhookSchema Security (HIPAA-005)', () => {
  const validBase = {
    name: 'EVV Partner Webhook',
    events: ['visit.completed'],
  };

  it('accepts valid external https:// webhook URLs', () => {
    const parsed = CreateWebhookSchema.safeParse({
      ...validBase,
      url: 'https://webhooks.partner-ehr.com/v1/events',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects plaintext http:// webhook URLs', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    const insecureUrl = 'http://webhooks.partner-ehr.com/v1/events';
    const parsed = CreateWebhookSchema.safeParse({
      ...validBase,
      url: insecureUrl,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects AWS/cloud metadata link-local URL https://169.254.169.254', () => {
    const parsed = CreateWebhookSchema.safeParse({
      ...validBase,
      url: 'https://169.254.169.254/latest/meta-data/',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects localhost and loopback addresses (127.0.0.1, ::1)', () => {
    for (const url of [
      'https://localhost:8443/hook',
      'https://127.0.0.1/hook',
      'https://127.0.1.1/hook',
      'https://[::1]/hook',
    ]) {
      const parsed = CreateWebhookSchema.safeParse({ ...validBase, url });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects private RFC 1918 IPv4 ranges (10.x, 172.16-31.x, 192.168.x)', () => {
    for (const url of [
      'https://10.0.0.15/webhook',
      'https://172.16.0.1/webhook',
      'https://172.31.255.254/webhook',
      'https://192.168.1.100/webhook',
    ]) {
      const parsed = CreateWebhookSchema.safeParse({ ...validBase, url });
      expect(parsed.success).toBe(false);
    }
  });

  it('enforces the same URL restrictions on UpdateWebhookSchema', () => {
    const insecureUpdateUrl = 'http://example.com/hook';
    expect(
      UpdateWebhookSchema.safeParse({ url: insecureUpdateUrl }).success
    ).toBe(false);
    expect(
      UpdateWebhookSchema.safeParse({ url: 'https://169.254.169.254/hook' }).success
    ).toBe(false);
    expect(
      UpdateWebhookSchema.safeParse({ url: 'https://api.valid-partner.org/hook' }).success
    ).toBe(true);
  });
});
