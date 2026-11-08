import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BookedVisitConflict } from '../services/caregiver-availability-api.js';

export interface ConflictBannerProps {
  conflicts: BookedVisitConflict[];
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className="p-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900"
      data-testid="conflict-banner"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="font-semibold text-sm">
            Cannot save availability due to booked visits
          </p>
          <p className="text-xs text-amber-800">
            You are scheduled for visits during times marked unavailable. Adjust your availability or coordinate with your supervisor.
          </p>
          <ul className="space-y-1.5 text-xs">
            {conflicts.map((conflict) => (
              <li
                key={conflict.visitId}
                className="flex items-center gap-2 font-medium"
              >
                <span>
                  {conflict.date} {conflict.start} – {conflict.end}
                </span>
                <Link
                  to={`/scheduling/visits/${conflict.visitId}`}
                  className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900 underline"
                  aria-label={`View visit ${conflict.visitId}`}
                >
                  <span>View visit</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
