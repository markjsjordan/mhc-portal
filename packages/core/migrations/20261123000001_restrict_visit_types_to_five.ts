import type { Knex } from 'knex';

/**
 * 1.5.0 Release: Restrict visit_type to the 5 canonical visit types.
 *
 * Target types:
 * - REGULAR (Home Care Visit)
 * - INITIAL (Med Check)
 * - SUPERVISION (Nurse Visit)
 * - ASSESSMENT (Care Management)
 * - CONCIERGE (Concierge Visit)
 *
 * Deprecated types (DISCHARGE, RESPITE, EMERGENCY, MAKEUP, ONGOING_SUPPORT)
 * are migrated to REGULAR before tightening the CHECK constraint.
 */
export async function up(knex: Knex): Promise<void> {
  // Convert any existing visits using deprecated visit types to REGULAR
  await knex('visits')
    .whereIn('visit_type', ['DISCHARGE', 'RESPITE', 'EMERGENCY', 'MAKEUP', 'ONGOING_SUPPORT'])
    .update({ visit_type: 'REGULAR' });

  // Drop existing CHECK constraint and add restricted 5-type CHECK constraint
  await knex.raw(`
    ALTER TABLE visits
    DROP CONSTRAINT IF EXISTS visits_visit_type_check;

    ALTER TABLE visits
    ADD CONSTRAINT visits_visit_type_check
    CHECK (visit_type IN (
      'REGULAR',
      'INITIAL',
      'SUPERVISION',
      'ASSESSMENT',
      'CONCIERGE'
    ));
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Restore previous 10-type CHECK constraint
  await knex.raw(`
    ALTER TABLE visits
    DROP CONSTRAINT IF EXISTS visits_visit_type_check;

    ALTER TABLE visits
    ADD CONSTRAINT visits_visit_type_check
    CHECK (visit_type IN (
      'REGULAR',
      'INITIAL',
      'DISCHARGE',
      'RESPITE',
      'EMERGENCY',
      'MAKEUP',
      'SUPERVISION',
      'ASSESSMENT',
      'CONCIERGE',
      'ONGOING_SUPPORT'
    ));
  `);
}
