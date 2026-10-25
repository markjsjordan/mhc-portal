/**
 * Upcoming Visits Component
 *
 * Display next 7 days of scheduled visits
 */

import React from 'react';
import type { VisitSummary } from '@folkcare/family-engagement';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';

interface UpcomingVisitsProps {
  visits: VisitSummary[];
}

export const UpcomingVisits: React.FC<UpcomingVisitsProps> = ({ visits }) => {
  if (visits.length === 0) {
    return (
      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Visits</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 text-center py-4">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm text-gray-600">No upcoming visits scheduled</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Visits (Next 7 Days)</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        {visits.map((visit) => {
          const startTime = new Date(visit.scheduledStartTime);
          const endTime = new Date(visit.scheduledEndTime);
          const dateStr = startTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          const timeStr = `${startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })} - ${endTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}`;

          const statusVariant =
            visit.status === 'SCHEDULED'
              ? 'default'
              : visit.status === 'IN_PROGRESS'
              ? 'secondary'
              : visit.status === 'COMPLETED'
              ? 'outline'
              : 'destructive';

          return (
            <div
              key={visit.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0">
                {visit.caregiverPhotoUrl ? (
                  <img
                    src={visit.caregiverPhotoUrl}
                    alt={visit.caregiverName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                    {visit.caregiverName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {visit.caregiverName}
                  </h3>
                  <Badge variant={statusVariant} className="text-xs">
                    {visit.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600">{dateStr}</p>
                <p className="text-xs text-gray-600">{timeStr}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
