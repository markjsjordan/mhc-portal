import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInviteHandlers } from '../invite-handlers.js';

describe('Invite Handlers', () => {
  let handlers: any;
  const mockDb = { query: vi.fn() } as any;

  beforeEach(() => {
    handlers = createInviteHandlers(mockDb);
  });

  describe('generateInvite', () => {
    it('should return 201 on success', async () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const req = {
        params: { orgId: 'org-123' },
        headers: { 'x-user-id': 'user-123' },
        body: { email: 'test@example.com', firstName: 'John', lastName: 'Doe', role: 'TEAM_MEMBER', permissions: ['VIEW_SHIFTS'] },
      } as any;

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'new-user' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'invite-id', created_at: new Date() }] });

      await handlers.generateInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 401 if user ID missing', async () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const req = { params: { orgId: 'org-123' }, headers: {}, body: {} } as any;
      await handlers.generateInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('acceptInvite', () => {
    it('should return 200 on success', async () => {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const req = {
        params: { token: 'a'.repeat(64) },
        body: { password: 'SecurePass123!', acceptTermsOfService: true, acceptPrivacyPolicy: true },
        headers: { 'user-agent': 'Mozilla' },
        ip: '127.0.0.1',
      } as any;

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'invite-id', user_id: 'user-id', organization_id: 'org-id', status: 'PENDING', expires_at: futureDate }],
      });
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'user-id', status: 'PENDING_ACTIVATION', organization_id: 'org-id' }],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'user-id', status: 'ACTIVE' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await handlers.acceptInvite(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
