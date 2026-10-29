import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';

export interface FilterOption {
  id: string;
  name: string;
  color?: string;
  visitCount?: number;
}

export interface CalendarFilterBarProps {
  allCaregivers: FilterOption[];
  allClients: FilterOption[];
  selectedCaregivers: string[];
  onCaregiversChange: (ids: string[]) => void;
  selectedClients: string[];
  onClientsChange: (ids: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  onClearAll: () => void;
}

import { STATUS_OPTIONS } from './filter-constants.js';

export const CalendarFilterBar: React.FC<CalendarFilterBarProps> = ({
  allCaregivers,
  allClients,
  selectedCaregivers,
  onCaregiversChange,
  selectedClients,
  onClientsChange,
  selectedStatuses,
  onStatusesChange,
  onClearAll,
}) => {
  const [caregiverSearch, setCaregiverSearch] = useState('');
  const [caregiverDropdownOpen, setCaregiverDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  const caregiverRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (caregiverRef.current && !caregiverRef.current.contains(e.target as Node)) {
        setCaregiverDropdownOpen(false);
      }
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  const hasActiveFilters =
    selectedCaregivers.length > 0 ||
    selectedClients.length > 0 ||
    selectedStatuses.length > 0;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm p-3.5 mb-4 space-y-3">
      {/* Top row: Comboboxes and Status Toggles */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Caregiver Combobox */}
        <div className="flex-1 min-w-[220px] max-w-[280px]" ref={caregiverRef}>
          <Label htmlFor="calendar-filter-caregiver-search" className="block text-xs font-semibold text-foreground mb-1">
            Caregiver
          </Label>
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Input
                id="calendar-filter-caregiver-search"
                type="text"
                placeholder="Search/select"
                value={caregiverSearch}
                onChange={(e) => {
                  setCaregiverSearch(e.target.value);
                  setCaregiverDropdownOpen(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCaregiverDropdownOpen(true);
                }}
                className="w-full pl-8 pr-7 text-sm h-9"
              />
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {caregiverDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1">
                {filteredCaregivers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No caregivers found
                  </div>
                ) : (
                  filteredCaregivers.map((cg) => {
                    const isSelected = selectedCaregivers.includes(cg.id);
                    return (
                      <div
                        key={cg.id}
                        onClick={() => toggleCaregiver(cg.id)}
                        className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cg.color ?? '#3B82F6' }}
                          />
                          <span className="truncate font-medium">
                            {cg.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {cg.visitCount !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {cg.visitCount} visits
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Patient (Client) Combobox */}
        <div className="flex-1 min-w-[220px] max-w-[280px]" ref={clientRef}>
          <Label htmlFor="calendar-filter-client-search" className="block text-xs font-semibold text-foreground mb-1">
            Patient (Client)
          </Label>
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <Input
                id="calendar-filter-client-search"
                type="text"
                placeholder="Search/select"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientDropdownOpen(true);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setClientDropdownOpen(true);
                }}
                className="w-full pl-8 pr-7 text-sm h-9"
              />
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {clientDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 z-30 max-h-60 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map((cl) => {
                    const isSelected = selectedClients.includes(cl.id);
                    return (
                      <div
                        key={cl.id}
                        onClick={() => toggleClient(cl.id)}
                        className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      >
                        <span className="truncate font-medium">
                          {cl.name}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {cl.visitCount !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {cl.visitCount} visits
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Toggles */}
        <div className="flex-1 min-w-[320px]">
          <Label className="block text-xs font-semibold text-foreground mb-1">
            Status
          </Label>
          <div className="flex flex-wrap items-center gap-2">
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

      {/* Bottom row: Active Filter Chips & Clear All */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
          {/* Caregiver chips */}
          {selectedCaregivers.map((cgId) => {
            const caregiver = allCaregivers.find((c) => c.id === cgId);
            return (
              <span
                key={cgId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: caregiver?.color ?? '#3B82F6' }}
                />
                <span>{caregiver?.name ?? cgId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => toggleCaregiver(cgId)}
                  className="ml-1 h-4 w-4 p-0 hover:bg-transparent text-primary hover:text-primary"
                  aria-label={`Remove ${caregiver?.name ?? cgId} filter`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </span>
            );
          })}

          {/* Client chips */}
          {selectedClients.map((clId) => {
            const client = allClients.find((c) => c.id === clId);
            return (
              <span
                key={clId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border"
              >
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>{client?.name ?? clId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => toggleClient(clId)}
                  className="ml-1 h-4 w-4 p-0 hover:bg-transparent"
                  aria-label={`Remove ${client?.name ?? clId} filter`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </span>
            );
          })}

          {/* Clear all button */}
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClearAll}
            className="rounded-full ml-auto"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
