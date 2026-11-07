import { Knex } from 'knex';

/**
 * Add user_id column to caregivers table and create unique partial index
 * Backfill user_id where exactly one caregiver matches user email in the same organization
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('caregivers');
  if (!hasTable) {
    return;
  }

  const hasUserIdColumn = await knex.schema.hasColumn('caregivers', 'user_id');
  if (!hasUserIdColumn) {
    await knex.schema.alterTable('caregivers', (table) => {
      table.uuid('user_id').nullable().references('id').inTable('users');
    });
  }

  // Create partial unique index on user_id where user_id IS NOT NULL and deleted_at IS NULL
  await knex.raw(
    'CREATE UNIQUE INDEX idx_caregivers_user_id_unique ON caregivers(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL'
  );

  // Backfill ONLY where exactly one caregivers row (same organization_id, deleted_at IS NULL, user_id IS NULL)
  // matches LOWER(caregivers.email) = LOWER(users.email) AND the user is a member of that organization.
  // Ambiguous (2+) stays NULL.
  await knex.raw(`
    WITH eligible_matches AS (
      SELECT
        c.id AS caregiver_id,
        u.id AS matched_user_id,
        COUNT(*) OVER (PARTITION BY c.organization_id, LOWER(c.email)) AS match_count
      FROM caregivers c
      INNER JOIN users u
        ON c.organization_id = u.organization_id
        AND LOWER(c.email) = LOWER(u.email)
        AND u.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
        AND c.user_id IS NULL
    )
    UPDATE caregivers
    SET user_id = eligible_matches.matched_user_id
    FROM eligible_matches
    WHERE caregivers.id = eligible_matches.caregiver_id
      AND eligible_matches.match_count = 1
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('caregivers');
  if (!hasTable) {
    return;
  }

  await knex.raw('DROP INDEX IF EXISTS idx_caregivers_user_id_unique');

  const hasUserIdColumn = await knex.schema.hasColumn('caregivers', 'user_id');
  if (hasUserIdColumn) {
    await knex.schema.alterTable('caregivers', (table) => {
      table.dropColumn('user_id');
    });
  }
}
