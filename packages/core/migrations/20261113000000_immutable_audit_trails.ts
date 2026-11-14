import type { Knex } from 'knex';

/**
 * HIPAA § 164.312(b) & § 164.312(c)(1): Immutable, Append-Only Audit Trails.
 *
 * Ensures audit tables cannot be modified, deleted, or truncated in-place
 * across all environments where `npm run db:migrate` (Knex) is executed.
 * Also adds hash-chaining columns (`previous_hash`, `entry_hash`) to
 * `audit_events` and `audit_revisions` if not already present.
 */

const AUDIT_TABLES = [
  'audit_events',
  'audit_revisions',
  'client_access_audit',
  'evv_revisions',
  'evv_original_data',
  'evv_access_log',
  'auth_events',
  'security_events',
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit records are immutable and append-only under HIPAA 45 CFR § 164.312(b). Updates, deletes, and truncates are prohibited.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF to_regclass('public.audit_revisions') IS NOT NULL THEN
        ALTER TABLE audit_revisions
          ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
          ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);
      END IF;

      IF to_regclass('public.audit_events') IS NOT NULL THEN
        ALTER TABLE audit_events
          ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
          ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);
      END IF;
    END $$;
  `);

  for (const table of AUDIT_TABLES) {
    await knex.raw(`
      DO $$
      BEGIN
        IF to_regclass('public.${table}') IS NOT NULL THEN
          DROP TRIGGER IF EXISTS trg_${table}_immutable ON ${table};
          CREATE TRIGGER trg_${table}_immutable
            BEFORE UPDATE OR DELETE ON ${table}
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

          DROP TRIGGER IF EXISTS trg_${table}_no_truncate ON ${table};
          CREATE TRIGGER trg_${table}_no_truncate
            BEFORE TRUNCATE ON ${table}
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();
        END IF;
      END $$;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of AUDIT_TABLES) {
    await knex.raw(`
      DO $$
      BEGIN
        IF to_regclass('public.${table}') IS NOT NULL THEN
          DROP TRIGGER IF EXISTS trg_${table}_immutable ON ${table};
          DROP TRIGGER IF EXISTS trg_${table}_no_truncate ON ${table};
        END IF;
      END $$;
    `);
  }

  await knex.raw('DROP FUNCTION IF EXISTS prevent_audit_modification();');
}
