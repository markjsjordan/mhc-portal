/**
 * Delete Caregiver Confirmation Dialog
 *
 * Multi-step confirmation dialog for soft deleting caregivers.
 * Requires name confirmation and checkbox confirmation.
 */
import React, { useState } from 'react';
import { Button, Modal, Checkbox } from '@/core/components';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { caregiverApi } from '../api/index.js';
import type { Caregiver } from '../types/index.js';

export interface DeleteCaregiverConfirmationProps {
  isOpen: boolean;
  caregiver: Caregiver;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteCaregiverConfirmation: React.FC<DeleteCaregiverConfirmationProps> = ({
  isOpen,
  caregiver,
  onClose,
  onSuccess,
}) => {
  const [nameConfirmation, setNameConfirmation] = useState('');
  const [understandsConfirm, setUnderstandsConfirm] = useState(false);

  const expectedName = `${caregiver.firstName || ''} ${caregiver.lastName || ''}`.trim();

  const deleteMutation = useMutation({
    mutationFn: () => caregiverApi.deleteCaregiver(caregiver.id, { confirmName: expectedName }),
    onSuccess: () => {
      toast.success('Caregiver deleted successfully');
      setNameConfirmation('');
      setUnderstandsConfirm(false);
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      if (error.response?.data?.error === 'INVALID_STATUS_TRANSITION') {
        toast.error('Cannot delete terminated caregiver');
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete caregiver');
      }
    },
  });

  const isNameConfirmed = nameConfirmation.trim() === expectedName;
  const canDelete = isNameConfirmed && understandsConfirm && !deleteMutation.isPending;

  const handleClose = () => {
    setNameConfirmation('');
    setUnderstandsConfirm(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Caregiver?"
    >
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900">
            You are about to delete: <strong>{expectedName}</strong>
          </p>
          <p className="text-xs text-red-700 mt-1">
            {caregiver.role} {caregiver.primaryBranchId ? '• Branch ID: ' + caregiver.primaryBranchId : ''}
          </p>
        </div>

        {/* Action description */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-gray-900">This action will:</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Soft-delete the record (recoverable)</li>
            <li>Remove from active caregiver list</li>
            <li>Cannot unassign from future visits</li>
            <li>Be logged for audit compliance</li>
          </ul>
        </div>

        {/* Name confirmation */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            To confirm, type the caregiver name:
          </label>
          <input
            type="text"
            value={nameConfirmation}
            onChange={(e) => setNameConfirmation(e.target.value)}
            placeholder={expectedName}
            className={`w-full px-3 py-2 border rounded-lg text-sm ${
              nameConfirmation && !isNameConfirmed
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-offset-0 ${
              isNameConfirmed ? 'focus:ring-green-500' : 'focus:ring-blue-300'
            }`}
            disabled={deleteMutation.isPending}
            autoFocus
          />
          {nameConfirmation && !isNameConfirmed && (
            <p className="text-xs text-red-600 mt-1">Name does not match</p>
          )}
          {isNameConfirmed && (
            <p className="text-xs text-green-600 mt-1">✓ Name confirmed</p>
          )}
        </div>

        {/* Checkbox confirmation */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={understandsConfirm}
            onCheckedChange={(checked) => setUnderstandsConfirm(checked)}
            disabled={deleteMutation.isPending}
          />
          <label
            htmlFor="understand-permanent"
            className="text-sm text-gray-700 cursor-pointer"
          >
            I understand this action is permanent (within the context of data retention)
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => deleteMutation.mutate()}
            variant="danger"
            disabled={!canDelete}
            isLoading={deleteMutation.isPending}
          >
            Delete Caregiver
          </Button>
        </div>
      </div>
    </Modal>
  );
};
