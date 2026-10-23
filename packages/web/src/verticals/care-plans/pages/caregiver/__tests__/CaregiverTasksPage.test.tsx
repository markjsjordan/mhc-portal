import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaregiverTasksPage } from '../CaregiverTasksPage';
import type { TaskInstance } from '../../../types';

let mockAuthUser: { id: string; roles: string[] } = {
  id: 'user-caregiver-1',
  roles: ['CAREGIVER'],
};
vi.mock('@/core/hooks', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

let mockMyCaregiverId: string | undefined = 'cg-1';
vi.mock('@/verticals/caregivers/hooks', () => ({
  useMyCaregiverId: () => ({
    caregiverId: mockMyCaregiverId,
    isLoading: false,
  }),
}));

const mockTasksByCaregiver: Record<string, TaskInstance[]> = {
  'cg-1': [
    {
      id: 'task-mine-1',
      carePlanId: 'cp-1',
      clientId: 'client-1',
      assignedCaregiverId: 'cg-1',
      name: 'My task',
      description: 'desc',
      category: 'MOBILITY',
      instructions: 'do it',
      scheduledDate: new Date().toISOString(),
      status: 'SCHEDULED',
      requiredSignature: false,
      requiredNote: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  all: [
    {
      id: 'task-mine-1',
      carePlanId: 'cp-1',
      clientId: 'client-1',
      assignedCaregiverId: 'cg-1',
      name: 'My task',
      description: 'desc',
      category: 'MOBILITY',
      instructions: 'do it',
      scheduledDate: new Date().toISOString(),
      status: 'SCHEDULED',
      requiredSignature: false,
      requiredNote: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-other-1',
      carePlanId: 'cp-2',
      clientId: 'client-2',
      assignedCaregiverId: 'cg-2',
      name: 'Someone else\'s task',
      description: 'desc',
      category: 'MOBILITY',
      instructions: 'do it',
      scheduledDate: new Date().toISOString(),
      status: 'SCHEDULED',
      requiredSignature: false,
      requiredNote: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const mockUseTasks = vi.fn();
vi.mock('../../../hooks', () => ({
  useTasks: (filters: { assignedCaregiverId?: string }) => mockUseTasks(filters),
}));

vi.mock('../../../components', () => ({
  TaskCard: ({ task }: { task: TaskInstance }) => <div data-testid={`task-${task.id}`}>{task.name}</div>,
  TaskCompletionModal: () => null,
}));

describe('CaregiverTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = { id: 'user-caregiver-1', roles: ['CAREGIVER'] };
    mockMyCaregiverId = 'cg-1';

    mockUseTasks.mockImplementation((filters: { assignedCaregiverId?: string }) => {
      const items = filters.assignedCaregiverId
        ? mockTasksByCaregiver[filters.assignedCaregiverId] ?? []
        : mockTasksByCaregiver['all'];
      return {
        data: { items },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      };
    });
  });

  it('defaults to the logged-in caregiver\'s own caregiverId (not user.id)', () => {
    render(<CaregiverTasksPage />);

    // Resolved via useMyCaregiverId (cg-1), never the raw user.id
    expect(mockUseTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignedCaregiverId: 'cg-1' })
    );
    expect(screen.getByTestId('task-task-mine-1')).toBeInTheDocument();
    expect(screen.queryByTestId('task-task-other-1')).not.toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
  });

  it('shows all tasks after clicking "Show all"', async () => {
    const user = userEvent.setup();
    render(<CaregiverTasksPage />);

    await user.click(screen.getByText('Show all'));

    expect(mockUseTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ assignedCaregiverId: undefined })
    );
    expect(screen.getByTestId('task-task-mine-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-other-1')).toBeInTheDocument();
    expect(screen.getByText('All Tasks')).toBeInTheDocument();
  });

  it('does not filter by caregiver for non-caregiver roles and has no toggle', () => {
    mockAuthUser = { id: 'user-admin-1', roles: ['ADMIN'] };
    mockMyCaregiverId = undefined;

    render(<CaregiverTasksPage />);

    expect(mockUseTasks).toHaveBeenCalledWith(
      expect.objectContaining({ assignedCaregiverId: undefined })
    );
    expect(screen.queryByText('Show all')).not.toBeInTheDocument();
  });
});
