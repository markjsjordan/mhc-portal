/**
 * Database connection and transaction management
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import knexBuilder, { Knex } from 'knex';
import { strictTlsOptions, type StrictTlsOptions } from './ssl-config.js';

const SQL_STRING_LITERAL_PATTERN = /'(?:''|[^'])*'/g;
const SSN_LOG_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/**
 * Redact single-quoted SQL string literals before logging.
 */
export function sanitizeSqlForLog(sql: string): string {
  return sql.replace(SQL_STRING_LITERAL_PATTERN, "'?'");
}

/**
 * Scrub PHI patterns (e.g. SSNs) from log/error messages.
 */
export function scrubPhiFromMessage(message: string): string {
  return message.replace(SSN_LOG_PATTERN, '[SSN-REDACTED]');
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Connection pool size (default: 20)
  min?: number; // Minimum pool size (default: 2)
  idleTimeoutMillis?: number; // Connection idle timeout (default: 30000)
  connectionTimeoutMillis?: number; // Connection acquisition timeout (default: 10000)
  statementTimeout?: number; // Query statement timeout in ms (default: 30000)
  queryTimeout?: number; // Query timeout in ms (default: 30000)
  allowExitOnIdle?: boolean; // Allow process to exit when all connections are idle (default: false)
  application_name?: string; // Application name for pg_stat_activity (default: 'folkcare')
}

export class Database {
  private pool: Pool;
  private config: DatabaseConfig;
  private knexInstance: Knex | null = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: this.resolveSsl(),
      // Connection pool settings
      max: config.max ?? 20, // Maximum number of clients in the pool
      min: config.min ?? 2, // Minimum number of clients in the pool
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000, // Close idle clients after 30s
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 10000, // Wait 10s for connection
      allowExitOnIdle: config.allowExitOnIdle ?? false,
      // Query timeout settings
      statement_timeout: config.statementTimeout ?? 30000, // 30s statement timeout
      query_timeout: config.queryTimeout ?? 30000, // 30s query timeout
      // Application name for monitoring
      application_name: config.application_name ?? 'folkcare',
    });

    // Log pool errors (only if pool has event emitter methods)
    if (typeof this.pool.on === 'function') {
      this.pool.on('error', (err) => {
        console.error('Unexpected pool error', err);
      });

      // Log pool connection events in development
      if (process.env.NODE_ENV === 'development') {
        this.pool.on('connect', () => {
          console.log('New database connection established');
        });

        this.pool.on('remove', () => {
          console.log('Database connection removed from pool');
        });
      }
    }
  }

  /**
   * HIPAA-004: TLS settings shared by the pg Pool and the Knex instance.
   * Verification is never disabled - when SSL is on, the certificate must
   * validate against the system roots or the configured `DB_CA_CERT`.
   */
  // eslint-disable-next-line sonarjs/function-return-type
  private resolveSsl(): StrictTlsOptions | false {
    return this.config.ssl === true ? strictTlsOptions() : false;
  }

  /**
   * Get the underlying connection pool
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Get a shared Knex instance for services that require the query builder.
   * Lazily created once per Database instance, reusing the same TLS-verified
   * connection settings as the pg Pool above. Route handlers must use this
   * instead of constructing their own ad-hoc Knex/Pool connections.
   */
  getKnex(): Knex {
    if (this.knexInstance === null) {
      this.knexInstance = knexBuilder({
        client: 'pg',
        connection: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          ssl: this.resolveSsl(),
        },
      });
    }
    return this.knexInstance;
  }

  /**
   * Execute a query
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      if (process.env.LOG_QUERIES === 'true') {
        const duration = Date.now() - start;
        console.log('Executed query', {
          text: sanitizeSqlForLog(text),
          duration,
          rows: result.rowCount,
        });
      }
      return result;
    } catch (error) {
      const pgCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      const rawMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error('Query error', {
        text: sanitizeSqlForLog(text),
        code: pgCode,
        message: scrubPhiFromMessage(rawMessage),
      });
      throw error;
    }
  }

  /**
   * Get a client for transaction management
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Execute within a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.knexInstance !== null) {
      await this.knexInstance.destroy();
      this.knexInstance = null;
    }
    await this.pool.end();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton database instance
 */
let dbInstance: Database | null = null;

export function initializeDatabase(config: DatabaseConfig): Database {
  if (dbInstance !== null) {
    throw new Error('Database already initialized');
  }
  dbInstance = new Database(config);
  return dbInstance;
}

export function getDatabase(): Database {
  if (dbInstance === null) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return dbInstance;
}

/**
 * Reset database instance - for testing only
 */
export function resetDatabase(): void {
  dbInstance = null;
}
