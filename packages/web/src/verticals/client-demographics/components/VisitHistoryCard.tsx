import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, User, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { formatDate, formatTime } from '@/core/utils';
import { useApiClient } from '@/core/hooks/api';
import { createClientApiService } from '../services/client-api';

interface VisitHistoryCardProps {
  clientId: string;
}

/** Format a calendar date (YYYY-MM-DD or ISO) without timezone day-shift. */
const formatVisitDate = (value: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : formatDate(value);
};

/** Format a wall-clock time string ("HH:MM[:SS]"). */
const formatClockTime = (value: string): string => {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  return formatTime(new Date(2000, 0, 1, Number(m[1]), Number(m[2])));
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-800',
  INCOMPLETE: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  NO_SHOW_CLIENT: 'bg-red-100 text-red-800',
  NO_SHOW_CAREGIVER: 'bg-orange-100 text-orange-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-purple-100 text-purple-800',
};

export const VisitHistoryCard: React.FC<VisitHistoryCardProps> = ({ clientId }) => {
  const [page, setPage] = useState(1);
  const limit = 10;
  const apiClient = useApiClient();
  const clientApi = useMemo(() => createClientApiService(apiClient), [apiClient]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['client-visit-history', clientId, page],
    queryFn: () => clientApi.getClientVisitHistory(clientId, { page, limit }),
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8" role="status" aria-label="Loading visit history">
            <LoadingSpinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorMessage
            message={(error as Error).message || 'Failed to load visit history'}
            retry={() => {
              void refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const visits = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const getStatusBadgeClass = (status: string): string => {
    return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const isCancelledOrNoShow = (status: string): boolean => {
    return ['CANCELLED', 'NO_SHOW_CLIENT', 'NO_SHOW_CAREGIVER'].includes(status);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Visit History</CardTitle>
          {total > 0 && (
            <span className="text-sm text-gray-500">
              {total} total visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No visit history found for this client.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit) => (
              <Link
                key={visit.id}
                to={`/scheduling/visits/${visit.id}`}
                className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {visit.visitNumber}
                      </span>
                      <Badge
                        className={getStatusBadgeClass(visit.status)}
                        variant="secondary"
                      >
                        {visit.status.replace(/_/g, ' ')}
                      </Badge>
                      {isCancelledOrNoShow(visit.status) && (
                        <span className="text-xs text-gray-500 italic">
                          (Not completed)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{visit.serviceTypeName}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatVisitDate(visit.scheduledDate)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* Scheduled time */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-gray-500 text-xs">Scheduled</p>
                      <p className="text-gray-900">
                        {formatClockTime(visit.scheduledStartTime)} -{' '}
                        {formatClockTime(visit.scheduledEndTime)}
                      </p>
                      <p className="text-xs text-gray-500">
                        ({formatDuration(visit.scheduledDuration)})
                      </p>
                    </div>
                  </div>

                  {/* Actual time (if available) */}
                  {visit.actualStartTime && visit.actualEndTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-gray-500 text-xs">Actual (EVV)</p>
                        <p className="text-gray-900">
                          {formatTime(new Date(visit.actualStartTime))} -{' '}
                          {formatTime(new Date(visit.actualEndTime))}
                        </p>
                        <p className="text-xs text-gray-500">
                          ({formatDuration(visit.actualDuration)})
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Caregiver */}
                  {visit.caregiverFirstName && visit.caregiverLastName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-gray-500 text-xs">Caregiver</p>
                        <p className="text-gray-900">
                          {visit.caregiverFirstName} {visit.caregiverLastName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
