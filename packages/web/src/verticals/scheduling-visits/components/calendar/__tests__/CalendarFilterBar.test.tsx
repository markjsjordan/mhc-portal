import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarFilterBar } from '../CalendarFilterBar';

describe('CalendarFilterBar', () => {
  const mockCaregivers = [
    { id: 'cg-1', name: 'Helen Brown', color: '#3B82F6', visitCount: 4 },
    { id: 'cg-2', name: 'Laci Mitchell', color: '#10B981', visitCount: 6 },
  ];

  const mockClients = [
    { id: 'cl-1', name: 'Margaret Thompson', visitCount: 5 },
    { id: 'cl-2', name: 'John Doe', visitCount: 2 },
  ];

  it('renders caregiver and patient filter controls and status toggles', () => {
    render(
      <CalendarFilterBar
        allCaregivers={mockCaregivers}
        allClients={mockClients}
        selectedCaregivers={[]}
        onCaregiversChange={vi.fn()}
        selectedClients={[]}
        onClientsChange={vi.fn()}
        selectedStatuses={['ASSIGNED']}
        onStatusesChange={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByText('Caregiver')).toBeInTheDocument();
    expect(screen.getByText('Patient (Client)')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('renders active filter chips and handles remove chip click', async () => {
    const mockOnCaregiversChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CalendarFilterBar
        allCaregivers={mockCaregivers}
        allClients={mockClients}
        selectedCaregivers={['cg-1']}
        onCaregiversChange={mockOnCaregiversChange}
        selectedClients={['cl-1']}
        onClientsChange={vi.fn()}
        selectedStatuses={['ASSIGNED']}
        onStatusesChange={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByText('Helen Brown')).toBeInTheDocument();
    expect(screen.getByText('Margaret Thompson')).toBeInTheDocument();

    const removeHelenBtn = screen.getByLabelText('Remove Helen Brown filter');
    await user.click(removeHelenBtn);

    expect(mockOnCaregiversChange).toHaveBeenCalledWith([]);
  });

  it('calls onClearAll when Clear all button is clicked', async () => {
    const mockClearAll = vi.fn();
    const user = userEvent.setup();

    render(
      <CalendarFilterBar
        allCaregivers={mockCaregivers}
        allClients={mockClients}
        selectedCaregivers={['cg-1']}
        onCaregiversChange={vi.fn()}
        selectedClients={[]}
        onClientsChange={vi.fn()}
        selectedStatuses={['ASSIGNED']}
        onStatusesChange={vi.fn()}
        onClearAll={mockClearAll}
      />
    );

    const clearAllBtn = screen.getByText('Clear all');
    await user.click(clearAllBtn);

    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it('toggles status when status toggle is clicked', async () => {
    const mockOnStatusesChange = vi.fn();
    const user = userEvent.setup();

    render(
      <CalendarFilterBar
        allCaregivers={mockCaregivers}
        allClients={mockClients}
        selectedCaregivers={[]}
        onCaregiversChange={vi.fn()}
        selectedClients={[]}
        onClientsChange={vi.fn()}
        selectedStatuses={['ASSIGNED']}
        onStatusesChange={mockOnStatusesChange}
        onClearAll={vi.fn()}
      />
    );

    const unassignedBtn = screen.getByText('Unassigned');
    await user.click(unassignedBtn);

    expect(mockOnStatusesChange).toHaveBeenCalledWith(['ASSIGNED', 'UNASSIGNED']);
  });
});
