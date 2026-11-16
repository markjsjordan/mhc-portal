import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../email-service.js';

const mockSend = vi.fn();

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
    },
  };
});

describe('EmailService', () => {
  const fixedExpiresAt = new Date('2026-11-22T00:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns SKIPPED with EMAIL_NOT_CONFIGURED when apiKey is empty', async () => {
    const service = new EmailService({ apiKey: '' });
    const result = await service.sendInvitation({
      recipientEmail: 'caregiver@example.com',
      recipientName: 'Jane Doe',
      inviterName: 'Admin User',
      organizationName: 'MHC Home Health',
      invitationToken: 'secret-token-123',
      expiresAt: fixedExpiresAt,
    });

    expect(result).toEqual({
      sent: false,
      status: 'SKIPPED',
      reason: 'EMAIL_NOT_CONFIGURED',
      error: 'EMAIL_NOT_CONFIGURED',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns SENT with messageId when Resend succeeds on first attempt', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null });
    const service = new EmailService({ apiKey: 're_test_123', retryDelayMs: 0 });

    const result = await service.sendInvitation({
      recipientEmail: 'caregiver@example.com',
      inviterName: 'Admin User',
      organizationName: 'MHC Home Health',
      invitationToken: 'secret-token-123',
      expiresAt: fixedExpiresAt,
    });

    expect(result).toEqual({
      sent: true,
      status: 'SENT',
      messageId: 'msg_123',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('retries once on transient 503 error and succeeds on second attempt', async () => {
    mockSend
      .mockResolvedValueOnce({
        data: null,
        error: { name: 'internal_server_error', message: 'Upstream down', statusCode: 503 },
      })
      .mockResolvedValueOnce({ data: { id: 'msg_retry' }, error: null });

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const service = new EmailService({ apiKey: 're_test_123', retryDelayMs: 100, sleepFn });

    const result = await service.sendInvitation({
      recipientEmail: 'caregiver@example.com',
      inviterName: 'Admin User',
      organizationName: 'MHC Home Health',
      invitationToken: 'secret-token-123',
      expiresAt: fixedExpiresAt,
    });

    expect(result).toEqual({
      sent: true,
      status: 'SENT',
      messageId: 'msg_retry',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(100);
  });

  it('retries once on 429 rate limit and returns FAILED RATE_LIMITED if second attempt also fails', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 },
    });

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const service = new EmailService({ apiKey: 're_test_123', retryDelayMs: 50, sleepFn });

    const result = await service.sendInvitation({
      recipientEmail: 'caregiver@example.com',
      inviterName: 'Admin User',
      organizationName: 'MHC Home Health',
      invitationToken: 'secret-token-123',
      expiresAt: fixedExpiresAt,
    });

    expect(result).toEqual({
      sent: false,
      status: 'FAILED',
      reason: 'RATE_LIMITED',
      error: 'RATE_LIMITED',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 4xx validation error (400/422) and returns safe error code', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'invalid_to_address',
        message: 'Invalid recipient address secret-token-123',
        statusCode: 422,
      },
    });

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const service = new EmailService({ apiKey: 're_test_123', retryDelayMs: 50, sleepFn });

    const result = await service.sendInvitation({
      recipientEmail: 'bad-email',
      inviterName: 'Admin User',
      organizationName: 'MHC Home Health',
      invitationToken: 'secret-token-123',
      expiresAt: fixedExpiresAt,
    });

    expect(result).toEqual({
      sent: false,
      status: 'FAILED',
      reason: 'INVALID_RECIPIENT',
      error: 'INVALID_RECIPIENT',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('secret-token-123');
  });

  it('does NOT retry on 403 domain not verified error', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Domain is not verified',
        statusCode: 403,
      },
    });

    const service = new EmailService({ apiKey: 're_test_123', retryDelayMs: 0 });
    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(result).toEqual({
      sent: false,
      status: 'FAILED',
      reason: 'DOMAIN_NOT_VERIFIED',
      error: 'DOMAIN_NOT_VERIFIED',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
