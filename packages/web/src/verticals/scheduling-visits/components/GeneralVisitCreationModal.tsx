/**
 * General Visit Creation Modal
 * 
 * Allows creation of any visit type (Regular, Initial, Assessment, Respite, Supervision, etc.)
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../Button.js';
import { VisitTypeSelector } from '@/verticals/scheduling-visits/components/VisitTypeSelector.js';
import type { VisitType } from '@/verticals/scheduling-visits/types/index.js';

interface GeneralVisitCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateVisit: (visitType: VisitType, clientId: string, date: string) => Promise<void>;
  selectedDate: string;
  clients: Array<{ id: string; firstName: string; lastName: string }>;
  isLoading?: boolean;
}

export function GeneralVisitCreationModal({
  isOpen,
  onClose,
  onCreateVisit,
  selectedDate,
  clients,
  isLoading = false,
}: GeneralVisitCreationModalProps): React.ReactElement | null {
  const [selectedVisitType, setSelectedVisitType] = useState<VisitType | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedVisitType || !selectedClientId) return;

    try {
      await onCreateVisit(selectedVisitType, selectedClientId, selectedDate);
      onClose();
      // Reset state
      setSelectedVisitType(null);
      setSelectedClientId('');
    } catch (error) {
      console.error('Error creating visit:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Visit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Date Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Date
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>

          {/* Client Selection */}
          <div>
            <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-2">
              Client <span className="text-red-600">*</span>
            </label>
            <select
              id="client"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Visit Type Selection */}
          <div>
            <VisitTypeSelector
              value={selectedVisitType}
              onChange={setSelectedVisitType}
              disabled={isLoading}
              showDescription={true}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || !selectedVisitType || !selectedClientId}
          >
            {isLoading ? 'Creating Visit...' : 'Create Visit'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GeneralVisitCreationModal;
