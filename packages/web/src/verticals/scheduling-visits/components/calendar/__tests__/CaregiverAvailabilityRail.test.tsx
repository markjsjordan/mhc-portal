import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaregiverAvailabilityRail } from '../CaregiverAvailabilityRail';

describe('CaregiverAvailabilityRail', () => {
  const mockCaregivers = [
    {
      id: 'cg-1',
      name: 'Helen Brown',
      color: '#3B82F6',
      visitCount: 4,
      scheduledHours: 14.5,
    },
    {
      id: 'cg-2',
      name: 'Laci Mitchell',
      color: '#10B981',
      visitCount: 6,
      scheduledHours: 24.0,
    },
    {
      id: 'cg-3',
      name: 'Zero Visit Caregiver',
      color: '#EF4444',
      visitCount: 0,
      scheduledHours: 0,
    },
  ];

  it('renders active caregivers and hours', () => {
    render(
      <CaregiverAvailabilityRail
        isOpen={true}
        onClose={vi.fn()}
        caregivers={mockCaregivers}
        selectedCaregiverIds={[]}
        onToggleCaregiver={vi.fn()}
      />
    );

    expect(screen.getByText('Caregiver Availability')).toBeInTheDocument();
    expect(screen.getByText('Helen Brown')).toBeInTheDocument();
    expect(screen.getByText('4 visits | 14.5 hrs')).toBeInTheDocument();
    expect(screen.getByText('Laci Mitchell')).toBeInTheDocument();
    expect(screen.getByText('6 visits | 24.0 hrs')).toBeInTheDocument();
  });

  it('collapses zero-visit caregivers in accordion', () => {
    render(
      <CaregiverAvailabilityRail
        isOpen={true}
        onClose={vi.fn()}
        caregivers={mockCaregivers}
        selectedCaregiverIds={[]}
        onToggleCaregiver={vi.fn()}
      />
    );

    expect(screen.getByText('No visits in range (1)')).toBeInTheDocument();
    expect(screen.queryByText('Zero Visit Caregiver')).not.toBeInTheDocument();
  });

  it('calls onToggleCaregiver when a caregiver card is clicked', async () => {
    const mockToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <CaregiverAvailabilityRail
        isOpen={true}
        onClose={vi.fn()}
        caregivers={mockCaregivers}
        selectedCaregiverIds={['cg-1']}
        onToggleCaregiver={mockToggle}
      />
    );

    const helenCard = screen.getByText('Helen Brown');
    await user.click(helenCard);

    expect(mockToggle).toHaveBeenCalledWith('cg-1');
  });

  it('calls onClose when Collapse button is clicked', async () => {
    const mockClose = vi.fn();
    const user = userEvent.setup();

    render(
      <CaregiverAvailabilityRail
        isOpen={true}
        onClose={mockClose}
        caregivers={mockCaregivers}
        selectedCaregiverIds={[]}
        onToggleCaregiver={vi.fn()}
      />
    );

    const collapseBtn = screen.getByTitle('Collapse Availability Panel');
    await user.click(collapseBtn);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
