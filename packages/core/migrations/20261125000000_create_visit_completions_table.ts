import type { Knex } from 'knex';

/**
 * E3 (wdvf3adf62): Visit Documentation & Completion — `visit_completions` table
 * and `visits.completed_at` column.
 *
 * Stores:
 *  - `visits.completed_at`: timestamp when visit was marked completed or no-show
 *  - `visit_completions`: structured completion payload (tasks_completed, observations,
 *    adverse_events, time_in/time_out, actual vs scheduled duration, caregiver PIN/signature
 *    confirmation hash, and immutable audit_history of initial submission and coordinator edits).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE visits
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS visit_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      visit_id UUID NOT NULL UNIQUE,
      caregiver_id UUID,
      outcome VARCHAR(32) NOT NULL DEFAULT 'COMPLETED'
        CHECK (outcome IN ('COMPLETED', 'NO_SHOW')),
      tasks_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
      observations TEXT,
      adverse_events TEXT,
      time_in TIMESTAMPTZ NOT NULL,
      time_out TIMESTAMPTZ NOT NULL,
      actual_duration INTEGER NOT NULL,
      scheduled_duration INTEGER NOT NULL,
      duration_variance INTEGER NOT NULL,
      confirmation_method VARCHAR(32) NOT NULL DEFAULT 'PIN'
        CHECK (confirmation_method IN ('PIN', 'SIGNATURE')),
      confirmation_value_hash VARCHAR(128),
      confirmed_by UUID NOT NULL,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      audit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_visit_completions_org_visit
      ON visit_completions (organization_id, visit_id);

    CREATE INDEX IF NOT EXISTS idx_visit_completions_org_caregiver
      ON visit_completions (organization_id, caregiver_id);

    CREATE INDEX IF NOT EXISTS idx_visit_completions_org_confirmed_at
      ON visit_completions (organization_id, confirmed_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS visit_completions;
    ALTER TABLE visits DROP COLUMN IF EXISTS completed_at;
  `);
}
