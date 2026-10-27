import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Calendar, Check, RotateCcw } from 'lucide-react';
import type { VisitSearchFilters, VisitStatus, VisitType } from '../types/index.js';
import { VISIT_TYPES } from '../config/visitTypeConfig.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Badge } from '@/components/ui/badge.js';

export interface VisitFiltersProps {
  filters: VisitSearchFilters;
  onFiltersChange: (filters: VisitSearchFilters) => void;
  activeCount: number;
}

const ALL_STATUSES: { value: VisitStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const VisitFilters: React.FC<VisitFiltersProps> = ({
  filters,
  onFiltersChange,
  activeCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleStatus = (status: VisitStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleVisitType = (type: VisitType) => {
    const current = filters.visitType || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({
      ...filters,
      visitType: updated.length > 0 ? updated : undefined,
    });
  };

  const handleDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const handleClearAll = () => {
    onFiltersChange({
      query: filters.query,
      status: undefined,
      visitType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const formatDateValue = (val?: Date | string) => {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toISOString().split('T')[0]!;
    }
    return String(val).split('T')[0]!;
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant={isOpen || activeCount > 0 ? 'secondary' : 'outline'}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="gap-2"
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <Badge variant="default" className="px-1.5 py-0 text-xs rounded-full min-w-5 h-5 flex items-center justify-center">
            {activeCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card text-card-foreground rounded-xl shadow-xl border border-border p-5 z-30">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Filter Visits</h3>
              {activeCount > 0 && (
                <span className="text-xs text-muted-foreground">({activeCount} active)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleClearAll}
                  className="text-primary hover:text-primary gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear All
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsOpen(false)}
                aria-label="Close filters"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
            {/* Status Section */}
            <div>
              <Label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Visit Status
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_STATUSES.map((item) => {
                  const isChecked = filters.status?.includes(item.value) ?? false;
                  return (
                    <Button
                      key={item.value}
                      type="button"
                      variant={isChecked ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => toggleStatus(item.value)}
                      className="justify-start gap-2 h-auto py-1.5 px-2.5 font-medium text-xs"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                          isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className="truncate">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Visit Type Section */}
            <div>
              <Label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Visit Type
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(VISIT_TYPES) as VisitType[]).map((typeKey) => {
                  const config = VISIT_TYPES[typeKey];
                  const Icon = config.icon;
                  const isChecked = filters.visitType?.includes(typeKey) ?? false;
                  return (
                    <Button
                      key={typeKey}
                      type="button"
                      variant={isChecked ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => toggleVisitType(typeKey)}
                      className="justify-start gap-2 h-auto py-1.5 px-2 font-medium text-xs"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 ${
                          isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${config.colorClass}`} />
                      <span className="truncate">{config.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Date Range Section */}
            <div>
              <Label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Date Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="visit-filters-date-from" className="text-[11px] text-muted-foreground block mb-1">
                    From
                  </Label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <Input
                      id="visit-filters-date-from"
                      type="date"
                      value={formatDateValue(filters.dateFrom)}
                      onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                      className="w-full pl-8 pr-2 py-1 text-xs h-8"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="visit-filters-date-to" className="text-[11px] text-muted-foreground block mb-1">
                    To
                  </Label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                    <Input
                      id="visit-filters-date-to"
                      type="date"
                      value={formatDateValue(filters.dateTo)}
                      onChange={(e) => handleDateChange('dateTo', e.target.value)}
                      className="w-full pl-8 pr-2 py-1 text-xs h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {activeCount === 0 ? 'No filters applied' : `${activeCount} filter${activeCount > 1 ? 's' : ''} applied`}
            </span>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
