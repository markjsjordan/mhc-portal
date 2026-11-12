-- Migration: Add portal access fields to clients table for CLIENT role
-- Ticket: wdvf3acxjt
-- Description: Adds portal_access_status, portal_invited_at, portal_activated_at, portal_revoked_at, 
--              portal_revoked_by, portal_revoked_reason, and user_id fields to clients table
--              to support direct client portal access (CLIENT role)

-- Add portal access columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS portal_access_status VARCHAR(20) CHECK (portal_access_status IN ('NONE', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  ADD COLUMN IF NOT EXISTS portal_invited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS portal_activated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS portal_revoked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS portal_revoked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS portal_revoked_reason TEXT;

-- Create index on user_id for efficient portal link lookups
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id) WHERE user_id IS NOT NULL;

-- Create index on portal_access_status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_clients_portal_access_status ON clients(portal_access_status) WHERE portal_access_status IS NOT NULL;

-- Update invite_tokens table to support CLIENT target_type
-- Note: This assumes the target_type column exists and is a varchar/text type
-- If it has a constraint, you may need to drop and recreate it
COMMENT ON COLUMN invite_tokens.target_type IS 'Target type: STAFF, CAREGIVER, FAMILY, or CLIENT';
