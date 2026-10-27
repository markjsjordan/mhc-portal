import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

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

  // Close on ESC key. Listen on window so Escape is caught regardless of
  // which element dispatched it (keyboard events bubble to window).
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={
          isOpen || activeCount > 0
            ? 'border-primary bg-primary/10 text-primary'
            : ''
        }
        aria-expanded={isOpen}
      >
        <Filter className="w-4 h-4 mr-2" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded-full min-w-5 h-5">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 ${widthClasses[width]} bg-card text-card-foreground rounded-xl shadow-xl border border-border p-5 z-30`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">{title}</h3>
              {activeCount > 0 && (
                <span className="text-xs text-muted-foreground">({activeCount} active)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  className="text-xs h-auto p-0 text-primary hover:text-primary/80 hover:bg-transparent flex items-center gap-1"
                  aria-label="Clear all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear All
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close filters"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
            {children}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {activeCount === 0 ? 'No filters applied' : `${activeCount} filter${activeCount > 1 ? 's' : ''} applied`}
            </span>
            <Button
              type="button"
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
