import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InviteService } from '../invite.service.js';

describe('InviteService', () => {
  let service: InviteService;
  const mockDb = {
    query: vi.fn(),
  } as any;

  beforeEach(() => {
    service = new InviteService(mockDb);
  });

  describe('generateInvite', () => {
    it('should generate a valid invite with token', async () => {
      const orgId = 'org-123';
      const userId = 'user-123';
      const request = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'TEAM_MEMBER',
        permissions: ['VIEW_SHIFTS'],
        expiresInHours: 24,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] }); // existing check
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // active invite check
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'new-user' }] }); // user creation
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'invite-id', created_at: new Date() }],
      }); // invite creation

      const result = await service.generateInvite(orgId, userId, request);

      expect(result.inviteToken).toHaveLength(64);
      expect(result.inviteUrl).toContain('/onboard?invite=');
      expect(result.status).toBe('PENDING');
    });

    it('should reject invalid email format', async () => {
      const request = {
        email: 'invalid-email',
        firstName: 'John',
        lastName: 'Doe',
        role: 'TEAM_MEMBER',
        permissions: ['VIEW_SHIFTS'],
      };

      await expect(
        service.generateInvite('org-123', 'user-123', request)
      ).rejects.toThrow('Invalid email format');
    });

    it('should reject empty permissions', async () => {
      const request = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'TEAM_MEMBER',
        permissions: [],
      };

      await expect(
        service.generateInvite('org-123', 'user-123', request)
      ).rejects.toThrow('At least one permission is required');
    });
  });

  describe('acceptInvite', () => {
    it('should accept and activate user', async () => {
      const token = 'a'.repeat(64);
      const request = {
        password: 'SecurePass123!',
        acceptTermsOfService: true,
        acceptPrivacyPolicy: true,
      };

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'invite-id',
          user_id: 'user-id',
          organization_id: 'org-id',
          status: 'PENDING',
          expires_at: futureDate,
        }],
      }); // token validation

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-id',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          organization_id: 'org-id',
          status: 'PENDING_ACTIVATION',
        }],
      }); // user fetch

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-id',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          organization_id: 'org-id',
          status: 'ACTIVE',
        }],
      }); // user update

      mockDb.query.mockResolvedValueOnce({ rows: [] }); // invite update
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // audit log

      const result = await service.acceptInvite(token, request);

      expect(result.user.status).toBe('ACTIVE');
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid token', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.acceptInvite('invalid', {
          password: 'SecurePass123!',
          acceptTermsOfService: true,
          acceptPrivacyPolicy: true,
        })
      ).rejects.toThrow('Invalid or expired invite token');
    });

    it('should reject weak passwords', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NoNumbers!',
        'NoSpecialChar123',
      ];

      for (const pwd of weakPasswords) {
        await expect(
          service.acceptInvite('token', {
            password: pwd,
            acceptTermsOfService: true,
            acceptPrivacyPolicy: true,
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Token generation and validation', () => {
    it('should generate unique 64-char hex tokens', () => {
      const token = (service as any).generateToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should hash tokens consistently', () => {
      const token = 'test-token';
      const hash1 = (service as any).hashToken(token);
      const hash2 = (service as any).hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(token);
    });

    it('should validate email formats', () => {
      const validator = (service as any).isValidEmail.bind(service);
      expect(validator('test@example.com')).toBe(true);
      expect(validator('invalid.email')).toBe(false);
      expect(validator('user+tag@example.org')).toBe(true);
    });

    it('should validate password strength', () => {
      const validator = (service as any).isValidPassword.bind(service);
      expect(validator('ValidPass123!')).toBe(true);
      expect(validator('weak')).toBe(false);
      expect(validator('NoNumbers!')).toBe(false);
      expect(validator('nouppercase123!')).toBe(false);
    });
  });

  describe('listInvites', () => {
    it('should list invites with pagination', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          invite_id: 'id-1',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          status: 'PENDING',
          expires_at: new Date(),
          created_at: new Date(),
          accepted_at: null,
          created_by_name: 'Admin',
        }],
      });

      const result = await service.listInvites('org-123', { status: 'PENDING' });

      expect(result.invites).toHaveLength(1);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.limit).toBe(50);
    });
  });
});
