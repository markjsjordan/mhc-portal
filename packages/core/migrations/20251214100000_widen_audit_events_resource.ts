import type { Knex } from 'knex';

/**
 * Widen audit_events.resource and resource_id columns.
 *
 * Root cause: AuthMiddleware.requireRole() logs unauthorized access attempts
 * with `resource: req.path`. Deeply-nested API routes (nested resource IDs,
 * query-heavy paths) regularly exceed the original varchar(100) limit,
 * causing Postgres error 22001 ("value too long for type character
 * varying(100)") and silently dropping the audit log entry.
 *
 * This is a compliance regression: HIPAA and the 21st Century Cures Act
 * require an intact audit trail for unauthorized access attempts. A failed
 * INSERT here means security events go unrecorded instead of just
 * unformatted.
 *
 * Fix: widen `resource` and `resource_id` to varchar(255), which comfortably
 * covers any realistic Express route path, and matches the defensive
 * truncation added in AuditService.logEvent as a second line of defense.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('audit_events', (table) => {
    table.string('resource', 255).notNullable().alter();
    table.string('resource_id', 255).notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // NOTE: down() only restores the column width. If any existing rows
  // (written after `up`) exceed 100 characters, this will fail on
  // downgrade — that's intentional since silently truncating audit records
  // would itself be a compliance violation. Trim or archive offending rows
  // before rolling back if that situation ever arises.
  await knex.schema.alterTable('audit_events', (table) => {
    table.string('resource', 100).notNullable().alter();
    table.string('resource_id', 100).notNullable().alter();
  });
}
