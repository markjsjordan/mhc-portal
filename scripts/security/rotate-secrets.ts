#!/usr/bin/env tsx
/**
 * HIPAA-001: Secrets Rotation Script
 * 
 * HIPAA Security Rule § 164.308(a)(4)(ii)(B) requires procedures for 
 * creating, changing, and safeguarding passwords.
 */

import { randomBytes } from 'crypto';

interface SecretConfig {
  name: string;
  type: 'base64' | 'hex';
  length: number;
  description: string;
  rotationPeriodDays: number;
}

const SECRETS_CONFIG: SecretConfig[] = [
  {
    name: 'JWT_SECRET',
    type: 'base64',
    length: 32,
    description: 'JWT access token signing secret',
    rotationPeriodDays: 90
  },
  {
    name: 'JWT_REFRESH_SECRET',
    type: 'base64',
    length: 32,
    description: 'JWT refresh token signing secret',
    rotationPeriodDays: 90
  },
  {
    name: 'SESSION_SECRET',
    type: 'base64',
    length: 32,
    description: 'Session cookie signing secret',
    rotationPeriodDays: 90
  },
  {
    name: 'ENCRYPTION_KEY',
    type: 'hex',
    length: 32,
    description: 'AES-256 encryption key for PHI data',
    rotationPeriodDays: 180
  },
  {
    name: 'CRON_SECRET',
    type: 'base64',
    length: 32,
    description: 'Cron job authentication secret',
    rotationPeriodDays: 90
  }
];

console.log('\n🔐 HIPAA-001: Secret Generation Tool\n');

for (const config of SECRETS_CONFIG) {
  const bytes = randomBytes(config.length);
  const secret = config.type === 'base64' 
    ? bytes.toString('base64')
    : bytes.toString('hex');
  
  console.log(`${config.name}=${secret}`);
}

console.log('\n✅ Copy these to your .env file or deployment platform\n');
