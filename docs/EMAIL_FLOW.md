# Team Member Invitation Email Flow

This document describes the email flow implementation for team member invitations in Folk Care.

## Overview

When an organization admin invites a team member, the system automatically sends an invitation email to the invitee. This email contains:
- A personalized greeting
- Information about who invited them
- The organization they're being invited to join
- A secure link to accept the invitation
- Expiration information

## Architecture

### Components

1. **EmailService** (`packages/core/src/service/email-service.ts`)
   - Handles all email sending via Resend API
   - Provides methods for invitation, welcome, password reset, and verification emails
   - Gracefully falls back to logging when RESEND_API_KEY is not configured

2. **OrganizationService** (`packages/core/src/service/organization-service.ts`)
   - Orchestrates invitation creation and acceptance
   - Calls EmailService to send notifications
   - Continues operation even if email sending fails (defensive programming)

3. **Email Templates**
   - HTML templates embedded in EmailService
   - Branded with Folk Care styling
   - Responsive design for mobile devices

## Configuration

### Required Environment Variables

```bash
# Resend API key for sending emails
# Get one at: https://resend.com/api-keys
RESEND_API_KEY=re_your_api_key_here

# Base URL for email links (invitation URLs, password reset links)
# Development: http://localhost:3000
# Production: https://your-domain.com
BASE_URL=http://localhost:3000
```

### Getting a Resend API Key

1. Sign up at [https://resend.com](https://resend.com)
2. Navigate to [API Keys](https://resend.com/api-keys)
3. Create a new API key
4. Copy the key and add it to your `.env.local` file

**Without RESEND_API_KEY:**
- Emails will be logged to console but not sent
- Invitation creation still works
- Development/testing can proceed without email service

## Email Flow

### 1. Create Invitation

When calling `POST /api/organizations/:id/invitations`:

```typescript
const invitation = await organizationService.createInvitation(
  organizationId,
  {
    email: 'newuser@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    roles: ['CAREGIVER'],
    branchIds: []
  },
  createdBy
);
```

**Automatic email sent:**
- **To:** invitee's email
- **Subject:** "You've been invited to join {Organization Name} on Folk"
- **Content:** Invitation details with accept link
- **Link:** `{BASE_URL}/accept-invitation?token={invitationToken}`

### 2. Accept Invitation

When calling `POST /api/invitations/:token/accept`:

```typescript
const userId = await organizationService.acceptInvitation({
  token: 'invitation-token',
  firstName: 'Jane',
  lastName: 'Doe',
  password: 'SecurePass123!',
  phone: '+1234567890'
});
```

**Automatic email sent:**
- **To:** new user's email
- **Subject:** "Welcome to {Organization Name} on Folk!"
- **Content:** Welcome message with login link
- **Link:** `{BASE_URL}/login`

### 3. Resend Invitation

When calling `POST /api/organizations/:id/invitations/:inviteId/resend`:

```typescript
await organizationService.resendInvitation(
  invitationId,
  organizationId,
  resendBy
);
```

**Automatic email sent:**
- Same as create invitation
- Uses refreshed expiration date
- Shows who resent the invitation

## Email Templates

### Invitation Email

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #2563eb;">Folk</h1>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb;">
    <h2>You've been invited!</h2>
    
    <p>Hi {recipientName},</p>
    
    <p><strong>{inviterName}</strong> has invited you to join <strong>{organizationName}</strong> on Folk.</p>
    
    <div style="margin: 30px 0; text-align: center;">
      <a href="{invitationUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">This invitation expires in {expiresInHours} hours.</p>
  </div>
</body>
</html>
```

## Error Handling

The email service implements defensive error handling:

1. **Email Service Unavailable:**
   - Invitation creation continues
   - Error logged to console
   - User can still accept invitation via direct link

2. **Invalid API Key:**
   - Falls back to console logging
   - Warning logged on service initialization
   - No exceptions thrown

3. **Network Failures:**
   - Retries handled by Resend SDK
   - Errors logged with full context
   - Invitation remains valid

## Testing

### Unit Tests

Run the email flow tests:

```bash
npm test -- organization-service-email.test.ts
```

### Integration Testing

1. **With Real Email Service:**
   ```bash
   # Set up environment
   export RESEND_API_KEY=re_your_test_key
   export BASE_URL=http://localhost:3000
   
   # Start the server
   npm run dev
   
   # Create an invitation via API
   curl -X POST http://localhost:3000/api/organizations/{orgId}/invitations \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "firstName": "Test",
       "lastName": "User",
       "roles": ["CAREGIVER"]
     }'
   
   # Check your email inbox for the invitation
   ```

2. **Without Email Service (Dev Mode):**
   ```bash
   # Don't set RESEND_API_KEY
   npm run dev
   
   # Check console logs for email content
   ```

### Manual Testing Checklist

- [ ] Create invitation sends email
- [ ] Email contains correct organization name
- [ ] Email contains correct inviter name
- [ ] Invitation link works
- [ ] Accept invitation sends welcome email
- [ ] Welcome email contains login link
- [ ] Resend invitation sends new email
- [ ] Email service failure doesn't break invitation flow
- [ ] Console logs email content when RESEND_API_KEY not set

## Monitoring

### Logs

Email operations are logged with context:

```typescript
console.log('[EmailService] Email sent successfully:', {
  to: params.to,
  subject: params.subject,
  messageId: result.data?.id,
});
```

```typescript
console.error('[OrganizationService] Failed to send invitation email:', emailError);
```

### Metrics (Future Enhancement)

Consider tracking:
- Email send success/failure rates
- Average delivery time
- Bounce rates
- Invitation acceptance rates

## Troubleshooting

### Emails Not Sending

1. **Check RESEND_API_KEY is set:**
   ```bash
   echo $RESEND_API_KEY
   ```

2. **Verify API key is valid:**
   - Log in to [Resend Dashboard](https://resend.com/api-keys)
   - Check key status

3. **Check console logs:**
   - Look for `[EmailService]` log entries
   - Verify email content is correct

4. **Test API key directly:**
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "noreply@folkcare.com",
       "to": "test@example.com",
       "subject": "Test Email",
       "html": "<p>Test</p>"
     }'
   ```

### Wrong Domain in Email Links

1. **Check BASE_URL environment variable:**
   ```bash
   echo $BASE_URL
   ```

2. **Update for your environment:**
   - Development: `http://localhost:3000`
   - Staging: `https://staging.folkcare.com`
   - Production: `https://folkcare.com`

## Security Considerations

1. **API Key Protection:**
   - Never commit RESEND_API_KEY to version control
   - Use environment variables
   - Rotate keys periodically

2. **Email Content:**
   - No sensitive data in email bodies
   - Token-based authentication for links
   - Expiration on invitation tokens

3. **Rate Limiting:**
   - Consider implementing rate limits on invitation creation
   - Prevent email spam attacks

## Future Enhancements

- [ ] Email templates stored in database
- [ ] Multi-language support
- [ ] Custom branding per organization
- [ ] Email analytics dashboard
- [ ] Scheduled invitation reminders
- [ ] Bulk invitation support
