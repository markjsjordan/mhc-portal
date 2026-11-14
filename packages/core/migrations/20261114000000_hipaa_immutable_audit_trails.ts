import type { Knex } from 'knex';

/**
 * HIPAA-011 / wdvf3acxk9: Immutable, Append-Only Audit Trails & Hash-Chain Columns
 * 45 CFR § 164.312(b) (Audit Controls) & § 164.312(c)(1) (Integrity)
 *
 * Ensures the immutability triggers and hash-chain columns from
 * scripts/migrations/007_hipaa_011_immutable_audit_trails.sql are applied
 * through the standard Knex migration pipeline (`npm run db:migrate`).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit records are immutable and append-only under HIPAA 45 CFR § 164.312(b). Updates, deletes, and truncates are prohibited.';
    END;
    $$ LANGUAGE plpgsql;

    ALTER TABLE audit_revisions
      ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

    ALTER TABLE audit_events
      ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

    DROP TRIGGER IF EXISTS trg_audit_revisions_immutable ON audit_revisions;
    CREATE TRIGGER trg_audit_revisions_immutable
      BEFORE UPDATE OR DELETE ON audit_revisions
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_audit_revisions_no_truncate ON audit_revisions;
    CREATE TRIGGER trg_audit_revisions_no_truncate
      BEFORE TRUNCATE ON audit_revisions
      FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
    CREATE TRIGGER trg_audit_events_immutable
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_audit_events_no_truncate ON audit_events;
    CREATE TRIGGER trg_audit_events_no_truncate
      BEFORE TRUNCATE ON audit_events
      FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_client_access_audit_immutable ON client_access_audit;
    CREATE TRIGGER trg_client_access_audit_immutable
      BEFORE UPDATE OR DELETE ON client_access_audit
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_client_access_audit_no_truncate ON client_access_audit;
    CREATE TRIGGER trg_client_access_audit_no_truncate
      BEFORE TRUNCATE ON client_access_audit
      FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_client_access_audit_no_truncate ON client_access_audit;
    DROP TRIGGER IF EXISTS trg_client_access_audit_immutable ON client_access_audit;
    DROP TRIGGER IF EXISTS trg_audit_events_no_truncate ON audit_events;
    DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
    DROP TRIGGER IF EXISTS trg_audit_revisions_no_truncate ON audit_revisions;
    DROP TRIGGER IF EXISTS trg_audit_revisions_immutable ON audit_revisions;
    DROP FUNCTION IF EXISTS prevent_audit_modification();
  `);
}
