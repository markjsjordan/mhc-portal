-- Migration: Add schedule_backups table for offline resilience (ClickUp wdvf3add1c)
-- Purpose: Store weekly schedule snapshots for offline fallback and disaster recovery
-- Author: Automated implementation
-- Date: 2026-11-22

-- Create schedule_backups table
CREATE TABLE IF NOT EXISTS schedule_backups (
  id VARCHAR(255) PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_ids JSONB DEFAULT '[]'::jsonb,
  
  -- Date range for the backup
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Backup metadata
  format VARCHAR(10) NOT NULL CHECK (format IN ('CSV', 'PDF', 'JSON')),
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('MANUAL', 'AUTOMATED')),
  triggered_by UUID NOT NULL,
  
  -- Snapshot statistics
  visit_count INTEGER NOT NULL DEFAULT 0,
  caregiver_count INTEGER NOT NULL DEFAULT 0,
  client_count INTEGER NOT NULL DEFAULT 0,
  
  -- Backup data (JSONB for flexibility and queryability)
  backup_data JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Indexes for common queries
  CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Index for organization-scoped queries
CREATE INDEX IF NOT EXISTS idx_schedule_backups_org ON schedule_backups(organization_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_schedule_backups_dates ON schedule_backups(organization_id, start_date, end_date);

-- Index for cleanup queries (find expired backups)
CREATE INDEX IF NOT EXISTS idx_schedule_backups_expires ON schedule_backups(expires_at) WHERE expires_at IS NOT NULL;

-- Index for latest backup queries
CREATE INDEX IF NOT EXISTS idx_schedule_backups_latest ON schedule_backups(organization_id, created_at DESC);

-- Add comment
COMMENT ON TABLE schedule_backups IS 'Weekly schedule snapshots for offline resilience and disaster recovery (ClickUp wdvf3add1c)';
COMMENT ON COLUMN schedule_backups.backup_data IS 'Full schedule snapshot including visits, caregivers, and clients in JSONB format';
COMMENT ON COLUMN schedule_backups.expires_at IS 'Automatic cleanup date (typically 90 days after creation)';

-- Grant permissions (adjust based on your roles)
-- GRANT SELECT, INSERT ON schedule_backups TO app_user;
-- GRANT DELETE ON schedule_backups TO app_admin;
