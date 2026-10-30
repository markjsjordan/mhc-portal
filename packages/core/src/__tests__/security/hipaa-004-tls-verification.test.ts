/**
 * HIPAA-004: Strict TLS 1.2+/1.3 Verification (sslmode=verify-full) Tests
 */
/* eslint-disable sonarjs/no-hardcoded-passwords, security/detect-non-literal-fs-filename */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { mockPoolConstructor, mockRedisCreateClient } = vi.hoisted(() => ({
  mockPoolConstructor: vi.fn().mockImplementation(function () {
    return {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      connect: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
  }),
  mockRedisCreateClient: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('pg', () => ({
  Pool: mockPoolConstructor,
  default: {
    Pool: mockPoolConstructor,
  },
}));

vi.mock('redis', () => ({
  createClient: mockRedisCreateClient,
  default: {
    createClient: mockRedisCreateClient,
  },
}));

import { Database } from '../../db/connection.js';
import { createSupabasePool } from '../../db/supabase-adapter.js';
import { CacheService } from '../../service/cache.service.js';

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (
      entry === 'node_modules' ||
      entry === 'dist' ||
      entry === 'build' ||
      entry === 'coverage' ||
      entry === '__tests__'
    ) {
      continue;
    }
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, acc);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.mts')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe('HIPAA-004: Strict TLS 1.2+/1.3 Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['DB_CA_CERT'];
    delete process.env['REDIS_CA_CERT'];
    delete process.env['REDIS_USE_TLS'];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('contains zero occurrences of rejectUnauthorized: false in production source files across packages/ and verticals/', () => {
    const repoRoot = resolve(process.cwd(), '../..');
    const sourceFiles = [
      ...collectSourceFiles(join(repoRoot, 'packages')),
      ...collectSourceFiles(join(repoRoot, 'verticals')),
    ];

    expect(sourceFiles.length).toBeGreaterThan(0);

    const insecurePattern = new RegExp('rejectUnauthorized\\s*:\\s*false');
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      if (insecurePattern.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('enforces rejectUnauthorized: true and minVersion: TLSv1.2 in Database when SSL is enabled', () => {
    new Database({
      host: 'db.example.com',
      port: 5432,
      database: 'folkcare',
      user: 'postgres',
      password: 'secret',
      ssl: true,
    });

    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      })
    );
  });

  it('passes custom CA certificate to Database SSL configuration when DB_CA_CERT is set', () => {
    process.env['DB_CA_CERT'] = '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----';

    new Database({
      host: 'db.example.com',
      port: 5432,
      database: 'folkcare',
      user: 'postgres',
      password: 'secret',
      ssl: true,
    });

    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          ca: '-----BEGIN CERTIFICATE-----\nTEST_CA\n-----END CERTIFICATE-----',
        },
      })
    );
  });

  it('enforces rejectUnauthorized: true and minVersion: TLSv1.2 in createSupabasePool', () => {
    createSupabasePool({
      DATABASE_URL: 'postgresql://user:pass@db.supabase.co:5432/postgres?sslmode=verify-full',
    });

    expect(mockPoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      })
    );
  });

  it('enforces rejectUnauthorized: true and minVersion: TLSv1.2 in CacheService when useTLS is enabled', async () => {
    const cache = new CacheService({
      host: 'redis.upstash.io',
      port: 6379,
      password: 'secret',
      ttl: 300,
      useTLS: true,
    });

    await cache.initialize();

    expect(mockRedisCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'rediss://:secret@redis.upstash.io:6379/0',
        socket: {
          tls: true,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      })
    );
  });

  it('passes REDIS_CA_CERT to CacheService TLS socket when configured', async () => {
    process.env['REDIS_CA_CERT'] = '-----BEGIN CERTIFICATE-----\nREDIS_CA\n-----END CERTIFICATE-----';

    const cache = new CacheService({
      host: 'redis.upstash.io',
      port: 6380,
      ttl: 300,
    });

    await cache.initialize();

    expect(mockRedisCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'rediss://redis.upstash.io:6380/0',
        socket: {
          tls: true,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          ca: '-----BEGIN CERTIFICATE-----\nREDIS_CA\n-----END CERTIFICATE-----',
        },
      })
    );
  });
});
