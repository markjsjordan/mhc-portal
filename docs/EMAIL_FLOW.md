# Team Member Invitation Email Flow

This document describes the email flow implementation for team member invitations in Folk Care.

## Overview

When an organization admin invites a team member, the system automatically sends an invitation email to the invitee. The email functionality is **already implemented** in the codebase.

## Key Implementation

The email sending is integrated in `packages/core/src/service/organization-service.ts`:

```typescript
async createInvitation(
  organizationId: UUID,
  request: CreateInviteRequest,
  createdBy: UUID
): Promise<InviteToken> {
  // ... validation and token creation ...

  // Send invitation email notification (lines 213-231)
  try {
    const inviter = await this.userRepo.getUserById(createdBy);
    const inviterName = inviter !== null
      ? `${inviter.firstName} ${inviter.lastName}`.trim()
      : 'A team member';

    await this.emailService.sendInvitation({
      recipientEmail: request.email,
      recipientName: request.firstName ?? request.email,
      inviterName,
      organizationName: organization.name,
      invitationToken: inviteToken.token,
      expiresAt: inviteToken.expiresAt,
    });
  } catch (emailError) {
    // Log but don't fail invitation creation
    console.error('[OrganizationService] Failed to send invitation email:', emailError);
  }

  return inviteToken;
}
```

## Configuration

### Required Environment Variables

Add to `.env.local`:

```bash
# Resend API key for sending emails
RESEND_API_KEY=re_your_api_key_here

# Base URL for invitation links
BASE_URL=http://localhost:3000
```

### Getting a Resend API Key

1. Sign up at https://resend.com
2. Navigate to https://resend.com/api-keys
3. Create a new API key
4. Add to `.env.local`

**Without RESEND_API_KEY:**
- Emails logged to console (dev mode)
- Invitation creation still works
- Users can accept via direct token link

## Email Flow

### 1. Create Invitation
POST `/api/organizations/:id/invitations` automatically sends email

### 2. Accept Invitation  
POST `/api/invitations/:token/accept` sends welcome email

### 3. Resend Invitation
POST `/api/organizations/:id/invitations/:inviteId/resend` sends new email

## Testing

The email service has defensive error handling - it never fails invitation creation even if email sending fails.

See `packages/core/src/service/__tests__/organization-service-email.test.ts` for comprehensive tests.
