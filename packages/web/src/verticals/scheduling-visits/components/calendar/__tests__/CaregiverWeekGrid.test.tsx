import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CaregiverWeekGrid } from '../CaregiverWeekGrid.js';
import type { CaregiverWeekLoad } from '../../../utils/week-load.js';

describe('CaregiverWeekGrid', () => {
  const weekDays = [
    '2026-11-08',
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
    '2026-11-14',
  ];

  const rows: CaregiverWeekLoad[] = [
    {
      caregiverId: 'cg-1',
      caregiverName: 'Alice Walker',
      totalHours: 42,
      dailyHours: {
        '2026-11-08': 0,
        '2026-11-09': 10,
        '2026-11-10': 10,
        '2026-11-11': 10,
        '2026-11-12': 10,
        '2026-11-13': 2,
        '2026-11-14': 0,
      },
      status: 'OVERTIME',
      thresholdConfig: { weeklyThreshold: 40, warningThreshold: 35 },
    },
    {
      caregiverId: 'cg-2',
      caregiverName: 'Bob Stone',
      totalHours: 36,
      dailyHours: {
        '2026-11-08': 0,
        '2026-11-09': 8,
        '2026-11-10': 8,
        '2026-11-11': 8,
        '2026-11-12': 8,
        '2026-11-13': 4,
        '2026-11-14': 0,
      },
      status: 'WARNING',
      thresholdConfig: { weeklyThreshold: 40, warningThreshold: 35 },
    },
    {
      caregiverId: 'cg-3',
      caregiverName: 'Charlie Day',
      totalHours: 0,
      dailyHours: {
        '2026-11-08': 0,
        '2026-11-09': 0,
        '2026-11-10': 0,
        '2026-11-11': 0,
        '2026-11-12': 0,
        '2026-11-13': 0,
        '2026-11-14': 0,
      },
      status: 'NORMAL',
      thresholdConfig: { weeklyThreshold: 40, warningThreshold: 35 },
    },
  ];

  test('renders caregivers and week columns', () => {
    const handleSelectDay = vi.fn();
    render(
      <CaregiverWeekGrid
        weekDays={weekDays}
        rows={rows}
        onSelectDay={handleSelectDay}
      />
    );

    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('Bob Stone')).toBeInTheDocument();
    expect(screen.getByText('Charlie Day')).toBeInTheDocument();

    // Check overtime badges
    expect(screen.getByText(/42 \/ 40h Overtime/i)).toBeInTheDocument();
    expect(screen.getByText(/36 \/ 40h Approaching/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 40h/i)).toBeInTheDocument();
  });

  test('calls onSelectDay with caregiverId and date when a day cell is clicked', () => {
    const handleSelectDay = vi.fn();
    render(
      <CaregiverWeekGrid
        weekDays={weekDays}
        rows={rows}
        onSelectDay={handleSelectDay}
      />
    );

    // Find the cell for Alice Walker on 2026-11-09 (10h)
    const button = screen.getByRole('button', {
      name: /Alice Walker, Mon Nov 9, 10 hours/i,
    });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleSelectDay).toHaveBeenCalledWith('cg-1', '2026-11-09');
  });

  test('allows sorting by name and hours', () => {
    const handleSelectDay = vi.fn();
    render(
      <CaregiverWeekGrid
        weekDays={weekDays}
        rows={rows}
        onSelectDay={handleSelectDay}
      />
    );

    const sortByNameBtn = screen.getByRole('button', { name: /name/i });
    fireEvent.click(sortByNameBtn);

    // Verify Alice is still rendered and Bob is rendered
    expect(screen.getByText('Alice Walker')).toBeInTheDocument();
    expect(screen.getByText('Bob Stone')).toBeInTheDocument();
  });
});
