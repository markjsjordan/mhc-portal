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
import { Button } from '@/core/components';
import { useAuth } from '@/core/hooks';
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

    if (!isOpen) return undefined;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => onOpenChange(!isOpen)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-5 w-5 text-gray-600" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          role="menu"
        >
          {canDuplicate && (
            <button
              onClick={() => {
                onDuplicate();
                onOpenChange(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg transition-colors"
              role="menuitem"
            >
              <Copy className="h-4 w-4" />
              <span className="text-sm">Duplicate Caregiver</span>
            </button>
          )}
          {onViewHistory && (
            <button
              onClick={() => {
                onViewHistory();
                onOpenChange(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              role="menuitem"
            >
              <History className="h-4 w-4" />
              <span className="text-sm">View Audit History</span>
            </button>
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
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Permission checks
  const canEdit = user?.permissions?.includes('CAREGIVER_WRITE') ?? false;
  const canDelete = user?.permissions?.includes('CAREGIVER_DELETE') ?? false;
  const canDuplicate = user?.permissions?.includes('CAREGIVER_CREATE') ?? false;
  const canViewHistory = user?.permissions?.includes('AUDIT_READ') ?? false;

  // Status-based rules
  const isDeletable = caregiver.status !== 'TERMINATED' && caregiver.status !== 'RETIRED';

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onEdit}
        disabled={!canEdit || isLoading}
        variant="primary"
        size="sm"
        leftIcon={<Edit2 className="h-4 w-4" />}
        aria-label="Edit caregiver"
      >
        Edit
      </Button>

      <Button
        onClick={onDelete}
        disabled={!canDelete || !isDeletable || isLoading}
        variant="danger"
        size="sm"
        leftIcon={<Trash2 className="h-4 w-4" />}
        aria-label="Delete caregiver"
        title={
          !isDeletable
            ? `Cannot delete ${caregiver.status} caregiver`
            : !canDelete
              ? 'Insufficient permissions'
              : undefined
        }
      >
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
