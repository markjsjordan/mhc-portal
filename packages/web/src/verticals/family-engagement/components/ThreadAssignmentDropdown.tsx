/**
 * Thread Assignment Dropdown
 *
 * Allows staff/coordinators to assign an open conversation thread to a specific
 * staff member or unassign it, and displays the assigned staff member's name.
 */

import React from 'react';
import { useOrganizationStaff } from '../hooks/index.js';
import { NativeSelect } from '@/components/ui/select.js';
import type { UUID } from '@folkcare/core/browser';

export interface ThreadAssignmentDropdownProps {
  readonly assignedToUserId?: UUID | null;
  readonly organizationId?: UUID | null;
  readonly onAssignmentChange: (userId: UUID | null) => void;
  readonly disabled?: boolean;
}

export const ThreadAssignmentDropdown: React.FC<ThreadAssignmentDropdownProps> = ({
  assignedToUserId,
  organizationId,
  onAssignmentChange,
  disabled = false,
}) => {
  const { data: staffMembers, isLoading } = useOrganizationStaff(organizationId ?? null);

  const activeStaff = React.useMemo(() => {
    const list = staffMembers ?? [];
    // Filter to active staff roles (exclude family/client roles if any appear)
    return list.filter(
      (member) =>
        member.status !== 'INACTIVE' &&
        !member.roles.every((role) => role === 'FAMILY' || role === 'CLIENT')
    );
  }, [staffMembers]);

  const assignedMember = React.useMemo(
    () => (assignedToUserId ? activeStaff.find((m) => m.id === assignedToUserId) : undefined),
    [activeStaff, assignedToUserId]
  );

  const assignedDisplayName = assignedMember
    ? `${assignedMember.firstName} ${assignedMember.lastName}`.trim()
    : undefined;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="thread-assignment-select" className="text-xs text-gray-500 whitespace-nowrap">
        {assignedToUserId
          ? assignedDisplayName
            ? `Assigned to ${assignedDisplayName}`
            : 'Assigned'
          : 'Unassigned'}
      </label>
      <NativeSelect
        id="thread-assignment-select"
        aria-label="Assign conversation"
        value={assignedToUserId ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onAssignmentChange(val ? (val as UUID) : null);
        }}
        disabled={disabled || isLoading}
        className="h-8 w-auto min-w-[160px] py-1 px-2 text-xs"
      >
        <option value="">Unassigned</option>
        {activeStaff.map((member) => {
          const fullName = `${member.firstName} ${member.lastName}`.trim();
          return (
            <option key={member.id} value={member.id}>
              {fullName}
            </option>
          );
        })}
        {assignedToUserId && !assignedMember && !isLoading && (
          <option value={assignedToUserId}>Assigned Staff ({assignedToUserId.slice(0, 8)})</option>
        )}
      </NativeSelect>
    </div>
  );
};
