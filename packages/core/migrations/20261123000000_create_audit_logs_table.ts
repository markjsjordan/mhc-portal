import type { Knex } from 'knex';

/**
 * E6 (wdvf3adf65): HIPAA Compliance & Audit Trail — `audit_logs` table.
 *
 * Stores immutable PHI access and compliance audit entries with:
 *  - user_id, resource_type, resource_id, action (READ / WRITE / DELETE)
 *  - timestamp, ip_address, user_agent, metadata (JSONB, PHI-scrubbed)
 *  - retention_until (minimum 7 years per state retention policy)
 *  - immutability triggers preventing UPDATE, DELETE, and TRUNCATE
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      user_id UUID NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      action VARCHAR(16) NOT NULL CHECK (action IN ('READ', 'WRITE', 'DELETE')),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address VARCHAR(64),
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      retention_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 years')
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_timestamp
      ON audit_logs (organization_id, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_user_timestamp
      ON audit_logs (organization_id, user_id, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_resource
      ON audit_logs (organization_id, resource_type, resource_id);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action_timestamp
      ON audit_logs (organization_id, action, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until
      ON audit_logs (retention_until);

    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Audit records are immutable and append-only under HIPAA 45 CFR § 164.312(b). Updates, deletes, and truncates are prohibited.';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
    CREATE TRIGGER trg_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

    DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
    CREATE TRIGGER trg_audit_logs_no_truncate
      BEFORE TRUNCATE ON audit_logs
      FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_modification();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
    DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
    DROP TABLE IF EXISTS audit_logs;
  `);
}
