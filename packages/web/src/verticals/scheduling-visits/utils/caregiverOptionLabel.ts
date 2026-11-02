export interface CaregiverOption {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  status?: string;
}

export function formatCaregiverOptionLabel(cg: CaregiverOption): string {
  const firstName = (cg.firstName ?? cg.first_name ?? '').trim();
  const lastName = (cg.lastName ?? cg.last_name ?? '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || (cg.name ?? '').trim();

  if (fullName) {
    return cg.status ? `${fullName} (${cg.status})` : fullName;
  }

  // Fallback to ID or status if name is completely missing
  if (cg.status) {
    return `Caregiver (${cg.status})`;
  }
  return cg.id ? `Caregiver ${cg.id.slice(0, 8)}` : 'Caregiver';
}
