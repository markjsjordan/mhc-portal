import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions, useSectionAccess } from '../permissions';
import { useAuthStore } from '../auth';
import type { User } from '../../types/auth';
import { SECTIONS } from '../../types/sections';
import type { Section } from '../../types/sections';

const buildSections = (
  overrides: Partial<Record<Section, { read: boolean; write: boolean }>>
): NonNullable<User['sections']> => {
  const base = {} as NonNullable<User['sections']>;
  for (const s of SECTIONS) {
    base[s] = overrides[s] ?? { read: true, write: true };
  }
  return base;
};

const makeUser = (sections?: User['sections']): User => ({
  id: 'user-1',
  email: 'u@example.com',
  name: 'U',
  roles: ['COORDINATOR'],
  permissions: ['clients:read'],
  organizationId: 'org-1',
  sections,
});

describe('section access hooks', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    localStorage.removeItem('auth-storage');
  });

  it('allows everything when sections is undefined', () => {
    useAuthStore.getState().setAuth(makeUser(undefined), 't');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canSection('billing', 'READ')).toBe(true);
    expect(result.current.canSection('billing', 'WRITE')).toBe(true);
    const access = renderHook(() => useSectionAccess('billing')).result.current;
    expect(access).toEqual({ canRead: true, canWrite: true, readOnly: false });
  });

  it('NONE blocks read and write', () => {
    useAuthStore
      .getState()
      .setAuth(makeUser(buildSections({ billing: { read: false, write: false } })), 't');
    const { result } = renderHook(() => useSectionAccess('billing'));
    expect(result.current).toEqual({ canRead: false, canWrite: false, readOnly: false });
  });

  it('READ allows read only and reports readOnly', () => {
    useAuthStore
      .getState()
      .setAuth(makeUser(buildSections({ clients: { read: true, write: false } })), 't');
    const { result } = renderHook(() => useSectionAccess('clients'));
    expect(result.current).toEqual({ canRead: true, canWrite: false, readOnly: true });
    const perms = renderHook(() => usePermissions()).result.current;
    expect(perms.canSection('clients', 'WRITE')).toBe(false);
    expect(perms.canSection('tasks', 'WRITE')).toBe(true);
  });

  it('WRITE allows read and write', () => {
    useAuthStore.getState().setAuth(makeUser(buildSections({})), 't');
    const { result } = renderHook(() => useSectionAccess('clients'));
    expect(result.current).toEqual({ canRead: true, canWrite: true, readOnly: false });
  });

  it('denies when unauthenticated sections are present but section missing', () => {
    const partial = { clients: { read: true, write: true } } as User['sections'];
    useAuthStore.getState().setAuth(makeUser(partial), 't');
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canSection('billing', 'READ')).toBe(false);
  });
});
