/**
 * HIPAA-001: Environment Isolation & Destructive Operation Guard Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { EnvironmentIsolationService } from '../../security/environment-isolation.js';

describe('HIPAA-001: EnvironmentIsolationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['VERCEL_ENV'];
    delete process.env['NODE_ENV'];
    delete process.env['ENVIRONMENT'];
    delete process.env['DATABASE_URL'];
    delete process.env['JWT_SECRET'];
    delete process.env['ENCRYPTION_KEY'];
    EnvironmentIsolationService.resetInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
    EnvironmentIsolationService.resetInstance();
  });

  describe('Environment detection and database isolation', () => {
    it('allows development environment with non-production database', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:pass@localhost:5432/folkcare_dev';

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('development');
      expect(service.isProduction()).toBe(false);
    });

    it('allows preview environment with preview database', () => {
      process.env['VERCEL_ENV'] = 'preview';
      process.env['DATABASE_URL'] = 'postgres://user:pass@preview-branch.neon.tech:5432/folkcare';

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('preview');
      expect(service.isProduction()).toBe(false);
    });

    it('rejects non-production environment attempting to access production database', () => {
      process.env['VERCEL_ENV'] = 'preview';
      process.env['DATABASE_URL'] = 'postgres://user:pass@production-db.neon.tech:5432/folkcare';

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Non-production cannot access production database'
      );
    });

    it('rejects production environment using non-production database', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'postgres://user:pass@preview-db.neon.tech:5432/folkcare';
      process.env['JWT_SECRET'] = 'a'.repeat(44);
      process.env['ENCRYPTION_KEY'] = 'b'.repeat(64);

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Production must use production database'
      );
    });

    it('rejects production environment with weak or example secrets', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'postgres://user:pass@prod-db.neon.tech:5432/folkcare';
      process.env['JWT_SECRET'] = 'example-insecure-secret-value-1234567890';
      process.env['ENCRYPTION_KEY'] = 'b'.repeat(64);

      expect(() => EnvironmentIsolationService.getInstance()).toThrow(
        'HIPAA VIOLATION: Insecure production secrets detected'
      );
    });

    it('accepts production environment with production database and strong secrets', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['DATABASE_URL'] = 'postgres://user:pass@prod-db.neon.tech:5432/folkcare';
      process.env['JWT_SECRET'] = 'K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=';
      process.env['ENCRYPTION_KEY'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const service = EnvironmentIsolationService.getInstance();
      expect(service.getEnvironment()).toBe('production');
      expect(service.isProduction()).toBe(true);
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

    it('blocks destructive operations when DATABASE_URL points to production', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgres://user:pass@ep-prod-123.us-east-1.aws.neon.tech/folkcare';

      expect(() =>
        EnvironmentIsolationService.assertNotProductionForDestructiveOperation('nuke')
      ).toThrow(/HIPAA VIOLATION: Destructive operation "nuke" is strictly prohibited/);
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
