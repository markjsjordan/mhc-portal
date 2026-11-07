import { describe, it, expect } from 'vitest';
import {
  evaluateSeedGuard,
  extractDbHost,
  assertSeedAllowed,
  SeedNotAllowedError,
  PROTECTED_DB_HOSTS,
} from '../seed-guard.js';

const PROD_URL = 'postgresql://user:pw@ep-lively-cake-b4rixr8h-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const PREVIEW_URL = 'postgresql://user:pw@ep-falling-rain-b4u4wli4-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const PROD_DIRECT_URL = 'postgresql://user:pw@ep-lively-cake-b4rixr8h.c-6.us-east-2.aws.neon.tech/neondb';
const LOCAL_URL = 'postgresql://postgres:pw@localhost:5432/folkcare_test';
const OTHER_NEON_URL = 'postgresql://user:pw@ep-throwaway-b4zzzz.c-6.us-east-2.aws.neon.tech/neondb';

describe('extractDbHost', () => {
  it('returns the lowercase hostname without credentials', () => {
    expect(extractDbHost(LOCAL_URL)).toBe('localhost');
    expect(extractDbHost(PROD_URL)).toBe('ep-lively-cake-b4rixr8h-pooler.c-6.us-east-2.aws.neon.tech');
  });

  it('returns null for missing, blank, or malformed URLs', () => {
    expect(extractDbHost(undefined)).toBeNull();
    expect(extractDbHost('   ')).toBeNull();
    expect(extractDbHost('not a url')).toBeNull();
  });
});

describe('evaluateSeedGuard', () => {
  it('allows a local database under NODE_ENV=test', () => {
    const d = evaluateSeedGuard({ databaseUrl: LOCAL_URL, nodeEnv: 'test', environment: undefined, allowDemoSeed: undefined });
    expect(d.allowed).toBe(true);
  });

  it('allows a local database under NODE_ENV=development', () => {
    const d = evaluateSeedGuard({ databaseUrl: LOCAL_URL, nodeEnv: 'development', environment: undefined, allowDemoSeed: undefined });
    expect(d.allowed).toBe(true);
  });

  it.each([['production'], ['preview'], ['staging'], ['PRODUCTION'], [' Preview ']])(
    'refuses when ENVIRONMENT=%s even for a local URL and with the opt-in set',
    (environment) => {
      const d = evaluateSeedGuard({ databaseUrl: LOCAL_URL, nodeEnv: 'development', environment, allowDemoSeed: '1' });
      expect(d.allowed).toBe(false);
      expect(d.reason).toContain('holds real data');
    }
  );

  it('refuses when NODE_ENV=production', () => {
    const d = evaluateSeedGuard({ databaseUrl: LOCAL_URL, nodeEnv: 'production', environment: undefined, allowDemoSeed: '1' });
    expect(d.allowed).toBe(false);
  });

  it.each([[PROD_URL], [PREVIEW_URL], [PROD_DIRECT_URL]])(
    'refuses protected Neon host %s even with no environment variables and the opt-in set',
    (databaseUrl) => {
      const d = evaluateSeedGuard({ databaseUrl, nodeEnv: undefined, environment: undefined, allowDemoSeed: '1' });
      expect(d.allowed).toBe(false);
      expect(d.reason).toContain('protected production/preview endpoint');
    }
  );

  it('refuses a missing DATABASE_URL', () => {
    const d = evaluateSeedGuard({ databaseUrl: undefined, nodeEnv: 'test', environment: undefined, allowDemoSeed: '1' });
    expect(d.allowed).toBe(false);
  });

  it('refuses an unknown remote host without the opt-in', () => {
    const d = evaluateSeedGuard({ databaseUrl: OTHER_NEON_URL, nodeEnv: 'development', environment: undefined, allowDemoSeed: undefined });
    expect(d.allowed).toBe(false);
  });

  it('allows an unknown non-protected remote host only with ALLOW_DEMO_SEED=1', () => {
    const d = evaluateSeedGuard({ databaseUrl: OTHER_NEON_URL, nodeEnv: 'development', environment: undefined, allowDemoSeed: '1' });
    expect(d.allowed).toBe(true);
    expect(d.reason).toContain('Manual opt-in');
  });

  it.each([['true'], ['yes'], ['0'], ['']])('does not treat ALLOW_DEMO_SEED=%j as an opt-in', (allowDemoSeed) => {
    const d = evaluateSeedGuard({ databaseUrl: OTHER_NEON_URL, nodeEnv: 'development', environment: undefined, allowDemoSeed });
    expect(d.allowed).toBe(false);
  });

  it('refuses a local host under an unrecognised NODE_ENV (fails closed)', () => {
    const d = evaluateSeedGuard({ databaseUrl: LOCAL_URL, nodeEnv: 'qa', environment: undefined, allowDemoSeed: undefined });
    expect(d.allowed).toBe(false);
  });

  it('never leaks credentials into the reason', () => {
    const d = evaluateSeedGuard({ databaseUrl: PROD_URL, nodeEnv: 'test', environment: undefined, allowDemoSeed: undefined });
    expect(d.reason).not.toContain('user:pw');
    expect(d.reason).not.toContain('pw@');
  });
});

describe('assertSeedAllowed', () => {
  it('throws SeedNotAllowedError for a protected environment', () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: PROD_URL, ENVIRONMENT: 'production' })).toThrow(SeedNotAllowedError);
  });

  it('does not throw for a local test database', () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: LOCAL_URL, NODE_ENV: 'test' })).not.toThrow();
  });
});

describe('PROTECTED_DB_HOSTS', () => {
  it('lists the production and preview endpoints', () => {
    expect(PROTECTED_DB_HOSTS).toEqual(['ep-lively-cake-b4rixr8h', 'ep-falling-rain-b4u4wli4']);
  });
});
