-- HIPAA-007: Add blind index columns and encryption flags for ePHI/PII
-- 45 CFR § 164.312(a)(2)(iv) Encryption and Decryption at Rest

-- 1. Clients: blind indexes for exact-match lookups on SSN and MRN
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ssn_bidx VARCHAR(64),
  ADD COLUMN IF NOT EXISTS medical_record_number_bidx VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_clients_ssn_bidx ON clients (organization_id, ssn_bidx);
CREATE INDEX IF NOT EXISTS idx_clients_mrn_bidx ON clients (organization_id, medical_record_number_bidx);

-- 2. Caregivers: blind index for exact-match lookup on SSN
ALTER TABLE caregivers
  ADD COLUMN IF NOT EXISTS ssn_bidx VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_caregivers_ssn_bidx ON caregivers (organization_id, ssn_bidx);

-- 3. EVV Records: blind index for Medicaid ID
ALTER TABLE evv_records
  ADD COLUMN IF NOT EXISTS client_medicaid_id_bidx VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_evv_records_client_medicaid_id_bidx ON evv_records (organization_id, client_medicaid_id_bidx);

-- 4. Clinical Visit Notes: ensure encryption tracking flag and columns
ALTER TABLE clinical_visit_notes
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS encrypted_fields JSONB DEFAULT '[]'::jsonb;
