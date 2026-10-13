import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';

export interface FilterDropdownProps {
  title: string;
  children: React.ReactNode;
  activeCount: number;
  onClearAll: () => void;
  width?: 'sm' | 'md' | 'lg';
}

const widthClasses = {
  sm: 'w-72',
  md: 'w-80 sm:w-96',
  lg: 'w-96',
};

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  title,
  children,
  activeCount,
  onClearAll,
  width = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
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
        <div
          className={`absolute right-0 mt-2 ${widthClasses[width]} bg-white rounded-xl shadow-xl border border-gray-200 p-5 z-30`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
              {activeCount > 0 && (
                <span className="text-xs text-gray-500">({activeCount} active)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  aria-label="Clear all filters"
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
            {children}
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
  );
};
