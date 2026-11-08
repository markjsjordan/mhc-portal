import React from 'react';
import { Search, UserCheck, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';

interface CaregiverOption {
  id: string;
  name: string;
}

interface PatternFiltersProps {
  statusTab: 'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  onStatusTabChange: (tab: 'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED') => void;
  search: string;
  onSearchChange: (search: string) => void;
  caregiverId?: string;
  onCaregiverChange: (caregiverId?: string) => void;
  unassignedOnly: boolean;
  onUnassignedToggle: (unassigned: boolean) => void;
  caregivers?: CaregiverOption[];
}

export const PatternFilters: React.FC<PatternFiltersProps> = ({
  statusTab,
  onStatusTabChange,
  search,
  onSearchChange,
  caregiverId,
  onCaregiverChange,
  unassignedOnly,
  onUnassignedToggle,
  caregivers = [],
}) => {
  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex border-b border-border gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onStatusTabChange('ALL')}
          className={`rounded-b-none h-auto pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'ALL'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active & Paused
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onStatusTabChange('ACTIVE')}
          className={`rounded-b-none h-auto pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'ACTIVE'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Active
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onStatusTabChange('PAUSED')}
          className={`rounded-b-none h-auto pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'PAUSED'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Paused
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onStatusTabChange('CANCELLED')}
          className={`rounded-b-none h-auto pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
            statusTab === 'CANCELLED'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Ended
        </Button>
      </div>

      {/* Filter controls row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* Search by client name */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search by client name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
            aria-label="Search patterns by client name"
          />
        </div>

        {/* Caregiver filter */}
        <div className="w-full sm:w-[200px]">
          <Select
            value={caregiverId ?? 'ALL'}
            onValueChange={(val) => onCaregiverChange(val === 'ALL' ? undefined : val)}
            disabled={unassignedOnly}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All caregivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Caregivers</SelectItem>
              {caregivers.map((cg) => (
                <SelectItem key={cg.id} value={cg.id}>
                  {cg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unassigned toggle */}
        <Button
          type="button"
          variant={unassignedOnly ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onUnassignedToggle(!unassignedOnly)}
          className="h-9 gap-1.5"
          aria-pressed={unassignedOnly}
        >
          {unassignedOnly ? <UserX className="h-4 w-4 text-amber-600" /> : <UserCheck className="h-4 w-4 text-muted-foreground" />}
          <span>Unassigned</span>
        </Button>
      </div>
    </div>
  );
};
