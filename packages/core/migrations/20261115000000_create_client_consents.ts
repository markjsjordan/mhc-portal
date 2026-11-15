import type { Knex } from 'knex';

/**
 * wdvf3acxnt (Lane B1): persist client intake consents and signature.
 *
 * Stores care agreement, HIPAA acknowledgement, financial responsibility,
 * EVV consent, signature, signed_date, and actor/timestamp metadata.
 * Idempotent and reversible.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS client_consents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      care_agreement BOOLEAN NOT NULL DEFAULT FALSE,
      hipaa BOOLEAN NOT NULL DEFAULT FALSE,
      financial_responsibility BOOLEAN NOT NULL DEFAULT FALSE,
      evv BOOLEAN NOT NULL DEFAULT FALSE,
      signature TEXT NOT NULL DEFAULT '',
      signed_date TIMESTAMPTZ,
      recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_client_consents_client_id
      ON client_consents(client_id)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_client_consents_org_client
      ON client_consents(organization_id, client_id)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_client_consents_org_client`);
  await knex.raw(`DROP INDEX IF EXISTS idx_client_consents_client_id`);
  await knex.raw(`DROP TABLE IF EXISTS client_consents`);
}
