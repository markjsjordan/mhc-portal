import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { OvertimeStatus } from '../../utils/week-load.js';

interface OvertimeBadgeProps {
  status: OvertimeStatus;
  totalHours: number;
  threshold?: number;
}

export const OvertimeBadge: React.FC<OvertimeBadgeProps> = ({
  status,
  totalHours,
  threshold = 40,
}) => {
  const formattedHours = Number.isInteger(totalHours) ? totalHours.toString() : totalHours.toFixed(1);

  if (status === 'OVERTIME') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fecaca',
        }}
        title={`Exceeds ${threshold}h overtime threshold`}
      >
        <AlertCircle size={14} aria-hidden="true" />
        <span>{formattedHours} / {threshold}h Overtime</span>
      </span>
    );
  }

  if (status === 'WARNING') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fde68a',
        }}
        title={`Approaching ${threshold}h overtime threshold`}
      >
        <AlertTriangle size={14} aria-hidden="true" />
        <span>{formattedHours} / {threshold}h Approaching</span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
      }}
    >
      <CheckCircle2 size={14} aria-hidden="true" />
      <span>{formattedHours} / {threshold}h</span>
    </span>
  );
};
