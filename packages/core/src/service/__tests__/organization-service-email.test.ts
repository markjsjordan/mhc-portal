/**
 * Organization Service - Email Flow Tests
 * 
 * Tests that verify email sending functionality for team member invitations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrganizationService } from '../organization-service';
import { EmailService } from '../email-service';
import { Database } from '../../db/connection';
import { OrganizationRepository } from '../../repository/organization-repository';
import { UserRepository } from '../../repository/user-repository';

// Mock the email service
vi.mock('../email-service', () => ({
  EmailService: vi.fn(),
  createEmailService: vi.fn(() => ({
    sendInvitation: vi.fn(),
    sendWelcome: vi.fn(),
    sendPasswordReset: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendSubscriptionNotification: vi.fn(),
  })),
}));

describe('OrganizationService - Email Flow', () => {
  let organizationService: OrganizationService;
  let mockDb: Database;
  let mockEmailService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock database
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(async (callback) => {
        return await callback(mockDb);
      }),
    } as unknown as Database;

    // Create the organization service
    organizationService = new OrganizationService(mockDb);

    // Get the mock email service
    mockEmailService = (organizationService as any).emailService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should send an invitation email when creating an invitation', async () => {
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';
      const createdBy = '550e8400-e29b-41d4-a716-446655440001';

      // Mock the organization repository
      const mockOrganization = {
        id: organizationId,
        name: 'Test Organization',
        stateCode: 'TX',
        email: 'org@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(OrganizationRepository.prototype, 'getOrganizationById').mockResolvedValue(
        mockOrganization as any
      );

      // Mock the user repository
      const mockInviter = {
        id: createdBy,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const mockInviteToken = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        token: 'test-token-123',
        email: 'invitee@example.com',
        firstName: 'Jane',
        roles: ['CAREGIVER'],
        branchIds: [],
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        createdBy,
      };

      vi.spyOn(UserRepository.prototype, 'getUserByEmail').mockResolvedValue(null);
      vi.spyOn(UserRepository.prototype, 'createInviteToken').mockResolvedValue(mockInviteToken as any);
      vi.spyOn(UserRepository.prototype, 'getUserById').mockResolvedValue(mockInviter as any);

      const request = {
        email: 'invitee@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: ['CAREGIVER' as const],
        branchIds: [],
      };

      // Create the invitation
      const result = await organizationService.createInvitation(
        organizationId,
        request,
        createdBy
      );

      // Verify the email service was called
      expect(mockEmailService.sendInvitation).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith({
        recipientEmail: 'invitee@example.com',
        recipientName: 'Jane',
        inviterName: 'John Doe',
        organizationName: 'Test Organization',
        invitationToken: 'test-token-123',
        expiresAt: expect.any(Date),
      });

      // Verify the result
      expect(result).toEqual(mockInviteToken);
    });

    it('should not fail invitation creation if email sending fails', async () => {
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';
      const createdBy = '550e8400-e29b-41d4-a716-446655440001';

      // Mock the organization repository
      const mockOrganization = {
        id: organizationId,
        name: 'Test Organization',
        stateCode: 'TX',
        email: 'org@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(OrganizationRepository.prototype, 'getOrganizationById').mockResolvedValue(
        mockOrganization as any
      );

      // Mock the user repository
      const mockInviter = {
        id: createdBy,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const mockInviteToken = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        token: 'test-token-123',
        email: 'invitee@example.com',
        firstName: 'Jane',
        roles: ['CAREGIVER'],
        branchIds: [],
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        createdBy,
      };

      vi.spyOn(UserRepository.prototype, 'getUserByEmail').mockResolvedValue(null);
      vi.spyOn(UserRepository.prototype, 'createInviteToken').mockResolvedValue(mockInviteToken as any);
      vi.spyOn(UserRepository.prototype, 'getUserById').mockResolvedValue(mockInviter as any);

      // Mock email service to throw an error
      mockEmailService.sendInvitation.mockRejectedValue(new Error('Email service unavailable'));

      const request = {
        email: 'invitee@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: ['CAREGIVER' as const],
        branchIds: [],
      };

      // Create the invitation - should not throw even though email fails
      const result = await organizationService.createInvitation(
        organizationId,
        request,
        createdBy
      );

      // Verify the result is still returned
      expect(result).toEqual(mockInviteToken);
    });

    it('should use inviter email as fallback name if inviter not found', async () => {
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';
      const createdBy = '550e8400-e29b-41d4-a716-446655440001';

      // Mock the organization repository
      const mockOrganization = {
        id: organizationId,
        name: 'Test Organization',
        stateCode: 'TX',
        email: 'org@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(OrganizationRepository.prototype, 'getOrganizationById').mockResolvedValue(
        mockOrganization as any
      );

      const mockInviteToken = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        token: 'test-token-123',
        email: 'invitee@example.com',
        firstName: 'Jane',
        roles: ['CAREGIVER'],
        branchIds: [],
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        createdBy,
      };

      vi.spyOn(UserRepository.prototype, 'getUserByEmail').mockResolvedValue(null);
      vi.spyOn(UserRepository.prototype, 'createInviteToken').mockResolvedValue(mockInviteToken as any);
      // Return null for inviter - simulating inviter not found
      vi.spyOn(UserRepository.prototype, 'getUserById').mockResolvedValue(null);

      const request = {
        email: 'invitee@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        roles: ['CAREGIVER' as const],
        branchIds: [],
      };

      // Create the invitation
      await organizationService.createInvitation(organizationId, request, createdBy);

      // Verify the email service was called with fallback name
      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith({
        recipientEmail: 'invitee@example.com',
        recipientName: 'Jane',
        inviterName: 'A team member',
        organizationName: 'Test Organization',
        invitationToken: 'test-token-123',
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('resendInvitation', () => {
    it('should send an invitation email when resending', async () => {
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';
      const invitationId = '550e8400-e29b-41d4-a716-446655440002';
      const resendBy = '550e8400-e29b-41d4-a716-446655440001';

      const mockOrganization = {
        id: organizationId,
        name: 'Test Organization',
        stateCode: 'TX',
        email: 'org@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockInvite = {
        id: invitationId,
        token: 'test-token-123',
        email: 'invitee@example.com',
        firstName: 'Jane',
        roles: ['CAREGIVER'],
        branchIds: [],
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        createdBy: resendBy,
      };

      const mockInviter = {
        id: resendBy,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      vi.spyOn(OrganizationRepository.prototype, 'getOrganizationById').mockResolvedValue(
        mockOrganization as any
      );
      vi.spyOn(UserRepository.prototype, 'getOrganizationInvites').mockResolvedValue([mockInvite] as any);
      vi.spyOn(UserRepository.prototype, 'getUserById').mockResolvedValue(mockInviter as any);
      vi.spyOn(UserRepository.prototype, 'resendInviteToken').mockResolvedValue(undefined);

      // Resend the invitation
      await organizationService.resendInvitation(invitationId, organizationId, resendBy);

      // Verify the email service was called
      expect(mockEmailService.sendInvitation).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith({
        recipientEmail: 'invitee@example.com',
        recipientName: 'Jane',
        inviterName: 'John Doe',
        organizationName: 'Test Organization',
        invitationToken: 'test-token-123',
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('acceptInvitation', () => {
    it('should send a welcome email when invitation is accepted', async () => {
      const token = 'test-token-123';
      const organizationId = '550e8400-e29b-41d4-a716-446655440000';

      const mockInviteDetails = {
        email: 'invitee@example.com',
        firstName: 'Jane',
        organizationId,
        organizationName: 'Test Organization',
        roles: ['CAREGIVER'],
        branchIds: [],
        isValid: true,
      };

      const mockInvite = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        token,
        email: 'invitee@example.com',
        firstName: 'Jane',
        roles: ['CAREGIVER'],
        branchIds: [],
        status: 'PENDING' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        createdBy: '550e8400-e29b-41d4-a716-446655440001',
      };

      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'invitee@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        organizationId,
      };

      vi.spyOn(UserRepository.prototype, 'validateInviteToken').mockResolvedValue(mockInviteDetails as any);
      vi.spyOn(UserRepository.prototype, 'getInviteByToken').mockResolvedValue(mockInvite as any);
      vi.spyOn(UserRepository.prototype, 'createUser').mockResolvedValue(mockUser as any);
      vi.spyOn(UserRepository.prototype, 'acceptInviteToken').mockResolvedValue(undefined);

      const request = {
        token,
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'SecurePass123!',
        phone: '+1234567890',
      };

      // Accept the invitation
      await organizationService.acceptInvitation(request);

      // Verify the welcome email was sent
      expect(mockEmailService.sendWelcome).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendWelcome).toHaveBeenCalledWith({
        recipientEmail: 'invitee@example.com',
        recipientName: 'Jane Smith',
        organizationName: 'Test Organization',
      });
    });
  });
});
