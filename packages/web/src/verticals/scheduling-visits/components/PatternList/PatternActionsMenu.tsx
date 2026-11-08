import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Play, Pause, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import type { PatternListItem } from '../../services/visit-api.js';

interface PatternActionsMenuProps {
  pattern: PatternListItem;
  canEdit: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export const PatternActionsMenu: React.FC<PatternActionsMenuProps> = ({
  pattern,
  canEdit,
  onPause,
  onResume,
  onEnd,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  if (!canEdit) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Actions for ${pattern.clientName}`}
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-card text-card-foreground border border-border z-30 py-1"
        >
          {pattern.status === 'ACTIVE' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onPause();
              }}
              className="w-full justify-start rounded-none px-3 py-2 text-sm text-amber-700 hover:bg-muted flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              <span>Pause Pattern</span>
            </Button>
          )}

          {pattern.status === 'PAUSED' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onResume();
              }}
              className="w-full justify-start rounded-none px-3 py-2 text-sm text-emerald-700 hover:bg-muted flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              <span>Resume Pattern</span>
            </Button>
          )}

          {pattern.status !== 'CANCELLED' && (
            <>
              <div className="border-t border-border my-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onEnd();
                }}
                className="w-full justify-start rounded-none px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              >
                <Ban className="h-4 w-4" />
                <span>End Pattern...</span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
