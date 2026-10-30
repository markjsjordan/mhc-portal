# HIPAA-005: Third-Party Data Egress Hardening

## Overview

Prevents Protected Health Information (PHI) and Personally Identifiable Information (PII) from being transmitted to unauthorized third-party services.

## Features

### 1. Domain Whitelist
- **Internal domains**: `localhost`, `*.vercel.app`, `*.folk.care`
- **Approved third-party**: Services with Business Associate Agreements (BAA)
  - Sentry.io (error tracking with BAA)

### 2. Environment Validation
Validates external service URLs on startup:
- `SENTRY_DSN`
- `ANALYTICS_ENDPOINT`

Blocks startup if unapproved services are configured in production.

### 3. Security Headers
- Sets `Referrer-Policy: strict-origin-when-cross-origin` to prevent PHI leakage via HTTP referer

## Configuration

### Adding Approved Services

Edit `/packages/app/src/middleware/data-egress-control.ts`:

```typescript
const APPROVED_DOMAINS = new Set([
  'sentry.io',
  'your-hipaa-compliant-service.com',  // Add after BAA signature
]);
```

**Requirements:**
1. ✅ Business Associate Agreement (BAA) signed
2. ✅ Service is HIPAA-compliant
3. ✅ Documented in approved list
4. ✅ Security team approval

## Compliance

| HIPAA Requirement | Implementation |
|-------------------|----------------|
| § 164.312(e)(1) - Transmission Security | Domain whitelist, startup validation |
| § 164.502(e) - Business Associates | Approved domain list with BAA requirement |

## Testing

```bash
# Test approved domain
SENTRY_DSN=https://test@o4507953149788160.ingest.us.sentry.io/123 npm run dev
# Expected: Starts successfully

# Test unapproved domain (production only)
NODE_ENV=production ANALYTICS_ENDPOINT=https://unapproved.com npm run dev
# Expected: Throws error on startup
```
