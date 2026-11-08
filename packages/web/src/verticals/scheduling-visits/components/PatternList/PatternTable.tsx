import React from 'react';
import { UserX, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { PatternStatusBadge } from './PatternStatusBadge.js';
import { PauseResumeButton } from './PauseResumeButton.js';
import { PatternActionsMenu } from './PatternActionsMenu.js';
import type { PatternListItem } from '../../services/visit-api.js';

interface PatternTableProps {
  patterns: PatternListItem[];
  isLoading: boolean;
  canEdit: boolean;
  isMobile: boolean;
  onPause: (id: string, reason?: string) => Promise<unknown>;
  onResume: (id: string) => Promise<unknown>;
  onEndClick: (pattern: PatternListItem) => void;
}

export const PatternTable: React.FC<PatternTableProps> = ({
  patterns,
  isLoading,
  canEdit,
  isMobile,
  onPause,
  onResume,
  onEndClick,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted/40 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed rounded-lg bg-card">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-medium text-foreground">No recurring visit patterns found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          No patterns match your filter criteria. Try adjusting filters or create a new recurring schedule from the Builder.
        </p>
      </div>
    );
  }

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {patterns.map((p) => (
          <div
            key={p.id}
            className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-foreground text-base">{p.clientName}</h4>
                <div className="text-sm text-muted-foreground mt-0.5">{p.serviceTypeName}</div>
              </div>
              <PatternStatusBadge status={p.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground block">Caregiver</span>
                {p.caregiverName ?? (
                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 mt-0.5 text-[10px] px-1.5 py-0">
                    Unassigned
                  </Badge>
                )}
              </div>
              <div>
                <span className="font-medium text-foreground block">Next Visit</span>
                {p.nextVisitDate ?? '—'}
              </div>
              <div className="col-span-2">
                <span className="font-medium text-foreground block">Recurrence</span>
                <span className="text-foreground">{p.recurrenceSummary}</span>
              </div>
              <div>
                <span className="font-medium text-foreground block">Active Window</span>
                <span>{p.startDate} to {p.endDate ?? 'Ongoing'}</span>
              </div>
              <div>
                <span className="font-medium text-foreground block">Scheduled</span>
                <span>{p.futureVisitCount} visits</span>
              </div>
            </div>

            {canEdit && p.status !== 'CANCELLED' && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <PauseResumeButton
                  pattern={p}
                  onPause={onPause}
                  onResume={onResume}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEndClick(p)}
                  className="text-xs text-destructive hover:underline h-7 px-2 py-1"
                >
                  End...
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Desktop Table view
  return (
    <div className="border border-border rounded-md overflow-hidden bg-card">
      <table className="w-full text-left text-sm" role="table">
        <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Client</th>
            <th scope="col" className="px-4 py-3 font-semibold">Caregiver</th>
            <th scope="col" className="px-4 py-3 font-semibold">Recurrence</th>
            <th scope="col" className="px-4 py-3 font-semibold">Start Date</th>
            <th scope="col" className="px-4 py-3 font-semibold">End Date</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Next Visit</th>
            <th scope="col" className="px-4 py-3 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {patterns.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground">
                <div>{p.clientName}</div>
                <div className="text-xs text-muted-foreground">{p.serviceTypeName}</div>
              </td>
              <td className="px-4 py-3">
                {p.caregiverName ? (
                  <span className="text-foreground">{p.caregiverName}</span>
                ) : (
                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 gap-1 font-normal text-xs">
                    <UserX className="h-3 w-3" />
                    Unassigned
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-foreground font-medium">
                {p.recurrenceSummary}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {p.startDate}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {p.endDate ?? <span className="text-muted-foreground/60">Ongoing</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <PatternStatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {p.nextVisitDate ? (
                  <div>
                    <span className="text-foreground font-medium">{p.nextVisitDate}</span>
                    <span className="text-xs text-muted-foreground block">
                      {p.futureVisitCount} future
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1.5">
                  <PauseResumeButton
                    pattern={p}
                    onPause={onPause}
                    onResume={onResume}
                    disabled={!canEdit}
                  />
                  <PatternActionsMenu
                    pattern={p}
                    canEdit={canEdit}
                    onPause={() => {
                      if (p.status === 'ACTIVE') void onPause(p.id);
                    }}
                    onResume={() => {
                      if (p.status === 'PAUSED') void onResume(p.id);
                    }}
                    onEnd={() => onEndClick(p)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
