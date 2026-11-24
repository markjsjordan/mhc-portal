import { describe, it, expect } from 'vitest';
import { formatAppVersion, getAppVersion, getForceUpdateUrl } from '../version';

describe('version utilities', () => {
  describe('formatAppVersion', () => {
    it('prepends v to bare semver strings', () => {
      expect(formatAppVersion('1.5.0')).toBe('v1.5.0');
      expect(formatAppVersion('2.3.4')).toBe('v2.3.4');
    });

    it('preserves existing v prefix', () => {
      expect(formatAppVersion('v1.5.0')).toBe('v1.5.0');
    });

    it('falls back to default version when empty or dev', () => {
      expect(formatAppVersion(undefined)).toBe('v1.5.0');
      expect(formatAppVersion('')).toBe('v1.5.0');
      expect(formatAppVersion('dev')).toBe('v1.5.0');
    });
  });

  describe('getAppVersion', () => {
    it('returns a v-prefixed version string', () => {
      expect(getAppVersion()).toMatch(/^v\S+/);
    });
  });

  describe('getForceUpdateUrl', () => {
    it('builds deterministic /force-update URL from provided origin', () => {
      expect(getForceUpdateUrl('https://mhc-family-portal.vercel.app')).toBe(
        'https://mhc-family-portal.vercel.app/force-update',
      );
      expect(getForceUpdateUrl('https://example.com/')).toBe(
        'https://example.com/force-update',
      );
    });
  });
});
