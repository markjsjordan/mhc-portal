import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, User, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { EVVRecord } from '../types';

interface EVVRecordCardProps {
  record: EVVRecord;
  compact?: boolean;
}

export const EVVRecordCard: React.FC<EVVRecordCardProps> = ({ record, compact = false }) => {
  const statusColors = {
    PENDING: 'bg-blue-100 text-blue-800',
    COMPLETE: 'bg-green-100 text-green-800',
    SUBMITTED: 'bg-purple-100 text-purple-800',
    AMENDED: 'bg-yellow-100 text-yellow-800',
    VOIDED: 'bg-red-100 text-red-800',
  };

  const statusColor = statusColors[record.recordStatus] || 'bg-gray-100 text-gray-800';

  const formattedServiceDate = record.serviceDate
    ? new Date(record.serviceDate).toLocaleDateString()
    : undefined;

  const visitTitleParts = [record.clientName, formattedServiceDate].filter(Boolean);
  const visitLabel = visitTitleParts.length > 0
    ? `Visit: ${visitTitleParts.join(' · ')}`
    : 'Visit';

  const renderVerificationBadge = () => {
    if (record.clockInVerification?.locationCaptured === false) {
      return (
        <>
          <MapPin className="h-4 w-4 text-gray-400" />
          <span>Location not captured</span>
        </>
      );
    }
    if (record.verificationLevel === 'FULL' && record.clockInVerification?.latitude != null) {
      return (
        <>
          <MapPin className="h-4 w-4" />
          <span>GPS Verified</span>
        </>
      );
    }
    return (
      <>
        <CheckCircle className="h-4 w-4" />
        <span>{record.verificationLevel}</span>
      </>
    );
  };

  return (
    <Link
      to={`/time-tracking/${record.id}`}
      className={`block bg-white rounded-lg shadow hover:shadow-md transition-shadow ${compact ? 'p-3' : 'p-6'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {/* @ts-ignore */}
            <Clock className="h-5 w-5 text-gray-400" />
            <span className="font-semibold text-gray-900">
              {visitLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {/* @ts-ignore */}
            <User className="h-4 w-4" />
            <span>Caregiver: {record.caregiverName ?? 'Unassigned name'}</span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {record.recordStatus.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Check In:</span>
          <span className="font-medium">{new Date(record.clockInTime).toLocaleString()}</span>
        </div>
        {record.clockOutTime && (
          <div className="flex justify-between">
            <span>Check Out:</span>
            <span className="font-medium">{new Date(record.clockOutTime).toLocaleString()}</span>
          </div>
        )}
        {record.totalDuration && (
          <div className="flex justify-between">
            <span>Duration:</span>
            <span className="font-medium">{record.totalDuration} minutes</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {renderVerificationBadge()}
        </div>
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(record.createdAt), { addSuffix: true })}
        </span>
      </div>
    </Link>
  );
};
