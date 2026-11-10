/**
 * HIPAA-001: Environment Isolation & Destructive Operation Guard Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { EnvironmentIsolationService } from '../../security/environment-isolation.js';

describe('HIPAA-001: EnvironmentIsolationService', () => {
  const originalEnv = process.env;

  // Real production and preview hosts from Neon pooler
  const PROD_HOST = 'ep-lively-cake-b4rixr8h-pooler.c-6.us-east-2.aws.neon.tech';
  const PREVIEW_HOST = 'ep-falling-rain-b4u4wli4-pooler.c-6.us-east-2.aws.neon.tech';
  
  // Strong secrets used across tests
  const STRONG_JWT = 'K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=';
  const STRONG_ENCRYPTION = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['VERCEL_ENV'];
    delete process.env['NODE_ENV'];
    delete process.env['ENVIRONMENT'];
    delete process.env['DATABASE_URL'];
    delete process.env['JWT_SECRET'];
    delete process.env['ENCRYPTION_KEY'];
    delete process.env['PRODUCTION_DATABASE_HOSTS'];
    EnvironmentIsolationService.resetInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
    EnvironmentIsolationService.resetInstance();
  });

  describe('Environment detection and database isolation', () => {
    it('allows development environment with non-production database', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:password@localhost:5432/folkcare_dev';

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('development');
      expect(service.isProduction()).toBe(false);
    });

    it('allows preview environment with preview database when PRODUCTION_DATABASE_HOSTS is unset', () => {
      process.env['VERCEL_ENV'] = 'preview';
      process.env['DATABASE_URL'] = `postgres://user:password@${PREVIEW_HOST}:5432/folkcare`;

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('preview');
      expect(service.isProduction()).toBe(false);
    });

    it('allows preview environment with preview database when PRODUCTION_DATABASE_HOSTS is set and preview is not listed', () => {
      process.env['VERCEL_ENV'] = 'preview';
      process.env['DATABASE_URL'] = `postgres://user:password@${PREVIEW_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('preview');
      expect(service.isProduction()).toBe(false);
    });

    it('allows development environment when PRODUCTION_DATABASE_HOSTS is unset', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:password@localhost:5432/test_db';

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('development');
      expect(service.isProduction()).toBe(false);
    });

    it('rejects preview environment attempting to access production database', () => {
      process.env['VERCEL_ENV'] = 'preview';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Non-production cannot access production database'
      );
    });

    it('rejects production environment when PRODUCTION_DATABASE_HOSTS is unset', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: PRODUCTION_DATABASE_HOSTS must be configured in production'
      );
    });

    it('rejects production environment using unlisted database host', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PREVIEW_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Production must use production database'
      );
    });

    it('accepts production environment with listed production database and strong secrets', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('production');
      expect(service.isProduction()).toBe(true);
    });

    it('parses production hosts list with case-insensitive matching', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST.toUpperCase()}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST.toLowerCase();
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      const service = EnvironmentIsolationService.getInstance();
      expect(service.isProduction()).toBe(true);
    });

    it('parses production hosts list with whitespace tolerance', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = `  ${PROD_HOST}  , another-host.example.com  `;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      const service = EnvironmentIsolationService.getInstance();
      expect(service.isProduction()).toBe(true);
    });

    it('requires exact hostname match, not substring match', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'postgres://user:password@prefix-ep-lively-cake-b4rixr8h-pooler.c-6.us-east-2.aws.neon.tech-suffix:5432/db';
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Production must use production database'
      );
    });

    it('handles malformed DATABASE_URL gracefully without exposing URL in error', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'not-a-valid-url-with-secret-password';
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      let errorMessage = '';
      try {
        EnvironmentIsolationService.getInstance();
      } catch (error: any) {
        errorMessage = error.message;
      }

      expect(errorMessage).toContain('HIPAA VIOLATION');
      expect(errorMessage).not.toContain('not-a-valid-url-with-secret-password');
    });
  });

  describe('Production secrets validation', () => {
    it('rejects short JWT_SECRET with distinct error message', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = 'tooshort';
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        /HIPAA VIOLATION: Insecure production secrets detected: JWT_SECRET is shorter than 32 characters/
      );
    });

    it('rejects short ENCRYPTION_KEY with distinct error message', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = 'tooshort';

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        /HIPAA VIOLATION: Insecure production secrets detected: ENCRYPTION_KEY is shorter than 64 characters/
      );
    });

    it('rejects JWT_SECRET containing placeholder values', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = 'example-insecure-secret-value-1234567890';
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        /HIPAA VIOLATION: Insecure production secrets detected: JWT_SECRET contains a placeholder value/
      );
    });

    it('rejects ENCRYPTION_KEY containing placeholder values', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = STRONG_JWT;
      process.env['ENCRYPTION_KEY'] = 'test' + 'a'.repeat(64);

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        /HIPAA VIOLATION: Insecure production secrets detected: ENCRYPTION_KEY contains a placeholder value/
      );
    });

    it('does not expose secret values in error messages', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = `postgres://user:secret123@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;
      process.env['JWT_SECRET'] = 'my-secret-jwt-key-1234567890abcdef';
      process.env['ENCRYPTION_KEY'] = STRONG_ENCRYPTION;

      let errorMessage = '';
      try {
        EnvironmentIsolationService.getInstance();
      } catch (error: any) {
        errorMessage = error.message;
      }

      expect(errorMessage).not.toContain('secret123');
      expect(errorMessage).not.toContain('my-secret-jwt-key');
    });
  });

  describe('Destructive operation guard (nuke protection)', () => {
    it('blocks destructive operations when NODE_ENV is production', () => {
      process.env['NODE_ENV'] = 'production';

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).toThrow(/HIPAA VIOLATION: Destructive operation "nuke" is strictly prohibited/);
    });

    it('blocks destructive operations when ENVIRONMENT is production', () => {
      process.env['ENVIRONMENT'] = 'production';

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).toThrow(/HIPAA VIOLATION: Destructive operation "nuke" is strictly prohibited/);
    });

    it('blocks destructive operations when DATABASE_URL points to listed production host', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = `postgres://user:password@${PROD_HOST}:5432/folkcare`;
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).toThrow(/HIPAA VIOLATION: Destructive operation "nuke" is strictly prohibited/);
    });

    it('allows destructive operations when environment is development and database is not production', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:password@localhost:5432/test_db';
      process.env['PRODUCTION_DATABASE_HOSTS'] = PROD_HOST;

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).not.toThrow();
    });

    it('allows destructive operations when PRODUCTION_DATABASE_HOSTS is unset', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:password@localhost:5432/test_db';

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).not.toThrow();
    });

    it('aborts scripts/nuke.ts immediately with non-zero exit code when NODE_ENV=production', () => {
      const nukeScriptPath = resolve(process.cwd(), 'scripts/nuke.ts');
      const tsxBinPath = resolve(process.cwd(), '../../node_modules/.bin/tsx');

      let exitCode = 0;
      let stderrOutput = '';

      try {
        execFileSync(tsxBinPath, [nukeScriptPath], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            DATABASE_URL: 'postgres://localhost:5432/folkcare',
          },
          stdio: 'pipe',
        });
      } catch (error: any) {
        exitCode = error.status ?? 1;
        stderrOutput = error.stderr?.toString() ?? '';
      }

      expect(exitCode).not.toBe(0);
      expect(stderrOutput).toContain('HIPAA VIOLATION');
    });
  });
});
