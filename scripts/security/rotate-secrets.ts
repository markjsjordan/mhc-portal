#!/usr/bin/env tsx
/**
 * HIPAA-001: Secrets Rotation Script
 * HIPAA Security Rule § 164.308(a)(4)(ii)(B)
 */

import { randomBytes } from 'node:crypto';

const SECRETS = [
  { name: 'JWT_SECRET', type: 'base64', length: 32 },
  { name: 'JWT_REFRESH_SECRET', type: 'base64', length: 32 },
  { name: 'SESSION_SECRET', type: 'base64', length: 32 },
  { name: 'ENCRYPTION_KEY', type: 'hex', length: 32 },
  { name: 'CRON_SECRET', type: 'base64', length: 32 }
] as const;

console.log('\n🔐 HIPAA-001: Secret Generation Tool\n');

for (const secret of SECRETS) {
  const bytes = randomBytes(secret.length);
  const value = secret.type === 'base64' ? bytes.toString('base64') : bytes.toString('hex');
  console.log(`${secret.name}=${value}`);
}

console.log('\n✅ Copy these to your .env file or deployment platform\n');
