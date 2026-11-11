import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { LoadingSpinner } from '@/core/components';
import { formatDate } from '@/core/utils';
import { useApiClient } from '@/core/hooks/api';

interface TimelineVisit {
  id: string;
  visitNumber: string;
  serviceTypeName: string;
  scheduledDate: string;
  status: string;
  caregiverFirstName?: string;
  caregiverLastName?: string;
}

interface TimelineEntry {
  id: string;
  type: 'client_created' | 'intake_completed' | 'visit_completed' | 'discharged';
  date: string;
  label: string;
  details?: string;
  linkTo?: string;
  color: 'green' | 'blue' | 'purple' | 'red';
}

interface ClientTimelineCardProps {
  clientId: string;
  createdAt: string;
  intakeDate?: string;
  dischargeDate?: string;
}

export const ClientTimelineCard: React.FC<ClientTimelineCardProps> = ({
  clientId,
  createdAt,
  intakeDate,
  dischargeDate,
}) => {
  const apiClient = useApiClient();
  
  // Fetch recent completed visits for timeline
  const { data: visitsData, isLoading } = useQuery({
    queryKey: ['client-timeline-visits', clientId],
    queryFn: async () => {
      const response = await apiClient.get(
        `/clients/${clientId}/visit-history?page=1&limit=5`
      );
      return response.data;
    },
    retry: 1,
  });

  // Build timeline entries
  const buildTimelineEntries = (): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];

    // Add client lifecycle events
    entries.push({
      id: 'created',
      type: 'client_created',
      date: createdAt,
      label: 'Client Created',
      color: 'green',
    });

    if (intakeDate) {
      entries.push({
        id: 'intake',
        type: 'intake_completed',
        date: intakeDate,
        label: 'Intake Completed',
        color: 'blue',
      });
    }

    // Add completed visits from visit history
    if (visitsData?.data?.items) {
      const completedVisits = visitsData.data.items.filter(
        (visit: TimelineVisit) => visit.status === 'COMPLETED'
      );

      // Show only the 3 most recent completed visits in timeline
      completedVisits.slice(0, 3).forEach((visit: TimelineVisit) => {
        const caregiverName =
          visit.caregiverFirstName && visit.caregiverLastName
            ? `${visit.caregiverFirstName} ${visit.caregiverLastName}`
            : 'Unassigned';

        entries.push({
          id: visit.id,
          type: 'visit_completed',
          date: visit.scheduledDate,
          label: 'Visit Completed',
          details: `${visit.serviceTypeName} • ${caregiverName}`,
          linkTo: `/scheduling/visits/${visit.id}`,
          color: 'purple',
        });
      });
    }

    if (dischargeDate) {
      entries.push({
        id: 'discharged',
        type: 'discharged',
        date: dischargeDate,
        label: 'Discharged',
        color: 'red',
      });
    }

    // Sort by date descending (most recent first)
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const timelineEntries = buildTimelineEntries();

  const getTimelineIcon = (type: TimelineEntry['type']) => {
    switch (type) {
      case 'client_created':
        return <User className="h-4 w-4 text-green-500" />;
      case 'intake_completed':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'visit_completed':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case 'discharged':
        return <Clock className="h-4 w-4 text-red-500" />;
    }
  };

  const getColorClass = (color: TimelineEntry['color']) => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'blue':
        return 'bg-blue-500';
      case 'purple':
        return 'bg-purple-500';
      case 'red':
        return 'bg-red-500';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Timeline</CardTitle>
          {isLoading && <LoadingSpinner size="sm" />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {timelineEntries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3">
              <div className={`h-2 w-2 mt-2 rounded-full ${getColorClass(entry.color)}`} />
              <div className="flex-1 min-w-0">
                {entry.linkTo ? (
                  <Link
                    to={entry.linkTo}
                    className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {getTimelineIcon(entry.type)}
                      <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                    </div>
                    {entry.details && (
                      <p className="text-xs text-gray-600 ml-6">{entry.details}</p>
                    )}
                    <p className="text-xs text-gray-600 ml-6">{formatDate(entry.date)}</p>
                  </Link>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      {getTimelineIcon(entry.type)}
                      <p className="text-sm font-medium text-gray-900">{entry.label}</p>
                    </div>
                    {entry.details && (
                      <p className="text-xs text-gray-600 ml-6">{entry.details}</p>
                    )}
                    <p className="text-xs text-gray-600 ml-6">{formatDate(entry.date)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Link to full visit history */}
        <div className="mt-4 pt-4 border-t">
          <Link to="#visit-history" className="block">
            <Button variant="outline" size="sm" className="w-full">
              View Full Visit History
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
