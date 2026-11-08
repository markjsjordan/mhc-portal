import React from 'react';
import { Button } from '@/components/ui/button.js';

interface CaregiverLoadCellProps {
  caregiverName: string;
  date: string;
  hours: number;
  onClick: () => void;
}

export const CaregiverLoadCell: React.FC<CaregiverLoadCellProps> = ({
  caregiverName,
  date,
  hours,
  onClick,
}) => {
  // Format date readable for aria-label: e.g. Mon Nov 9 (no comma between Mon and Nov to match spec exactly)
  const formattedDate = (() => {
    try {
      const parts = date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, parseInt(parts[2]!, 10));
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = d.getDate();
        return `${weekday} ${month} ${dayNum}`;
      }
    } catch {
      // fallback
    }
    return date;
  })();

  const formatHoursText = (h: number): string => {
    if (h <= 0) return '—';
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  };

  const hoursDisplay = formatHoursText(hours);
  const ariaLabel = `${caregiverName}, ${formattedDate}, ${hours > 0 ? `${hours} hours` : '0 hours'}`;

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: '100%',
        minHeight: '44px',
        padding: '8px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: hours > 0 ? '#f0fdf4' : 'transparent',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.15s, border-color 0.15s',
        color: hours > 0 ? '#166534' : '#9ca3af',
        fontSize: '13px',
        fontWeight: hours > 0 ? 600 : 400,
      }}
    >
      <span>{hoursDisplay}</span>
    </Button>
  );
};

