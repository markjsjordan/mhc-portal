# HIPAA-001 & HIPAA-002: Security Hardening

**Implementation Date:** 2026-10-25  
**Compliance:** HIPAA Security Rule § 164.308(a)(4)(ii)(B), § 164.312(a)(1)

## HIPAA-001: Secrets Rotation & Environment Isolation

### Components

1. **Secrets Rotation Tool** (`scripts/security/rotate-secrets.ts`)
   - Generates cryptographically secure secrets
   - JWT secrets (base64, 32 bytes)
   - Encryption keys (hex, 32 bytes)
   - Session secrets (base64, 32 bytes)

2. **Environment Isolation Service** (`packages/core/src/security/environment-isolation.ts`)
   - Production database only accessible from production
   - Preview/dev cannot access production PHI
   - Production secrets validated for strength
   - Environment detection and validation on startup

### Usage

```bash
# Generate new secrets
npm run rotate:secrets

# Copy output to deployment platform (Vercel, GitHub Actions)
```

### Validation

- Database URL must match environment
- Production secrets: minimum 32 chars (JWT), 64 chars (encryption)
- No insecure default/example secrets in production

## HIPAA-002: Authentication Bypass Hardening

### Components

**Auth Bypass Detector** (`packages/core/src/security/auth-bypass-detector.ts`)

Blocks:
- Bypass flags (`skip_auth`, `bypass_auth`, `demo_mode`)
- Mock auth routes in production (`/api/auth/mock`, `/api/auth/test`)
- Spoofed user context without valid JWT

### Protection Layers

1. **Bypass Flag Detection** - Scans headers, query, body for 15+ bypass patterns
2. **Mock Route Blocking** - Disables test endpoints in production
3. **Token Authenticity** - Ensures user context only set via valid JWT

### Integration

```typescript
import { createAuthHardeningMiddleware } from '@folkcare/core';

app.use(createAuthHardeningMiddleware());
```

## HIPAA Compliance

| Requirement | Implementation |
|------------|----------------|
| § 164.308(a)(4)(ii)(B) - Password procedures | Secrets rotation + strength validation |
| § 164.308(a)(4)(ii)(C) - Environment protection | Environment isolation |
| § 164.312(a)(1) - Access control | Auth bypass detection |

## Testing

```bash
# Should be blocked (403)
curl -H "bypass_auth: true" http://localhost:3000/api/clients
curl "http://localhost:3000/api/clients?demo_mode=true"

# Production mock routes should 404
curl https://production-url/api/auth/mock
```

## References

- HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/
- OWASP Authentication: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

**Last Updated:** 2026-10-25
