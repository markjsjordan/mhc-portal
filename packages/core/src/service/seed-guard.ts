/**
 * Seed Guard - decides whether demo/base seeding may run against a database.
 *
 * Incident context: seeding polluted the production database (Oct 2026) and
 * preview was re-seeded on every deploy. Seed data (known-password accounts,
 * fake PHI-shaped clients and visits) must never reach a real-data environment
 * by accident, so this guard is allowlist-first and fails closed.
 *
 * Decision order (first match wins):
 *  1. Environment says production/preview/staging          -> REFUSE
 *  2. Database host is a protected Neon endpoint (denylist)  -> REFUSE
 *  3. Database host is local (localhost, 127.0.0.1, ::1)
 *     AND NODE_ENV is development or test                    -> ALLOW
 *  4. ALLOW_DEMO_SEED=1 AND host is a known non-protected host -> ALLOW (manual opt-in)
 *  5. Anything else (unknown host, unknown env, no URL)      -> REFUSE
 *
 * Rules 1 and 2 cannot be overridden by ALLOW_DEMO_SEED. A future dataset for a
 * real-data environment needs a deliberate code change to PROTECTED_DB_HOSTS,
 * reviewed in a PR - never an env var flipped in a workflow.
 */

export interface SeedGuardInput {
  readonly databaseUrl: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly environment: string | undefined;
  readonly allowDemoSeed: string | undefined;
}

export interface SeedGuardDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/** Environments that always hold real data. Never seedable. */
const PROTECTED_ENVIRONMENTS: readonly string[] = ['production', 'preview', 'staging'];

/**
 * Neon endpoint hosts (without the "-pooler" suffix) of databases that hold
 * real data. Second layer behind the environment check: it still blocks a
 * developer shell that has a protected DATABASE_URL but no ENVIRONMENT set.
 * Hosts only - never credentials.
 */
export const PROTECTED_DB_HOSTS: readonly string[] = [
  'ep-lively-cake-b4rixr8h', // production
  'ep-falling-rain-b4u4wli4', // preview
];

const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', '[::1]'];

export function extractDbHost(databaseUrl: string | undefined): string | null {
  if (databaseUrl === undefined || databaseUrl.trim() === '') {
    return null;
  }
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProtectedHost(host: string): boolean {
  return PROTECTED_DB_HOSTS.some((protectedHost) => host === protectedHost || host.startsWith(`${protectedHost}.`) || host.startsWith(`${protectedHost}-pooler.`));
}

export function evaluateSeedGuard(input: SeedGuardInput): SeedGuardDecision {
  const nodeEnv = input.nodeEnv?.trim().toLowerCase() ?? '';
  const environment = input.environment?.trim().toLowerCase() ?? '';

  if (PROTECTED_ENVIRONMENTS.includes(nodeEnv) || PROTECTED_ENVIRONMENTS.includes(environment)) {
    return {
      allowed: false,
      reason: `Refusing to seed: environment is "${environment !== '' ? environment : nodeEnv}", which holds real data.`,
    };
  }

  const host = extractDbHost(input.databaseUrl);
  if (host === null) {
    return { allowed: false, reason: 'Refusing to seed: DATABASE_URL is missing or not a valid URL.' };
  }

  if (isProtectedHost(host)) {
    return {
      allowed: false,
      reason: `Refusing to seed: database host "${host}" is a protected production/preview endpoint.`,
    };
  }

  if (LOCAL_HOSTS.includes(host) && (nodeEnv === 'development' || nodeEnv === 'test')) {
    return { allowed: true, reason: `Local database "${host}" with NODE_ENV="${nodeEnv}".` };
  }

  if (input.allowDemoSeed === '1' && !LOCAL_HOSTS.includes(host)) {
    return { allowed: true, reason: `Manual opt-in via ALLOW_DEMO_SEED=1 for non-protected host "${host}".` };
  }

  return {
    allowed: false,
    reason: `Refusing to seed: host "${host}" with NODE_ENV="${nodeEnv}" is not an allowed seed target. Set ALLOW_DEMO_SEED=1 only for a disposable, non-protected database.`,
  };
}

export class SeedNotAllowedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SeedNotAllowedError';
  }
}

/** Throws SeedNotAllowedError unless seeding is permitted for the current process env. */
export function assertSeedAllowed(env: Readonly<Record<string, string | undefined>> = process.env): void {
  const decision = evaluateSeedGuard({
    databaseUrl: env['DATABASE_URL'],
    nodeEnv: env['NODE_ENV'],
    environment: env['ENVIRONMENT'],
    allowDemoSeed: env['ALLOW_DEMO_SEED'],
  });
  if (!decision.allowed) {
    throw new SeedNotAllowedError(decision.reason);
  }
}
