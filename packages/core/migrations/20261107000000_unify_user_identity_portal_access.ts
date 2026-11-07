import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Alter caregivers table
  await knex.schema.alterTable('caregivers', (table) => {
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('portal_access_status', 20).notNullable().defaultTo('NONE');
    table.timestamp('portal_invited_at', { useTz: true }).nullable();
    table.timestamp('portal_activated_at', { useTz: true }).nullable();
    table.timestamp('portal_revoked_at', { useTz: true }).nullable();
    table.uuid('portal_revoked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('portal_revoked_reason').nullable();

    table.check(
      `portal_access_status IN ('NONE', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')`,
      [],
      'chk_caregivers_portal_access_status'
    );
  });

  await knex.raw(
    'CREATE UNIQUE INDEX idx_caregivers_user_id ON caregivers(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL'
  );
  await knex.raw(
    'CREATE INDEX idx_caregivers_portal_status ON caregivers(organization_id, portal_access_status) WHERE deleted_at IS NULL'
  );

  // 2. Alter family_members table
  await knex.schema.alterTable('family_members', (table) => {
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('portal_access_status', 20).notNullable().defaultTo('NONE');
    table.timestamp('portal_invited_at', { useTz: true }).nullable();
    table.timestamp('portal_activated_at', { useTz: true }).nullable();
    table.timestamp('portal_revoked_at', { useTz: true }).nullable();
    table.uuid('portal_revoked_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('portal_revoked_reason').nullable();

    table.check(
      `portal_access_status IN ('NONE', 'INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')`,
      [],
      'chk_family_members_portal_access_status'
    );
  });

  await knex.raw(
    'CREATE UNIQUE INDEX idx_family_members_client_user ON family_members(client_id, user_id) WHERE user_id IS NOT NULL'
  );
  await knex.raw(
    'CREATE INDEX idx_family_members_user_id ON family_members(user_id) WHERE user_id IS NOT NULL'
  );
  await knex.raw(
    'CREATE INDEX idx_family_members_client_portal_status ON family_members(client_id, portal_access_status)'
  );

  // 3. Alter invite_tokens table
  await knex.schema.alterTable('invite_tokens', (table) => {
    table.string('target_type', 20).nullable();
    table.uuid('target_id').nullable();

    table.check(
      `target_type IS NULL OR target_type IN ('STAFF', 'CAREGIVER', 'FAMILY')`,
      [],
      'chk_invite_tokens_target_type'
    );
  });

  await knex.raw(
    'CREATE INDEX idx_invite_tokens_target ON invite_tokens(target_type, target_id)'
  );

  // 4. Backfill (UPDATE only)
  // Step 4.1: Backfill caregivers.user_id by matching ID (if caregiver.id == users.id)
  await knex.raw(`
    UPDATE caregivers c
    SET 
      user_id = u.id,
      portal_access_status = CASE 
        WHEN c.employment_status IN ('TERMINATED', 'RETIRED') THEN 'REVOKED'
        WHEN c.employment_status = 'SUSPENDED' THEN 'SUSPENDED'
        WHEN u.status = 'ACTIVE' THEN 'ACTIVE'
        ELSE 'NONE'
      END,
      portal_activated_at = CASE 
        WHEN c.employment_status NOT IN ('TERMINATED', 'RETIRED', 'SUSPENDED') AND u.status = 'ACTIVE' THEN NOW() 
        ELSE NULL 
      END
    FROM users u
    WHERE c.id = u.id
      AND c.organization_id = u.organization_id
      AND c.user_id IS NULL;
  `);

  // Step 4.2: Backfill caregivers.user_id by matching email within the same organization
  await knex.raw(`
    UPDATE caregivers c
    SET 
      user_id = u.id,
      portal_access_status = CASE 
        WHEN c.employment_status IN ('TERMINATED', 'RETIRED') THEN 'REVOKED'
        WHEN c.employment_status = 'SUSPENDED' THEN 'SUSPENDED'
        WHEN u.status = 'ACTIVE' THEN 'ACTIVE'
        ELSE 'NONE'
      END,
      portal_activated_at = CASE 
        WHEN c.employment_status NOT IN ('TERMINATED', 'RETIRED', 'SUSPENDED') AND u.status = 'ACTIVE' THEN NOW() 
        ELSE NULL 
      END
    FROM users u
    WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(u.email))
      AND c.organization_id = u.organization_id
      AND c.user_id IS NULL;
  `);

  // Step 4.3: Backfill family_members.user_id by matching ID (if family_member.id == users.id)
  await knex.raw(`
    UPDATE family_members fm
    SET 
      user_id = u.id,
      portal_access_status = CASE 
        WHEN cl.status IN ('DISCHARGED', 'DECEASED') THEN 'REVOKED'
        WHEN fm.invitation_status = 'ACCEPTED' AND u.status = 'ACTIVE' THEN 'ACTIVE'
        WHEN fm.invitation_status = 'PENDING' THEN 'INVITED'
        WHEN fm.invitation_status = 'REVOKED' THEN 'REVOKED'
        ELSE 'NONE'
      END,
      portal_activated_at = CASE WHEN fm.invitation_status = 'ACCEPTED' THEN NOW() ELSE NULL END
    FROM users u
    JOIN clients cl ON cl.id = fm.client_id
    WHERE fm.id = u.id
      AND cl.organization_id = u.organization_id
      AND fm.user_id IS NULL;
  `);

  // Step 4.4: Backfill family_members.user_id by matching email within the same organization
  await knex.raw(`
    UPDATE family_members fm
    SET 
      user_id = u.id,
      portal_access_status = CASE 
        WHEN cl.status IN ('DISCHARGED', 'DECEASED') THEN 'REVOKED'
        WHEN fm.invitation_status = 'ACCEPTED' AND u.status = 'ACTIVE' THEN 'ACTIVE'
        WHEN fm.invitation_status = 'PENDING' THEN 'INVITED'
        WHEN fm.invitation_status = 'REVOKED' THEN 'REVOKED'
        ELSE 'NONE'
      END,
      portal_activated_at = CASE WHEN fm.invitation_status = 'ACCEPTED' THEN NOW() ELSE NULL END
    FROM clients cl
    JOIN users u ON u.organization_id = cl.organization_id AND LOWER(TRIM(u.email)) = LOWER(TRIM(fm.email))
    WHERE fm.client_id = cl.id
      AND fm.user_id IS NULL;
  `);

  // Step 4.5: Report unmatched counts with RAISE NOTICE
  await knex.raw(`
    DO $$
    DECLARE
      unmatched_caregivers INT;
      unmatched_family INT;
    BEGIN
      SELECT COUNT(*) INTO unmatched_caregivers FROM caregivers WHERE user_id IS NULL AND deleted_at IS NULL;
      SELECT COUNT(*) INTO unmatched_family FROM family_members WHERE user_id IS NULL;
      RAISE NOTICE 'Migration backfill complete. Caregivers without user link: %, Family members without user link: %', 
        unmatched_caregivers, unmatched_family;
    END $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // 1. Drop invite_tokens additions
  await knex.raw('DROP INDEX IF EXISTS idx_invite_tokens_target');
  await knex.raw('ALTER TABLE invite_tokens DROP CONSTRAINT IF EXISTS chk_invite_tokens_target_type');
  await knex.schema.alterTable('invite_tokens', (table) => {
    table.dropColumn('target_id');
    table.dropColumn('target_type');
  });

  // 2. Drop family_members additions
  await knex.raw('DROP INDEX IF EXISTS idx_family_members_client_portal_status');
  await knex.raw('DROP INDEX IF EXISTS idx_family_members_user_id');
  await knex.raw('DROP INDEX IF EXISTS idx_family_members_client_user');
  await knex.raw('ALTER TABLE family_members DROP CONSTRAINT IF EXISTS chk_family_members_portal_access_status');
  await knex.schema.alterTable('family_members', (table) => {
    table.dropColumn('portal_revoked_reason');
    table.dropColumn('portal_revoked_by');
    table.dropColumn('portal_revoked_at');
    table.dropColumn('portal_activated_at');
    table.dropColumn('portal_invited_at');
    table.dropColumn('portal_access_status');
    table.dropColumn('user_id');
  });

  // 3. Drop caregivers additions
  await knex.raw('DROP INDEX IF EXISTS idx_caregivers_portal_status');
  await knex.raw('DROP INDEX IF EXISTS idx_caregivers_user_id');
  await knex.raw('ALTER TABLE caregivers DROP CONSTRAINT IF EXISTS chk_caregivers_portal_access_status');
  await knex.schema.alterTable('caregivers', (table) => {
    table.dropColumn('portal_revoked_reason');
    table.dropColumn('portal_revoked_by');
    table.dropColumn('portal_revoked_at');
    table.dropColumn('portal_activated_at');
    table.dropColumn('portal_invited_at');
    table.dropColumn('portal_access_status');
    table.dropColumn('user_id');
  });
}
