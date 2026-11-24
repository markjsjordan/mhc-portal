import type { Knex } from 'knex';
import dotenv from 'dotenv';
import { resolvePostgresSsl } from './src/db/ssl-config.js';

dotenv.config({ path: '.env', quiet: true });

/**
 * Get database connection configuration
 * Supports both traditional connection params and DATABASE_URL for cloud deployments
 */
function getConnectionConfig(): string {
  // Prefer DATABASE_URL for cloud deployments (Neon, etc.)
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl !== undefined && databaseUrl !== '') {
    return databaseUrl;
  }

  // Fall back to individual connection parameters
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME ?? 'folkcare';
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const ssl = process.env.DB_SSL === 'true';

  return `postgresql://${user}:${password}@${host}:${port}/${database}${ssl ? '?sslmode=require' : ''}`;
}

/**
 * Connection config for non-dev/test environments (staging, preview, production).
 * Requires certificate-verified TLS 1.2+ whenever a DATABASE_URL sslmode of
 * require/verify-ca/verify-full is set, or NODE_ENV is production/staging/preview.
 * Delegates to the shared `resolvePostgresSsl` helper so there is exactly one
 * place in the codebase that can disable TLS certificate verification (none).
 */
function getNonDevConnectionConfig(): Knex.StaticConnectionConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl !== undefined && databaseUrl !== '') {
    return {
      connectionString: databaseUrl,
      ssl: resolvePostgresSsl({ connectionString: databaseUrl }),
    };
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME ?? 'folkcare',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    ssl: resolvePostgresSsl(),
  };
}

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: getConnectionConfig(),
    migrations: {
      directory: './packages/core/migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      // Optimized for local development
      min: 2, // Minimum connections
      max: 10, // Maximum connections (lower than default for local dev)
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000, // 30s idle timeout
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
    },
  },

  staging: {
    client: 'postgresql',
    connection: getNonDevConnectionConfig(),
    migrations: {
      directory: './packages/core/migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      // Optimized for Neon serverless with connection pooling
      min: 0, // No minimum connections in serverless
      max: 1, // Single connection per serverless function
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 1000, // Quick cleanup in serverless
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
    },
  },

  preview: {
    client: 'postgresql',
    connection: getNonDevConnectionConfig(),
    migrations: {
      directory: './packages/core/migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      // Optimized for Neon serverless with connection pooling
      min: 0, // No minimum connections in serverless
      max: 1, // Single connection per serverless function
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 1000, // Quick cleanup in serverless
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
    },
  },

  production: {
    client: 'postgresql',
    connection: getNonDevConnectionConfig(),
    migrations: {
      directory: './packages/core/migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      // Optimized for Neon serverless with connection pooling
      min: 0, // No minimum connections in serverless
      max: 1, // Single connection per serverless function
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 1000, // Quick cleanup in serverless
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,
    },
  },

  test: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL ?? {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: (process.env.DB_NAME ?? 'folkcare') + '_test',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      ssl: resolvePostgresSsl({ nodeEnv: 'test' }),
    },
    migrations: {
      directory: './packages/core/migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    seeds: {
      directory: './seeds',
    },
  },
};

export default config;