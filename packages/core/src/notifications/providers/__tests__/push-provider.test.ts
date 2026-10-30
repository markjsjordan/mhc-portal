/**
 * Tests for Push Notification Provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushProvider } from '../push-provider.js';
import type { Database } from '../../../db/connection.js';
import type { NotificationPayload, NotificationRecipient } from '../../types.js';

describe('PushProvider', () => {
  let mockDatabase: Database;
  let provider: PushProvider;

  beforeEach(() => {
    mockDatabase = {
      query: vi.fn(),
    } as any;

    provider = new PushProvider(mockDatabase);
    vi.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should always return true for Expo push', () => {
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('send', () => {
    const mockPayload: NotificationPayload = {
      eventType: 'VISIT_CLOCK_IN',
      priority: 'NORMAL',
      recipients: [],
      subject: 'Visit Started',
      message: 'Caregiver has started the visit',
      data: { visitId: 'visit-123' },
      organizationId: 'org-123',
      relatedEntityType: 'visit',
      relatedEntityId: 'visit-123',
    };

    const mockRecipient: NotificationRecipient = {
      userId: 'user-123',
      preferredChannels: ['PUSH'],
    };

    it('should return error if no active tokens found', async () => {
      (mockDatabase.query as any).mockResolvedValue({ rows: [] });

      const result = await provider.send(mockPayload, mockRecipient);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active push tokens found for user');
    });

    it('should send push notification successfully', async () => {
      (mockDatabase.query as any).mockResolvedValueOnce({
        rows: [{ id: 'token-123', device_token: 'ExponentPushToken[abc123]' }],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok', id: 'expo-ticket-123' }] }),
      });

      (mockDatabase.query as any).mockResolvedValue({ rows: [] });

      const result = await provider.send(mockPayload, mockRecipient);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('expo-ticket-123');
    });

    it('should strip ePHI (clientName, authorizationNumber, ssn, dob, address) from Expo push payload', async () => {
      (mockDatabase.query as any).mockResolvedValueOnce({
        rows: [{ id: 'token-123', device_token: 'ExponentPushToken[abc123]' }],
      });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok', id: 'expo-ticket-456' }] }),
      });
      global.fetch = fetchSpy;

      (mockDatabase.query as any).mockResolvedValue({ rows: [] });

      const phiPayload: NotificationPayload = {
        ...mockPayload,
        subject: 'Visit Missed: Eleanor Vance',
        message: 'Eleanor Vance missed visit under auth AUTH-998877',
        data: {
          visitId: 'visit-123',
          notificationId: 'notif-456',
          clientName: 'Eleanor Vance',
          authorizationNumber: 'AUTH-998877',
          ssn: '123-45-6789',
          dob: '1948-05-14',
          address: '742 Evergreen Terrace',
        },
      };

      const result = await provider.send(phiPayload, mockRecipient);

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, requestInit] = fetchSpy.mock.calls[0] as [string, { body: string }];
      const sentMessages = JSON.parse(requestInit.body) as Array<{
        title: string;
        body: string;
        data: Record<string, unknown>;
      }>;
      const sentMessage = sentMessages[0]!;

      expect(sentMessage.title).not.toContain('Eleanor Vance');
      expect(sentMessage.body).toBe('Tap to view details');
      expect(sentMessage.data.clientName).toBeUndefined();
      expect(sentMessage.data.authorizationNumber).toBeUndefined();
      expect(sentMessage.data.ssn).toBeUndefined();
      expect(sentMessage.data.dob).toBeUndefined();
      expect(sentMessage.data.address).toBeUndefined();
      expect(sentMessage.data.visitId).toBe('visit-123');
      expect(sentMessage.data.notificationId).toBe('notif-456');
      expect(sentMessage.data.eventType).toBe('VISIT_CLOCK_IN');
    });
  });
});
