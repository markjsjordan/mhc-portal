import type { Knex } from 'knex';

/**
 * wdvf3ad55p: persist portal invite email delivery state on caregivers, family_members, and clients.
 *
 * Idempotent (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS) and reversible.
 */
const TABLES = ['caregivers', 'family_members', 'clients'] as const;

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.raw(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS portal_invite_email_status VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS portal_invite_email_error VARCHAR(64) NULL,
        ADD COLUMN IF NOT EXISTS portal_invite_email_attempted_at TIMESTAMPTZ NULL
    `);

    await knex.raw(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS chk_${table}_portal_invite_email_status`
    );
    await knex.raw(`
      ALTER TABLE ${table} ADD CONSTRAINT chk_${table}_portal_invite_email_status
        CHECK (portal_invite_email_status IS NULL OR portal_invite_email_status IN ('SENT', 'FAILED', 'SKIPPED', 'BOUNCED', 'COMPLAINED'))
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.raw(
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS chk_${table}_portal_invite_email_status`
    );
    await knex.raw(`
      ALTER TABLE ${table}
        DROP COLUMN IF EXISTS portal_invite_email_status,
        DROP COLUMN IF EXISTS portal_invite_email_error,
        DROP COLUMN IF EXISTS portal_invite_email_attempted_at
    `);
  }
}
