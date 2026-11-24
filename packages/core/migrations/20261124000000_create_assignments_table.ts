import type { Knex } from 'knex';

/**
 * E2 (wdvf3adf61): Caregiver Assignment & Routing — `assignments` and `caregiver_availability` tables.
 *
 * Stores:
 *  - `assignments`: links caregivers to scheduled visits with lifecycle status
 *    (PENDING_ACCEPTANCE, ACCEPTED, COMPLETED, CANCELLED), conflict flag,
 *    and immutable audit history of who assigned/modified and when.
 *  - `caregiver_availability`: weekly hours per day, unavailable date ranges,
 *    and service specialties for assignment rule matching.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      caregiver_id UUID NOT NULL,
      visit_id UUID NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ACCEPTANCE'
        CHECK (status IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'COMPLETED', 'CANCELLED')),
      assigned_by UUID NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      conflict_warning BOOLEAN NOT NULL DEFAULT FALSE,
      audit_history JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_org_caregiver_status
      ON assignments (organization_id, caregiver_id, status);

    CREATE INDEX IF NOT EXISTS idx_assignments_org_visit
      ON assignments (organization_id, visit_id);

    CREATE INDEX IF NOT EXISTS idx_assignments_org_assigned_at
      ON assignments (organization_id, assigned_at DESC);

    CREATE TABLE IF NOT EXISTS caregiver_availability (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      caregiver_id UUID NOT NULL,
      weekly_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
      unavailable_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
      service_specialties TEXT[] NOT NULL DEFAULT '{}',
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, caregiver_id)
    );

    CREATE INDEX IF NOT EXISTS idx_caregiver_availability_org_cg
      ON caregiver_availability (organization_id, caregiver_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS caregiver_availability;
    DROP TABLE IF EXISTS assignments;
  `);
}
