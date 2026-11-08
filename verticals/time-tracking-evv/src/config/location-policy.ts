/**
 * Organization Location Policy
 *
 * Config switch for EVV location requirements:
 * organizations.settings.evv.locationRequired (boolean)
 * Default: false (OFF, missing key = false)
 */

import type { Database } from '@folkcare/core';
import { CacheKeys } from '@folkcare/core';
import { getCacheService } from '@folkcare/core/service/cache.service';

export interface LocationPolicy {
  locationRequired: boolean;
}

/**
 * Resolves location policy from organization settings object.
 * Missing key defaults to false (OFF).
 */
export function resolveLocationPolicy(settings: unknown): LocationPolicy {
  if (
    typeof settings === 'object' &&
    settings !== null &&
    'evv' in settings &&
    typeof (settings as Record<string, unknown>).evv === 'object' &&
    (settings as Record<string, unknown>).evv !== null
  ) {
    const evv = (settings as { evv: Record<string, unknown> }).evv;
    if (typeof evv.locationRequired === 'boolean') {
      return { locationRequired: evv.locationRequired };
    }
  }
  return { locationRequired: false };
}

/**
 * Loads organization location policy with caching.
 */
export async function loadOrgLocationPolicy(
  db: Database,
  orgId: string
): Promise<LocationPolicy> {
  const cacheKey = CacheKeys.evvLocationPolicy(orgId);
  try {
    const cache = getCacheService();
    const cached = await cache.get<LocationPolicy>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch {
    // Cache retrieval failure should not block operation
  }

  let row: { settings: unknown } | undefined;
  if (db && typeof db.query === 'function') {
    try {
      const result = await db.query<{ settings: unknown }>(
        'SELECT settings FROM organizations WHERE id = $1',
        [orgId]
      );
      row = result?.rows?.[0];
    } catch {
      // Database query failure falls back to default policy
    }
  }

  const policy = row ? resolveLocationPolicy(row.settings) : { locationRequired: false };

  try {
    const cache = getCacheService();
    await cache.set(cacheKey, policy, 300); // 5 min TTL
  } catch {
    // Cache set failure should not block operation
  }

  return policy;
}
