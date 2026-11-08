import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button.js';
import { NativeSelect } from '@/components/ui/select.js';
import { useApiClient } from '@/core/hooks';
import { useAuthStore } from '@/core/hooks/auth';
import { SECTIONS } from '@/core/types/sections';
import type { Section } from '@/core/types/sections';

export type SectionAccessLevel = 'READ' | 'WRITE' | 'NONE';
export type SectionAccessMap = Record<Section, { read: boolean; write: boolean }>;

export interface SectionOverride {
  section: Section;
  access: SectionAccessLevel | null;
}

export interface SectionAccessResponse {
  roleDefaults: SectionAccessMap;
  overrides: SectionOverride[];
  effective: SectionAccessMap;
}

const EDITOR_ROLES = new Set(['SUPER_ADMIN', 'ORG_ADMIN']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Accepts either a bare payload or an `{ data }` envelope. */
function unwrap(res: unknown): SectionAccessResponse {
  const body = isRecord(res) && isRecord(res.data) && 'effective' in res.data ? res.data : res;
  const rec = isRecord(body) ? body : {};
  return {
    roleDefaults: (rec.roleDefaults ?? {}) as SectionAccessMap,
    overrides: Array.isArray(rec.overrides) ? (rec.overrides as SectionOverride[]) : [],
    effective: (rec.effective ?? {}) as SectionAccessMap,
  };
}

const sectionOverridesKey = (orgId: string, userId: string) =>
  ['sectionAccess', orgId, userId] as const;

function useSectionOverridesImpl(orgId: string, userId: string, enabled = true) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const path = `/api/organizations/${orgId}/users/${userId}/section-access`;

  const query = useQuery({
    queryKey: sectionOverridesKey(orgId, userId),
    queryFn: async () => unwrap(await apiClient.get<unknown>(path)),
    enabled: enabled && Boolean(orgId && userId),
  });

  const mutation = useMutation({
    mutationFn: async (overrides: SectionOverride[]) =>
      unwrap(await apiClient.put<unknown>(path, { overrides })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sectionOverridesKey(orgId, userId) });
    },
  });

  return { query, mutation };
}

const describeAccess = (a?: { read: boolean; write: boolean }): string => {
  if (!a) return '—';
  if (a.write) return 'WRITE';
  if (a.read) return 'READ';
  return 'NONE';
};

export interface SectionAccessEditorProps {
  /** Defaults to the signed-in admin's organization. */
  readonly orgId?: string;
  readonly userId: string;
}

interface ProfileShape {
  id?: string;
  organizationId?: string;
  roles?: string[];
}

const useSectionAccessEditorView: React.FC<SectionAccessEditorProps> = ({ orgId, userId }) => {
  const apiClient = useApiClient();
  const authUser = useAuthStore((s) => s.user);
  const { data: profileUser } = useQuery<ProfileShape>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const res = await apiClient.get<ProfileShape | { data?: ProfileShape }>('/api/users/profile');
      if (isRecord(res) && 'id' in res) return res as ProfileShape;
      if (isRecord(res) && isRecord(res.data)) return res.data as ProfileShape;
      return {};
    },
    enabled: !authUser,
  });

  const actor = authUser ?? profileUser;
  const canEdit = Boolean(actor?.roles?.some((r) => EDITOR_ROLES.has(r)));
  const resolvedOrgId = orgId ?? actor?.organizationId ?? '';

  const { query, mutation } = useSectionOverridesImpl(resolvedOrgId, userId, canEdit);
  const [draft, setDraft] = useState<Partial<Record<Section, string>>>({});

  if (!canEdit) return null;

  if (query.isLoading) return <p className="text-sm text-gray-500">Loading section access…</p>;
  if (query.isError || !query.data) {
    return <p className="text-sm text-red-600">Unable to load section access.</p>;
  }

  const { roleDefaults, overrides, effective } = query.data;
  const saved = (s: Section): string => overrides.find((o) => o.section === s)?.access ?? '';
  const current = (s: Section): string => draft[s] ?? saved(s);
  const dirty = SECTIONS.filter((s) => current(s) !== saved(s));

  const save = () => {
    const payload: SectionOverride[] = dirty.map((section) => {
      const v = current(section);
      return { section, access: v === '' ? null : (v as SectionAccessLevel) };
    });
    mutation.mutate(payload, { onSuccess: () => setDraft({}) });
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-4" data-testid="section-access-editor">
      <h4 className="text-sm font-medium text-gray-900">Section access overrides</h4>
      <p className="text-xs text-gray-500 mb-2">
        Overrides can only restrict access below the role default; they never grant more.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="py-1">Section</th>
            <th>Role default</th>
            <th>Override</th>
            <th>Effective</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((section) => (
            <tr key={section}>
              <td className="py-1">{section}</td>
              <td>{describeAccess(roleDefaults[section])}</td>
              <td>
                <NativeSelect
                  aria-label={`Override for ${section}`}
                  value={current(section)}
                  onChange={(e) => setDraft((d) => ({ ...d, [section]: e.target.value }))}
                  className="h-8 py-0"
                >
                  <option value="">Default</option>
                  <option value="NONE">NONE</option>
                  <option value="READ">READ</option>
                  <option value="WRITE">WRITE</option>
                </NativeSelect>
              </td>
              <td>{describeAccess(effective[section])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mutation.isError && (
        <p className="mt-2 text-sm text-red-600">Failed to save section access.</p>
      )}
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" disabled={dirty.length === 0 || mutation.isPending} onClick={save}>
          {mutation.isPending ? 'Saving...' : 'Save section access'}
        </Button>
      </div>
    </div>
  );
};

export const {
  useSectionOverrides,
  SectionAccessEditor,
} = {
  useSectionOverrides: (orgId: string, userId: string) => useSectionOverridesImpl(orgId, userId, true),
  SectionAccessEditor: useSectionAccessEditorView,
};
