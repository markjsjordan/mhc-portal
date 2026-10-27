import React, { useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import type { FilterOption } from './CalendarFilterBar.js';
import { STATUS_OPTIONS } from './CalendarFilterBar.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';

export interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allCaregivers: FilterOption[];
  allClients: FilterOption[];
  selectedCaregivers: string[];
  onCaregiversChange: (ids: string[]) => void;
  selectedClients: string[];
  onClientsChange: (ids: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  onReset: () => void;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  allCaregivers,
  allClients,
  selectedCaregivers,
  onCaregiversChange,
  selectedClients,
  onClientsChange,
  selectedStatuses,
  onStatusesChange,
  onReset,
}) => {
  const [caregiverSearch, setCaregiverSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  if (!isOpen) return null;

  const filteredCaregivers = allCaregivers.filter((cg) =>
    cg.name.toLowerCase().includes(caregiverSearch.toLowerCase())
  );

  const filteredClients = allClients.filter((cl) =>
    cl.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const toggleCaregiver = (id: string) => {
    if (selectedCaregivers.includes(id)) {
      onCaregiversChange(selectedCaregivers.filter((item) => item !== id));
    } else {
      onCaregiversChange([...selectedCaregivers, id]);
    }
  };

  const toggleClient = (id: string) => {
    if (selectedClients.includes(id)) {
      onClientsChange(selectedClients.filter((item) => item !== id));
    } else {
      onClientsChange([...selectedClients, id]);
    }
  };

  const toggleStatus = (statusId: string) => {
    if (selectedStatuses.includes(statusId)) {
      onStatusesChange(selectedStatuses.filter((s) => s !== statusId));
    } else {
      onStatusesChange([...selectedStatuses, statusId]);
    }
  };

  const activeCount =
    selectedCaregivers.length + selectedClients.length + selectedStatuses.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-card text-card-foreground rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden border-t border-x border-border animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            Filters ({activeCount})
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="font-semibold text-primary hover:text-primary"
          >
            [Close]
          </Button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Caregiver Section */}
          <div>
            <Label htmlFor="mobile-filter-caregiver-search" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Caregiver
            </Label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Input
                id="mobile-filter-caregiver-search"
                type="text"
                placeholder="Search"
                value={caregiverSearch}
                onChange={(e) => setCaregiverSearch(e.target.value)}
                className="w-full pl-8 text-sm"
              />
            </div>

            {/* Selected chips */}
            {selectedCaregivers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCaregivers.map((id) => {
                  const cg = allCaregivers.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cg?.color || '#3B82F6' }}
                      />
                      <span>{cg?.name || id}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggleCaregiver(id)}
                        className="ml-1 h-3.5 w-3.5 p-0 hover:bg-transparent text-primary hover:text-primary"
                        aria-label={`Remove ${cg?.name || id} filter`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Caregiver search list */}
            {caregiverSearch.trim().length > 0 && (
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-1 space-y-0.5">
                {filteredCaregivers.slice(0, 10).map((cg) => {
                  const isSelected = selectedCaregivers.includes(cg.id);
                  return (
                    <div
                      key={cg.id}
                      onClick={() => toggleCaregiver(cg.id)}
                      className="flex items-center justify-between p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    >
                      <span>{cg.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient (Client) Section */}
          <div>
            <Label htmlFor="mobile-filter-client-search" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Patient (Client)
            </Label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Input
                id="mobile-filter-client-search"
                type="text"
                placeholder="Search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-8 text-sm"
              />
            </div>

            {/* Selected chips */}
            {selectedClients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedClients.map((id) => {
                  const cl = allClients.find((c) => c.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span>{cl?.name || id}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggleClient(id)}
                        className="ml-1 h-3.5 w-3.5 p-0 hover:bg-transparent"
                        aria-label={`Remove ${cl?.name || id} filter`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Client search list */}
            {clientSearch.trim().length > 0 && (
              <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-1 space-y-0.5">
                {filteredClients.slice(0, 10).map((cl) => {
                  const isSelected = selectedClients.includes(cl.id);
                  return (
                    <div
                      key={cl.id}
                      onClick={() => toggleClient(cl.id)}
                      className="flex items-center justify-between p-2 rounded text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer"
                    >
                      <span>{cl.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Section */}
          <div>
            <Label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Status
            </Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const isActive = selectedStatuses.includes(status.id);
                return (
                  <Button
                    key={status.id}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="xs"
                    onClick={() => toggleStatus(status.id)}
                    className="rounded-full gap-1.5"
                    aria-pressed={isActive}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-primary-foreground' : status.dotColor
                      }`}
                    />
                    <span>{status.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-card">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={onClose}
          >
            Apply Filters ({activeCount})
          </Button>
        </div>
      </div>
    </div>
  );
};
