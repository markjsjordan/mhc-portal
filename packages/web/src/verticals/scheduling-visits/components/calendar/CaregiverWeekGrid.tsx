import React, { useState, useMemo } from 'react';
import { ArrowUpDown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import type { CaregiverWeekLoad } from '../../utils/week-load.js';
import { CaregiverLoadCell } from './CaregiverLoadCell.js';
import { OvertimeBadge } from './OvertimeBadge.js';

export interface CaregiverWeekGridProps {
  weekDays: string[];
  rows: CaregiverWeekLoad[];
  onSelectDay: (caregiverId: string, date: string) => void;
}

export const CaregiverWeekGrid: React.FC<CaregiverWeekGridProps> = ({
  weekDays,
  rows,
  onSelectDay,
}) => {
  const [sortBy, setSortBy] = useState<'hours' | 'name'>('hours');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortBy === 'hours') {
        const diff = b.totalHours - a.totalHours;
        return sortAsc ? -diff : diff;
      } else {
        const nameA = a.caregiverName.toLowerCase();
        const nameB = b.caregiverName.toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        return sortAsc ? cmp : -cmp;
      }
    });
  }, [rows, sortBy, sortAsc]);

  const toggleSort = (field: 'hours' | 'name') => {
    if (sortBy === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortBy(field);
      setSortAsc(field === 'name'); // Default asc for name, desc for hours
    }
  };

  const formatDayHeader = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, parseInt(parts[2]!, 10));
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        return { weekday, monthDay };
      }
    } catch {
      // fallback
    }
    return { weekday: dateStr, monthDay: '' };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Controls & Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Sort by:</span>
          <Button
            type="button"
            variant={sortBy === 'hours' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => toggleSort('hours')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: sortBy === 'hours' ? 600 : 400,
              backgroundColor: sortBy === 'hours' ? '#eff6ff' : '#f9fafb',
              color: sortBy === 'hours' ? '#1d4ed8' : '#4b5563',
              border: `1px solid ${sortBy === 'hours' ? '#bfdbfe' : '#e5e7eb'}`,
              cursor: 'pointer',
            }}
          >
            <span>Total Hours</span>
            <ArrowUpDown size={12} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={sortBy === 'name' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => toggleSort('name')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: sortBy === 'name' ? 600 : 400,
              backgroundColor: sortBy === 'name' ? '#eff6ff' : '#f9fafb',
              color: sortBy === 'name' ? '#1d4ed8' : '#4b5563',
              border: `1px solid ${sortBy === 'name' ? '#bfdbfe' : '#e5e7eb'}`,
              cursor: 'pointer',
            }}
          >
            <span>Name</span>
            <ArrowUpDown size={12} aria-hidden="true" />
          </Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9ca3af' }} />
            Normal (&lt;35h)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Warning (35-40h)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            Overtime (&gt;40h)
          </span>
        </div>
      </div>

      {/* Grid Table Container (responsive horizontal scroll with sticky caregiver column) */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: '760px',
            borderCollapse: 'separate',
            borderSpacing: '0',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  backgroundColor: '#f9fafb',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4b5563',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #e5e7eb',
                  minWidth: '220px',
                  width: '240px',
                }}
              >
                Caregiver
              </th>
              {weekDays.map(dateStr => {
                const { weekday, monthDay } = formatDayHeader(dateStr);
                return (
                  <th
                    key={dateStr}
                    style={{
                      padding: '10px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#4b5563',
                      textAlign: 'center',
                      borderBottom: '1px solid #e5e7eb',
                      minWidth: '70px',
                    }}
                  >
                    <div>{weekday}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>{monthDay}</div>
                  </th>
                );
              })}
              <th
                style={{
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4b5563',
                  textAlign: 'right',
                  borderBottom: '1px solid #e5e7eb',
                  minWidth: '160px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Week Total &amp; Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={weekDays.length + 2}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px',
                  }}
                >
                  No caregivers found.
                </td>
              </tr>
            ) : (
              sortedRows.map(row => (
                <tr
                  key={row.caregiverId}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  {/* Sticky Caregiver Cell */}
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      backgroundColor: '#ffffff',
                      padding: '10px 12px',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                      {row.caregiverName}
                    </div>
                  </td>

                  {/* Day Cells */}
                  {weekDays.map(dateStr => {
                    const hours = row.dailyHours[dateStr] ?? 0;
                    return (
                      <td
                        key={dateStr}
                        style={{
                          padding: '6px 4px',
                          textAlign: 'center',
                          borderBottom: '1px solid #f3f4f6',
                        }}
                      >
                        <CaregiverLoadCell
                          caregiverName={row.caregiverName}
                          date={dateStr}
                          hours={hours}
                          onClick={() => onSelectDay(row.caregiverId, dateStr)}
                        />
                      </td>
                    );
                  })}

                  {/* Total & Overtime Badge Cell */}
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <OvertimeBadge
                      status={row.status}
                      totalHours={row.totalHours}
                      threshold={row.thresholdConfig.weeklyThreshold}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Helpful note for coordinators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
        <AlertCircle size={14} aria-hidden="true" />
        <span>Click any day cell to jump to that day&apos;s schedule and focus on that caregiver.</span>
      </div>
    </div>
  );
};
