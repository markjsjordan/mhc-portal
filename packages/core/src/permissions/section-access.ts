/**
 * Section-based READ/WRITE access model (ticket wdvf3abzp9).
 *
 * Phase 1 (parity): role default section permissions derived from the
 * legacy resource:action map in permission-service.ts. Enforcement is NOT
 * changed here; the legacy gate remains authoritative until shadow mode is
 * enabled per org.
 *
 * READ and WRITE are independent flags per section. A WRITE grant does not
 * imply READ. Legacy wildcard "resource:*" maps to READ+WRITE on that section.
 */

export const SECTIONS = [
  'clients',
  'caregivers',
  'staff',
  'scheduling',
  'visits',
  'care-plans',
  'tasks',
  'notes',
  'incidents',
  'messages',
  'family-portal',
  'billing',
  'reports',
  'compliance',
  'audit-logs',
  'admin-settings',
  'training-payroll',
] as const;

export type Section = (typeof SECTIONS)[number];

export interface SectionPermission {
  read: boolean;
  write: boolean;
}

export type SectionPermissionMap = Record<Section, SectionPermission>;

/** Maps a legacy resource prefix to its section. */
export const RESOURCE_TO_SECTION: ReadonlyMap<string, Section> = new Map<string, Section>(Object.entries({
  clients: 'clients',
  caregivers: 'caregivers',
  staff: 'staff',
  schedules: 'scheduling',
  visits: 'visits',
  'care-plans': 'care-plans',
  tasks: 'tasks',
  notes: 'notes',
  incidents: 'incidents',
  messages: 'messages',
  'family-portal': 'family-portal',
  'activity-feed': 'family-portal',
  notifications: 'messages',
  billing: 'billing',
  invoices: 'billing',
  reports: 'reports',
  compliance: 'compliance',
  'audit-logs': 'audit-logs',
  settings: 'admin-settings',
  admin: 'admin-settings',
  training: 'training-payroll',
  certifications: 'training-payroll',
  payroll: 'training-payroll',
  medications: 'clients',
  evv: 'visits',
  'time-tracking': 'visits',
  'qa-audits': 'compliance',
  export: 'reports',
}) as [string, Section][]);

const READ_ACTIONS = new Set(['read', 'view']);

function emptyMap(): Map<Section, SectionPermission> {
  return new Map(SECTIONS.map((s) => [s, { read: false, write: false }]));
}

function toRecord(m: Map<Section, SectionPermission>): SectionPermissionMap {
  return Object.fromEntries(m) as SectionPermissionMap;
}

/**
 * Convert a legacy permission set (e.g. "clients:read", "schedules:*") into
 * section READ/WRITE flags. Unknown resources are ignored and reported via
 * the returned `unmapped` list so parity gaps are visible, not silent.
 */
export function legacyToSectionMap(legacy: Iterable<string>): {
  map: SectionPermissionMap;
  unmapped: string[];
} {
  const map = emptyMap();
  const unmapped: string[] = [];

  for (const perm of legacy) {
    if (perm === '*:*') {
      for (const s of SECTIONS) map.set(s, { read: true, write: true });
      continue;
    }
    const [resource, action] = perm.split(':');
    const section = RESOURCE_TO_SECTION.get(resource ?? '');
    if (section === undefined) {
      unmapped.push(perm);
      continue;
    }
    const entry = map.get(section);
    if (entry === undefined) {
      unmapped.push(perm);
      continue;
    }
    if (action === '*') {
      entry.read = true;
      entry.write = true;
    } else if (READ_ACTIONS.has(action ?? '')) {
      entry.read = true;
    } else {
      // Any non-read verb (create/update/delete/send/complete/invite/access/...) is
      // WRITE-class, so no legacy grant is dropped during migration.
      entry.write = true;
    }
  }

  return { map: toRecord(map), unmapped };
}
