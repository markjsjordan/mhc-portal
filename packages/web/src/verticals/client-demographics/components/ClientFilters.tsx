import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Calendar, Check, RotateCcw, Search } from 'lucide-react';
import type { ClientSearchFilters, ClientStatus } from '../types';

export interface ClientFiltersProps {
  filters: ClientSearchFilters;
  onFiltersChange: (filters: ClientSearchFilters) => void;
  activeCount?: number;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'PENDING_INTAKE', label: 'Pending Intake' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DISCHARGED', label: 'Discharged' },
];

const SERVICE_LEVEL_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'INTENSIVE', label: 'Intensive' },
];

const INSURANCE_TYPE_OPTIONS = [
  { value: 'MEDICAID', label: 'Medicaid' },
  { value: 'MEDICARE', label: 'Medicare' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

export const ClientFilters: React.FC<ClientFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queryInput, setQueryInput] = useState(filters.query || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filters.query !== queryInput) {
      setQueryInput(filters.query || '');
    }
  }, [filters.query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.query || '') !== queryInput) {
        onFiltersChange({ ...filters, query: queryInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

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

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.serviceLevel?.length) count++;
    if (filters.insuranceType?.length) count++;
    if (filters.createdDateFrom) count++;
    if (filters.createdDateTo) count++;
    return count;
  }, [filters]);

  const toggleStatus = (status: ClientStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onFiltersChange({
      ...filters,
      status: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleServiceLevel = (level: string) => {
    const current = filters.serviceLevel || [];
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    onFiltersChange({
      ...filters,
      serviceLevel: updated.length > 0 ? updated : undefined,
    });
  };

  const toggleInsuranceType = (type: string) => {
    const current = filters.insuranceType || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFiltersChange({
      ...filters,
      insuranceType: updated.length > 0 ? updated : undefined,
    });
  };

  const handleDateChange = (field: 'createdDateFrom' | 'createdDateTo', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const handleClearAll = () => {
    setQueryInput('');
    onFiltersChange({
      query: undefined,
      status: undefined,
      serviceLevel: undefined,
      insuranceType: undefined,
      createdDateFrom: undefined,
      createdDateTo: undefined,
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
    <div className="space-y-4">
      <div className="relative flex-1 max-w-lg">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or client number..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          className="w-full pl-10 pr-9 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        />
        {queryInput && (
          <button
            type="button"
            onClick={() => setQueryInput('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
            isOpen || activeCount > 0
              ? 'border-blue-500 bg-blue-50/50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
          aria-expanded={isOpen}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full min-w-5 h-5">
              {activeCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 p-5 z-30">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900 text-sm">Filter Clients</h3>
                {activeCount > 0 && (
                  <span className="text-xs text-gray-500">({activeCount} active)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Client Status
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATUS_OPTIONS.map((item) => {
                    const isChecked = filters.status?.includes(item.value) ?? false;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleStatus(item.value)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left border transition-all ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Service Level
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SERVICE_LEVEL_OPTIONS.map((item) => {
                    const isChecked = filters.serviceLevel?.includes(item.value) ?? false;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleServiceLevel(item.value)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left border transition-all ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Insurance Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {INSURANCE_TYPE_OPTIONS.map((item) => {
                    const isChecked = filters.insuranceType?.includes(item.value) ?? false;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleInsuranceType(item.value)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-left border transition-all ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Created Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-1">From</span>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        value={formatDateValue(filters.createdDateFrom)}
                        onChange={(e) => handleDateChange('createdDateFrom', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block mb-1">To</span>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        value={formatDateValue(filters.createdDateTo)}
                        onChange={(e) => handleDateChange('createdDateTo', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {activeCount === 0 ? 'No filters applied' : `${activeCount} filter${activeCount > 1 ? 's' : ''} applied`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
