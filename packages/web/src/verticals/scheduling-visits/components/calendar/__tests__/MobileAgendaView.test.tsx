import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileAgendaView } from '../MobileAgendaView';
import type { Visit } from '../../../types';

describe('MobileAgendaView', () => {
  const mockDate = new Date('2026-10-22T10:00:00.000Z');

  const mockVisits: Visit[] = [
    {
      id: 'visit-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      clientId: 'client-1',
      visitNumber: 'V-001',
      visitType: 'REGULAR',
      serviceTypeId: 'srv-1',
      serviceTypeName: 'Personal Care',
      scheduledDate: '2026-10-22',
      scheduledStartTime: '09:00',
      scheduledEndTime: '11:30',
      scheduledDuration: 150,
      timezone: 'America/New_York',
      clientFirstName: 'Margaret',
      clientLastName: 'Thompson',
      assignedCaregiverId: 'cg-1',
      status: 'ASSIGNED',
      isUrgent: false,
      isPriority: false,
      requiresSupervision: false,
      address: { line1: '123 Main St', city: 'Austin', state: 'TX', postalCode: '78701', country: 'USA' },
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ];

  const colorMap = new Map([['cg-1', '#3B82F6']]);
  const nameMap = new Map([['cg-1', 'Helen Brown']]);

  it('renders chronological day agenda card for visits matching current date', () => {
    render(
      <MobileAgendaView
        currentDate={mockDate}
        visits={mockVisits}
        onSelectVisit={vi.fn()}
        onReassignVisit={vi.fn()}
        caregiverColorMap={colorMap}
        caregiverNameMap={nameMap}
      />
    );

    expect(screen.getByText('Day Agenda')).toBeInTheDocument();
    expect(screen.getByText('Margaret Thompson')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Helen Brown')).toBeInTheDocument();
    expect(screen.getByText('[Tap visit for details / reassign]')).toBeInTheDocument();
  });

  it('triggers onReassignVisit when reassign action is tapped', async () => {
    const mockReassign = vi.fn();
    const user = userEvent.setup();

    render(
      <MobileAgendaView
        currentDate={mockDate}
        visits={mockVisits}
        onSelectVisit={vi.fn()}
        onReassignVisit={mockReassign}
        caregiverColorMap={colorMap}
        caregiverNameMap={nameMap}
      />
    );

    const reassignBtn = screen.getByText('[Tap visit for details / reassign]');
    await user.click(reassignBtn);

    expect(mockReassign).toHaveBeenCalledWith(mockVisits[0]);
  });
});
