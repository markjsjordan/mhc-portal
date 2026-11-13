import type { Knex } from 'knex';

/**
 * wdvf3acxjt: direct client portal access (CLIENT role).
 *
 * - clients gains user_id (one login per client) + portal_access_* lifecycle columns,
 *   mirroring caregivers/family_members from 20261107000000.
 * - invite_tokens.target_type check constraint is widened to allow 'CLIENT'.
 *
 * Idempotent (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) and reversible.
 * Existing clients default to 'NONE' (no access) - least privilege.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS portal_access_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS portal_activated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS portal_revoked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS portal_revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS portal_revoked_reason TEXT
  `);

  await knex.raw(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_portal_access_status`);
  await knex.raw(`
    ALTER TABLE clients ADD CONSTRAINT chk_clients_portal_access_status
      CHECK (portal_access_status IN ('NONE', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED'))
  `);

  // A user maps to at most one client record (no email matching, exact link).
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL`
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_clients_portal_status ON clients(organization_id, portal_access_status) WHERE deleted_at IS NULL`
  );

  await knex.raw(`ALTER TABLE invite_tokens DROP CONSTRAINT IF EXISTS chk_invite_tokens_target_type`);
  await knex.raw(`
    ALTER TABLE invite_tokens ADD CONSTRAINT chk_invite_tokens_target_type
      CHECK (target_type IS NULL OR target_type IN ('STAFF', 'CAREGIVER', 'FAMILY', 'CLIENT'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove CLIENT invites first so the narrower constraint can be re-added.
  await knex.raw(`DELETE FROM invite_tokens WHERE target_type = 'CLIENT'`);
  await knex.raw(`ALTER TABLE invite_tokens DROP CONSTRAINT IF EXISTS chk_invite_tokens_target_type`);
  await knex.raw(`
    ALTER TABLE invite_tokens ADD CONSTRAINT chk_invite_tokens_target_type
      CHECK (target_type IS NULL OR target_type IN ('STAFF', 'CAREGIVER', 'FAMILY'))
  `);

  await knex.raw(`DROP INDEX IF EXISTS idx_clients_portal_status`);
  await knex.raw(`DROP INDEX IF EXISTS idx_clients_user_id`);
  await knex.raw(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS chk_clients_portal_access_status`);
  await knex.raw(`
    ALTER TABLE clients
      DROP COLUMN IF EXISTS portal_revoked_reason,
      DROP COLUMN IF EXISTS portal_revoked_by,
      DROP COLUMN IF EXISTS portal_revoked_at,
      DROP COLUMN IF EXISTS portal_activated_at,
      DROP COLUMN IF EXISTS portal_invited_at,
      DROP COLUMN IF EXISTS portal_access_status,
      DROP COLUMN IF EXISTS user_id
  `);
}
