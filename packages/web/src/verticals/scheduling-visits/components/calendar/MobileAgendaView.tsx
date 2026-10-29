import React from 'react';
import moment from 'moment';
import type { Visit } from '../../types';

export interface MobileAgendaViewProps {
  currentDate: Date;
  visits: Visit[];
  onSelectVisit: (visit: Visit) => void;
  onReassignVisit: (visit: Visit) => void;
  caregiverColorMap: Map<string, string>;
  caregiverNameMap?: Map<string, string>;
}

export const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
  currentDate,
  visits,
  onSelectVisit,
  onReassignVisit,
  caregiverColorMap,
  caregiverNameMap,
}) => {
  // Sort visits for the current day chronologically
  const dayVisits = visits
    .filter((visit) => {
      const vDate = moment(visit.scheduledDate);
      return vDate.isSame(moment(currentDate), 'day');
    })
    .sort((a, b) => {
      return (a.scheduledStartTime || '').localeCompare(b.scheduledStartTime || '');
    });

  if (dayVisits.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center my-4">
        <p className="text-gray-500 text-sm">
          No visits scheduled for {moment(currentDate).format('dddd, MMMM D, YYYY')}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
        Day Agenda
      </h3>
      <div className="space-y-3">
        {dayVisits.map((visit) => {
          const clientName =
            visit.clientFirstName && visit.clientLastName
              ? `${visit.clientFirstName} ${visit.clientLastName}`
              : 'Unknown Client';

          const caregiverColor =
            visit.assignedCaregiverId && caregiverColorMap.has(visit.assignedCaregiverId)
              ? caregiverColorMap.get(visit.assignedCaregiverId)!
              : '#3B82F6';

          let caregiverDisplayName = 'Unassigned';
          if (visit.assignedCaregiverId) {
            caregiverDisplayName = caregiverNameMap?.get(visit.assignedCaregiverId) ?? 'Assigned';
          }

          let statusColor = caregiverColor;
          if (visit.status === 'UNASSIGNED') {
            statusColor = '#F59E0B';
          } else if (visit.status === 'COMPLETED') {
            statusColor = '#10B981';
          } else if (visit.status === 'CANCELLED') {
            statusColor = '#EF4444';
          }

          const startTime = visit.scheduledStartTime || '09:00';
          const endTime = visit.scheduledEndTime || '11:00';

          return (
            <div
              key={visit.id}
              className="flex items-start gap-3"
            >
              {/* Time gutter */}
              <div className="w-16 flex-shrink-0 text-xs font-semibold text-gray-700 pt-1">
                {startTime}
              </div>

              {/* Card */}
              <div
                onClick={() => onSelectVisit(visit)}
                className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden cursor-pointer hover:border-gray-300 transition-colors"
                style={{ borderLeftWidth: '4px', borderLeftColor: statusColor }}
              >
                <div className="p-3">
                  <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span>{clientName}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {startTime} - {endTime} ({visit.status})
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Caregiver:{' '}
                    {visit.assignedCaregiverId ? (
                      <span className="font-medium text-gray-700">
                        {caregiverDisplayName}
                      </span>
                    ) : (
                      <span className="font-medium text-amber-600">Unassigned</span>
                    )}
                  </div>
                </div>

                {/* Reassign action footer */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onReassignVisit(visit);
                  }}
                  className="bg-gray-50 border-t border-gray-100 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors text-center"
                >
                  [Tap visit for details / reassign]
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
