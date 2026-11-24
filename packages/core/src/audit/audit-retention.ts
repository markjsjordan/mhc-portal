/**
 * HIPAA Audit Log Retention Policy Configuration
 *
 * Federal HIPAA Security Rule (45 CFR § 164.316(b)(2)(i)) mandates a minimum
 * 6-year retention period. MHC Portal enforces a stricter 7-year minimum floor
 * across all jurisdictions, with state-specific overrides where state home
 * health or Medicaid statutes require longer retention.
 */

export const MINIMUM_AUDIT_RETENTION_YEARS = 7;

/**
 * State-specific audit log retention periods in years.
 * Every configured state value is at least MINIMUM_AUDIT_RETENTION_YEARS (7).
 */
export const STATE_AUDIT_RETENTION_YEARS: Readonly<Record<string, number>> = {
  CA: 7,
  FL: 7,
  IL: 7,
  MA: 7,
  MD: 7,
  MI: 7,
  NC: 7,
  NJ: 7,
  NY: 7,
  OH: 7,
  PA: 7,
  TX: 7,
  VA: 7,
  WA: 7,
  WI: 7,
  // States with extended Medicaid / home health record retention rules
  MN: 8,
  NH: 8,
  NV: 8,
  OR: 10,
};

/**
 * Returns the required audit log retention period (in years) for a given US
 * state code. Always enforces the 7-year minimum floor.
 */
export function getAuditRetentionYears(stateCode?: string | null): number {
  if (typeof stateCode !== 'string' || stateCode.trim() === '') {
    return MINIMUM_AUDIT_RETENTION_YEARS;
  }
  const normalized = stateCode.trim().toUpperCase();
  const configured = STATE_AUDIT_RETENTION_YEARS[normalized];
  if (typeof configured !== 'number' || !Number.isFinite(configured)) {
    return MINIMUM_AUDIT_RETENTION_YEARS;
  }
  return Math.max(MINIMUM_AUDIT_RETENTION_YEARS, Math.floor(configured));
}

/**
 * Computes the `retention_until` timestamp for an audit log entry.
 */
export function calculateRetentionUntil(
  timestamp: Date,
  stateCode?: string | null
): Date {
  const years = getAuditRetentionYears(stateCode);
  const retentionUntil = new Date(timestamp.getTime());
  retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + years);
  return retentionUntil;
}
