import React from 'react';
import { Badge } from '@/components/ui/badge.js';

interface PatternStatusBadgeProps {
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  className?: string;
}

export const PatternStatusBadge: React.FC<PatternStatusBadgeProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'ACTIVE':
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" aria-hidden="true" />
          Active
        </Badge>
      );
    case 'PAUSED':
      return (
        <Badge
          variant="outline"
          className={`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" aria-hidden="true" />
          Paused
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge
          variant="outline"
          className={`bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" aria-hidden="true" />
          Ended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
