/**
 * HIPAA-004: Strict TLS 1.2+/1.3 Verification in @folkcare/app
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCreateClient, mockInitializeDatabase } = vi.hoisted(() => ({
  mockCreateClient: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue('OK'),
    sendCommand: vi.fn().mockResolvedValue('OK'),
  })),
  mockInitializeDatabase: vi.fn().mockImplementation(() => ({
    healthCheck: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('redis', () => ({
  default: {
    createClient: mockCreateClient,
  },
  createClient: mockCreateClient,
}));

vi.mock('@folkcare/core', async () => {
  const actual = await vi.importActual<typeof import('@folkcare/core')>('@folkcare/core');
  return {
    ...actual,
    initializeDatabase: mockInitializeDatabase,
  };
});

import { initRedis } from '../config/redis.js';
import { initDb } from '../server.js';

describe('HIPAA-004: App PostgreSQL & Redis Strict TLS Verification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env['DATABASE_URL'];
    delete process.env['DB_PASSWORD'];
    delete process.env['DB_SSL'];
    delete process.env['REDIS_URL'];
    delete process.env['REDIS_CA_CERT'];
    delete process.env['DB_CA_CERT'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initDb SSL resolution', () => {
    it.each(['require', 'verify-ca', 'verify-full'])(
      'enables PostgreSQL SSL when DATABASE_URL specifies sslmode=%s',
      (sslmode) => {
        process.env['DATABASE_URL'] = `postgresql://user:pass@db.example.com:5432/folkcare?sslmode=${sslmode}`;

        initDb();

        expect(mockInitializeDatabase).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'db.example.com',
            port: 5432,
            database: 'folkcare',
            ssl: true,
          })
        );
      }
    );

    it('enables PostgreSQL SSL when NODE_ENV=production even without sslmode param', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'postgresql://user:pass@db.example.com:5432/folkcare';

      initDb();

      expect(mockInitializeDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: true,
        })
      );
    });

    it('disables PostgreSQL SSL in non-production when sslmode is not set', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/folkcare';

      initDb();

      expect(mockInitializeDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: false,
        })
      );
    });
  });

  describe('initRedis TLS verification', () => {
    it('enforces rejectUnauthorized: true and minVersion: TLSv1.2 for rediss:// connections', async () => {
      process.env['REDIS_URL'] = 'rediss://default:secret@redis.upstash.io:6379';

      await initRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'rediss://default:secret@redis.upstash.io:6379',
        socket: {
          tls: true,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
      });
    });

    it('passes REDIS_CA_CERT to Redis TLS socket when configured', async () => {
      process.env['REDIS_URL'] = 'rediss://default:secret@redis.upstash.io:6379';
      process.env['REDIS_CA_CERT'] = '-----BEGIN CERTIFICATE-----\nAPP_REDIS_CA\n-----END CERTIFICATE-----';

      await initRedis();

      expect(mockCreateClient).toHaveBeenCalledWith({
        url: 'rediss://default:secret@redis.upstash.io:6379',
        socket: {
          tls: true,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          ca: '-----BEGIN CERTIFICATE-----\nAPP_REDIS_CA\n-----END CERTIFICATE-----',
        },
      });
    });
  });
});
