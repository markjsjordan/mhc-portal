/**
 * HIPAA-004: Strict TLS configuration for Postgres connections.
 *
 * Single source of truth for how this codebase negotiates TLS to the database.
 * Certificate verification is never disabled: there is deliberately no code
 * path here that can disable TLS certificate verification. Callers that need a
 * pg/knex `ssl` value must use `resolvePostgresSsl` rather than hand-rolling
 * their own options object.
 */

/** TLS options applied to every verified Postgres connection. */
export interface StrictTlsOptions {
  readonly rejectUnauthorized: true;
  readonly minVersion: 'TLSv1.2';
  readonly ca?: string;
}

/** Environments that must never speak plaintext Postgres. */
const TLS_REQUIRED_ENVIRONMENTS = new Set(['production', 'staging', 'preview']);

/** `sslmode` values that request an encrypted channel. */
const TLS_SSLMODES = new Set(['require', 'verify-ca', 'verify-full']);

/**
 * Build the TLS options for a verified connection.
 *
 * A custom CA (`DB_CA_CERT`, falling back to `REDIS_CA_CERT`) is attached when
 * configured, which is what lets managed providers with private roots pass
 * verification instead of being waved through with verification disabled.
 */
export function strictTlsOptions(): StrictTlsOptions {
  const caCert = process.env.DB_CA_CERT ?? process.env.REDIS_CA_CERT;
  return {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    ...(caCert !== undefined && caCert !== '' ? { ca: caCert } : {}),
  };
}

export interface TlsRequirementInput {
  /** Connection string whose `sslmode` parameter should be honoured. */
  connectionString?: string;
  /** Defaults to `process.env.NODE_ENV`. */
  nodeEnv?: string;
  /** Defaults to `process.env.DB_SSL`; `'true'` forces TLS on. */
  dbSsl?: string;
}

/**
 * Decide whether TLS is mandatory for a connection.
 *
 * TLS is required when the deployment environment handles ePHI
 * (production/staging/preview), when `DB_SSL=true`, or when the connection
 * string itself asks for an encrypted channel via `sslmode`.
 */
export function isTlsRequired(input: TlsRequirementInput = {}): boolean {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  if (TLS_REQUIRED_ENVIRONMENTS.has(nodeEnv)) {
    return true;
  }

  const dbSsl = input.dbSsl ?? process.env.DB_SSL;
  if (dbSsl === 'true') {
    return true;
  }

  const connectionString = input.connectionString;
  if (connectionString !== undefined && connectionString !== '') {
    return TLS_SSLMODES.has(readSslMode(connectionString));
  }

  return false;
}

/**
 * Resolve the `ssl` value for a pg `Pool`/`Client` or knex connection config.
 *
 * Returns strict TLS options when TLS is required and `false` (plaintext) only
 * for local development, where no ePHI is present.
 */
// eslint-disable-next-line sonarjs/function-return-type
export function resolvePostgresSsl(
  input: TlsRequirementInput = {}
): StrictTlsOptions | false {
  return isTlsRequired(input) ? strictTlsOptions() : false;
}

/**
 * Read the `sslmode` query parameter from a connection string.
 * Malformed URLs yield `''` so callers fall back to environment-based rules
 * rather than throwing during connection setup.
 */
function readSslMode(connectionString: string): string {
  try {
    return new URL(connectionString).searchParams.get('sslmode') ?? '';
  } catch {
    return '';
  }
}
