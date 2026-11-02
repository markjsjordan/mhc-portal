import { describe, it, expect } from 'vitest';
import { PermissionService } from '../../permissions/permission-service.js';
import {
  legacyToSectionMap,
  SECTIONS,
  type Section,
  type SectionPermissionMap,
} from '../../permissions/section-access.js';

function section(map: SectionPermissionMap, s: Section) {
  const entry = new Map(Object.entries(map)).get(s);
  if (entry === undefined) throw new Error(`missing section ${s}`);
  return entry;
}

describe('section access parity', () => {
  const service = new PermissionService();
  const roles = [
    'SUPER_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'COORDINATOR', 'SCHEDULER',
    'CAREGIVER', 'FAMILY', 'BILLING', 'HR', 'AUDITOR', 'READ_ONLY',
    'NURSE', 'NURSE_RN', 'NURSE_LPN', 'CLINICAL',
  ];

  it.each(roles)('%s has no unmapped legacy permissions', (role) => {
    const legacy = service.getPermissionsForRoles([role]);
    const { unmapped } = legacyToSectionMap(legacy);
    expect(unmapped).toEqual([]);
  });

  it('SUPER_ADMIN (*:*) grants READ and WRITE on every section', () => {
    const { map } = legacyToSectionMap(['*:*']);
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect(Object.keys(map).sort(byName)).toEqual([...SECTIONS].sort(byName));
    for (const perm of Object.values(map)) {
      expect(perm).toEqual({ read: true, write: true });
    }
  });

  it('READ_ONLY grants READ only, no WRITE', () => {
    const { map } = legacyToSectionMap(service.getPermissionsForRoles(['READ_ONLY']));
    expect(section(map, 'clients')).toEqual({ read: true, write: false });
    expect(section(map, 'reports')).toEqual({ read: true, write: false });
    expect(section(map, 'billing')).toEqual({ read: false, write: false });
  });

  it('WRITE does not imply READ for a write-only grant', () => {
    const { map } = legacyToSectionMap(['tasks:complete']);
    expect(section(map, 'tasks')).toEqual({ read: false, write: true });
  });

  it('resource wildcard grants READ and WRITE on that section only', () => {
    const { map } = legacyToSectionMap(['clients:*']);
    expect(section(map, 'clients')).toEqual({ read: true, write: true });
    expect(section(map, 'caregivers')).toEqual({ read: false, write: false });
  });

  it('reports unknown resources instead of dropping them silently', () => {
    const { unmapped } = legacyToSectionMap(['mystery:read']);
    expect(unmapped).toEqual(['mystery:read']);
  });
});
