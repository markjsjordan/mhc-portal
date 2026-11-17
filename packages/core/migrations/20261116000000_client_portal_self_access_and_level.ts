import type { Knex } from 'knex';

/**
 * wdvf3ad55r: client self-portal access gate and access level.
 *
 * - Adds `portal_access_level` (matching `family_members` shape, default 'FULL_ACCESS')
 * - Adds `portal_self_access_allowed` (boolean, default false) so admins must
 *   deliberately enable self-access rather than routing through a legal representative.
 *
 * Idempotent (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) and production-safe
 * (constant defaults do not rewrite existing rows in PostgreSQL 11+).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS portal_access_level VARCHAR(50) NOT NULL DEFAULT 'FULL_ACCESS',
      ADD COLUMN IF NOT EXISTS portal_self_access_allowed BOOLEAN NOT NULL DEFAULT false
  `);

  await knex.raw(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_portal_access_level`);
  await knex.raw(`
    ALTER TABLE clients ADD CONSTRAINT chk_clients_portal_access_level
      CHECK (portal_access_level IN ('VIEW_BASIC', 'VIEW_DETAILED', 'VIEW_MEDICAL', 'VIEW_FINANCIAL', 'FULL_ACCESS'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_portal_access_level`);
  await knex.raw(`
    ALTER TABLE clients
      DROP COLUMN IF EXISTS portal_self_access_allowed,
      DROP COLUMN IF EXISTS portal_access_level
  `);
}
