/**
 * Caregiver Assignments API Client (E2 / wdvf3adf61)
 */

export type AssignmentStatus =
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AssignmentRecord {
  id: string;
  organizationId: string;
  caregiverId: string;
  visitId: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: string;
  updatedBy: string | null;
  updatedAt: string;
  notes: string | null;
  conflictWarning: boolean;
  visit?: {
    scheduledStart: string;
    scheduledEnd: string;
    visitType?: string;
    clientId?: string;
    status?: string;
  };
  caregiver?: {
    firstName?: string;
    lastName?: string;
  };
}

export interface RosterGroup {
  caregiverId: string;
  caregiverName: string;
  assignments: AssignmentRecord[];
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('token') ?? window.localStorage.getItem('auth_token')
      : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const body = (await res.json()) as { success?: boolean; data?: T; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return body.data as T;
}

export async function listAssignments(params?: {
  caregiverId?: string;
  visitId?: string;
  status?: AssignmentStatus;
}): Promise<AssignmentRecord[]> {
  const qs = new URLSearchParams();
  if (params?.caregiverId) qs.set('caregiverId', params.caregiverId);
  if (params?.visitId) qs.set('visitId', params.visitId);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const data = await requestJson<AssignmentRecord[]>(`/api/assignments${query}`);
  return data ?? [];
}

export async function getAssignmentRoster(): Promise<RosterGroup[]> {
  const data = await requestJson<RosterGroup[]>('/api/assignments/roster');
  return data ?? [];
}

export async function createAssignment(payload: {
  caregiverId: string;
  visitId: string;
  notes?: string;
  allowConflictOverride?: boolean;
}): Promise<AssignmentRecord> {
  return requestJson<AssignmentRecord>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function bulkAssignCaregivers(payload: {
  assignments: Array<{ caregiverId: string; visitId: string; notes?: string }>;
  allowConflictOverride?: boolean;
}): Promise<{
  assigned: AssignmentRecord[];
  failed: Array<{ caregiverId: string; visitId: string; error: string }>;
}> {
  return requestJson('/api/assignments/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
  notes?: string
): Promise<AssignmentRecord> {
  return requestJson<AssignmentRecord>(`/api/assignments/${assignmentId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes }),
  });
}
