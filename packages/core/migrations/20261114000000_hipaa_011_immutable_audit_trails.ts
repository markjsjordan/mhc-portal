import type { Knex } from 'knex';

const AUDIT_TABLES = [
  'audit_revisions',
  'audit_events',
  'client_access_audit',
  'evv_revisions',
  'evv_original_data',
  'evv_access_log',
  'auth_events',
  'security_events',
];

const HASH_CHAIN_TABLES = ['audit_revisions', 'audit_events'];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit records are immutable and append-only under HIPAA 45 CFR § 164.312(b). Updates, deletes, and truncates are prohibited.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  for (const table of HASH_CHAIN_TABLES) {
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) THEN
          ALTER TABLE ${table}
            ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);
        END IF;
      END $$;
    `);
  }

  for (const table of AUDIT_TABLES) {
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) THEN
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
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) THEN
          DROP TRIGGER IF EXISTS trg_${table}_immutable ON ${table};
          DROP TRIGGER IF EXISTS trg_${table}_no_truncate ON ${table};
        END IF;
      END $$;
    `);
  }

  await knex.raw('DROP FUNCTION IF EXISTS prevent_audit_modification();');
}
