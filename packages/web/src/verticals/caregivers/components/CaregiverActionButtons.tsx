/**
 * Caregiver Action Buttons
 *
 * Primary action buttons for caregiver detail page:
 * - Edit: Opens edit modal
 * - Delete: Opens delete confirmation dialog
 * - More menu: Additional actions (Duplicate, View History, etc.)
 */
import React, { useState } from 'react';
import { Edit2, Trash2, Copy, History, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { usePermissions } from '@/core/hooks/permissions.js';
import type { Caregiver } from '../types/index.js';

export interface CaregiverActionButtonsProps {
  caregiver: Caregiver;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onViewHistory?: () => void;
  isLoading?: boolean;
}

/**
 * Dropdown menu for additional actions
 */
const CaregiverMoreMenu: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: () => void;
  onViewHistory?: () => void;
  canDuplicate: boolean;
}> = ({ isOpen, onOpenChange, onDuplicate, onViewHistory, canDuplicate }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    if (!isOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onOpenChange(!isOpen)}
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          role="menu"
        >
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onDuplicate();
                onOpenChange(false);
              }}
              className="w-full justify-start text-left px-4 py-2 hover:bg-muted flex items-center gap-2 first:rounded-t-lg font-normal"
              role="menuitem"
            >
              <Copy className="h-4 w-4" />
              <span className="text-sm">Duplicate Caregiver</span>
            </Button>
          )}
          {onViewHistory && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onViewHistory();
                onOpenChange(false);
              }}
              className="w-full justify-start text-left px-4 py-2 hover:bg-muted flex items-center gap-2 font-normal"
              role="menuitem"
            >
              <History className="h-4 w-4" />
              <span className="text-sm">View Audit History</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const CaregiverActionButtons: React.FC<CaregiverActionButtonsProps> = ({
  caregiver,
  onEdit,
  onDelete,
  onDuplicate,
  onViewHistory,
  isLoading = false,
}) => {
  const { can } = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);

  // Permission checks
  // Wildcard-aware; strings match what the backend enforces so UI and 403 agree.
  const canEdit = can('caregivers:update');
  const canDelete = can('caregivers:delete');
  const canDuplicate = can('caregivers:create');
  const canViewHistory = can('audit-logs:read');

  // Status-based rules
  const isDeletable = caregiver.status !== 'TERMINATED' && caregiver.status !== 'RETIRED';

  let deleteButtonTitle: string | undefined;
  if (!isDeletable) {
    deleteButtonTitle = `Cannot delete ${caregiver.status} caregiver`;
  } else if (!canDelete) {
    deleteButtonTitle = 'Insufficient permissions';
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onEdit}
        disabled={!canEdit || isLoading}
        variant="default"
        size="sm"
        aria-label="Edit caregiver"
      >
        <Edit2 className="h-4 w-4 mr-1.5" />
        Edit
      </Button>

      <Button
        onClick={onDelete}
        disabled={!canDelete || !isDeletable || isLoading}
        variant="destructive"
        size="sm"
        aria-label="Delete caregiver"
        title={deleteButtonTitle}
      >
        <Trash2 className="h-4 w-4 mr-1.5" />
        Delete
      </Button>

      <CaregiverMoreMenu
        isOpen={moreOpen}
        onOpenChange={setMoreOpen}
        onDuplicate={onDuplicate}
        onViewHistory={canViewHistory ? onViewHistory : undefined}
        canDuplicate={canDuplicate}
      />
    </div>
  );
};
