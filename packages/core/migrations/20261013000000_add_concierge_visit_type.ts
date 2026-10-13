import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add CONCIERGE and ONGOING_SUPPORT to visit_type constraint
  // Note: ONGOING_SUPPORT is also added as per spec requirement
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

export async function down(knex: Knex): Promise<void> {
  // Revert to previous constraint
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
      'ASSESSMENT'
    ));
  `);
}
