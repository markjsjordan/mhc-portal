/**
 * Demo Data Banner
 *
 * Shows when viewing sample/demo data.
 *
 * Two modes:
 * - Read-only (isDemo=true): For public demo accounts - no action buttons
 * - Editable (isDemo=false): For real organizations with demo data loaded
 */

import React from 'react';
import { AlertTriangle, Trash2, Plus, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

export interface DemoDataBannerProps {
  /** Whether this is a demo account (read-only mode) */
  isDemo?: boolean;
  onClearDemo?: () => void;
  onAddRealData?: () => void;
  onDismiss?: () => void;
  isClearing?: boolean;
  stats?: {
    clients: number;
    caregivers: number;
    visits: number;
  };
}

export const DemoDataBanner: React.FC<DemoDataBannerProps> = ({
  isDemo = false,
  onClearDemo,
  onAddRealData,
  onDismiss,
  isClearing = false,
  stats,
}) => {
  // Read-only demo banner (for public demo accounts)
  if (isDemo) {
    return (
      <div className="bg-primary/10 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-sm font-medium text-foreground">
                  DEMO MODE
                </span>
                <span className="text-xs text-muted-foreground">
                  Try the platform with sample data • No real PHI
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stats && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {stats.clients} clients, {stats.caregivers} caregivers, {stats.visits} visits
                </span>
              )}
              {onDismiss && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDismiss}
                  aria-label="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Editable demo data banner (for real organizations)
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="text-sm font-medium text-foreground">
                Viewing sample data
              </span>
              {stats && (
                <span className="text-xs text-muted-foreground">
                  {stats.clients} clients, {stats.caregivers} caregivers, {stats.visits} visits
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClearDemo && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearDemo}
                disabled={isClearing}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isClearing ? 'Clearing...' : 'Remove Sample Data'}
              </Button>
            )}
            {onAddRealData && (
              <Button
                variant="default"
                size="sm"
                onClick={onAddRealData}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Real Data
              </Button>
            )}
            {onDismiss && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onDismiss}
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
