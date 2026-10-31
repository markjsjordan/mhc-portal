-- HIPAA-011: Immutable, Append-Only Audit Trails & Cryptographic Chaining
-- 45 CFR § 164.312(b) & 45 CFR § 164.312(c)(1)

-- 1. Create immutability trigger function
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and append-only under HIPAA 45 CFR § 164.312(b). Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

-- 2. Add hash-chaining columns to audit tables
ALTER TABLE audit_revisions
  ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64);

-- 3. Attach immutability triggers (BEFORE UPDATE OR DELETE)
DROP TRIGGER IF EXISTS trg_audit_revisions_immutable ON audit_revisions;
CREATE TRIGGER trg_audit_revisions_immutable
  BEFORE UPDATE OR DELETE ON audit_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;
CREATE TRIGGER trg_audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS trg_client_access_audit_immutable ON client_access_audit;
CREATE TRIGGER trg_client_access_audit_immutable
  BEFORE UPDATE OR DELETE ON client_access_audit
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
