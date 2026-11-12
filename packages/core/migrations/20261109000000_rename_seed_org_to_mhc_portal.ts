import type { Knex } from 'knex';

// Seed organization (fixed ID from seed-base) was branded "Folk Home Health",
// which surfaced on the invite-acceptance page. Rename only that exact row/name
// so real tenant organizations are never touched.
const SEED_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE organizations
        SET name = 'MHC Portal',
            legal_name = 'MHC Portal',
            updated_at = NOW()
      WHERE id = ?
        AND name = 'Folk Home Health'`,
    [SEED_ORG_ID]
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE organizations
        SET name = 'Folk Home Health',
            legal_name = 'Folk Home Health Services, Inc.',
            updated_at = NOW()
      WHERE id = ?
        AND name = 'MHC Portal'`,
    [SEED_ORG_ID]
  );
}
