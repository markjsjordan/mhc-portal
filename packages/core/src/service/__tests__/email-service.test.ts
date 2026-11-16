import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildInvitationUrl, EmailService } from '../email-service.js';

describe('buildInvitationUrl', () => {
  const originalBaseUrl = process.env['BASE_URL'];

  beforeEach(() => {
    delete process.env['BASE_URL'];
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env['BASE_URL'];
    } else {
      process.env['BASE_URL'] = originalBaseUrl;
    }
  });

  it('builds /accept-invite/:token URL with explicit baseUrl', () => {
    expect(buildInvitationUrl('abc123', 'https://portal.example.com')).toBe(
      'https://portal.example.com/accept-invite/abc123'
    );
  });

  it('strips trailing slashes from baseUrl', () => {
    expect(buildInvitationUrl('tok_1', 'https://portal.example.com///')).toBe(
      'https://portal.example.com/accept-invite/tok_1'
    );
  });

  it('falls back to process.env.BASE_URL when baseUrl is omitted', () => {
    process.env['BASE_URL'] = 'https://preview.example.com/';
    expect(buildInvitationUrl('tok_2')).toBe('https://preview.example.com/accept-invite/tok_2');
  });

  it('falls back to default base URL when both baseUrl and BASE_URL are unset', () => {
    expect(buildInvitationUrl('tok_3')).toBe(
      'https://mhc-family-portal.vercel.app/accept-invite/tok_3'
    );
  });
});

describe('EmailService.sendInvitation', () => {
  it('includes /accept-invite/:token and never /accept-invitation?token= in HTML', async () => {
    const service = new EmailService({
      apiKey: '',
      baseUrl: 'https://portal.example.com',
    });
    const sendEmailSpy = vi
      .spyOn(service as unknown as { sendEmail: (opts: { html: string }) => Promise<void> }, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendInvitation({
      recipientEmail: 'caregiver@example.com',
      recipientName: 'Jane Doe',
      inviterName: 'Admin User',
      organizationName: 'Marquette Home Care',
      invitationToken: 'secure-token-123',
      expiresAt: new Date('2026-12-01T00:00:00Z'),
    });

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    const html = sendEmailSpy.mock.calls[0]![0].html;
    expect(html).toContain('https://portal.example.com/accept-invite/secure-token-123');
    expect(html).not.toContain('/accept-invitation?token=');
  });
});
