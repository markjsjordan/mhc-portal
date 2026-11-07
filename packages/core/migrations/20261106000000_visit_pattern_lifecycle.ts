import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasVisitPatterns = await knex.schema.hasTable('visit_patterns');
  if (hasVisitPatterns) {
    await knex.schema.alterTable('visit_patterns', (table) => {
      table.timestamp('paused_at');
      table.uuid('paused_by');
      table.text('pause_reason');

      table.timestamp('ended_at');
      table.uuid('ended_by');
      table.text('end_reason');
    });

    // Backfill any non-conforming status rows to nearest value before adding CHECK constraint
    await knex.raw(`
      UPDATE visit_patterns
      SET status = CASE
        WHEN status ILIKE 'pause%' THEN 'PAUSED'
        WHEN status ILIKE 'cancel%' OR status ILIKE 'end%' THEN 'CANCELLED'
        ELSE 'ACTIVE'
      END
      WHERE status NOT IN ('ACTIVE', 'PAUSED', 'CANCELLED');
    `);

    // Add CHECK constraint
    await knex.raw(`
      ALTER TABLE visit_patterns
      ADD CONSTRAINT chk_visit_patterns_status
      CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED'));
    `);

    // Add index: (organization_id, status, client_id) WHERE deleted_at IS NULL
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_visit_patterns_org_status_client
      ON visit_patterns(organization_id, status, client_id)
      WHERE deleted_at IS NULL;
    `);
  }

  // Check if visits table exists and add idx_visits_pattern_date if absent
  const hasVisits = await knex.schema.hasTable('visits');
  if (hasVisits) {
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS idx_visits_pattern_date
      ON visits(pattern_id, scheduled_date);
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasVisits = await knex.schema.hasTable('visits');
  if (hasVisits) {
    await knex.raw('DROP INDEX IF EXISTS idx_visits_pattern_date;');
  }

  const hasVisitPatterns = await knex.schema.hasTable('visit_patterns');
  if (hasVisitPatterns) {
    await knex.raw('DROP INDEX IF EXISTS idx_visit_patterns_org_status_client;');
    await knex.raw('ALTER TABLE visit_patterns DROP CONSTRAINT IF EXISTS chk_visit_patterns_status;');

    await knex.schema.alterTable('visit_patterns', (table) => {
      table.dropColumn('end_reason');
      table.dropColumn('ended_by');
      table.dropColumn('ended_at');
      table.dropColumn('pause_reason');
      table.dropColumn('paused_by');
      table.dropColumn('paused_at');
    });
  }
}
