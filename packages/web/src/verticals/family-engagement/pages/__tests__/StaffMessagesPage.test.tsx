import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StaffMessagesPage } from '../StaffMessagesPage';

const mockUpdateThreadMutate = vi.fn();
const mockSendMessageMutate = vi.fn();

const mockStaffMembers = [
  {
    id: 'staff-1',
    firstName: 'Alice',
    lastName: 'Coordinator',
    email: 'alice@example.com',
    roles: ['COORDINATOR'],
    status: 'ACTIVE' as const,
  },
  {
    id: 'staff-2',
    firstName: 'Bob',
    lastName: 'Caregiver',
    email: 'bob@example.com',
    roles: ['CAREGIVER'],
    status: 'ACTIVE' as const,
  },
];

const mockThreads = [
  {
    id: 'thread-1',
    familyMemberId: 'fm-1',
    clientId: 'client-1',
    subject: 'Medication Schedule Question',
    status: 'OPEN' as const,
    priority: 'NORMAL' as const,
    participants: ['fm-1', 'staff-1'],
    assignedToUserId: 'staff-1',
    lastMessageAt: new Date('2026-01-15T10:00:00Z'),
    messageCount: 2,
    unreadCountFamily: 0,
    unreadCountStaff: 1,
    organizationId: 'org-1',
    branchId: 'branch-1',
    familyMemberName: 'Jane Doe',
    familyMemberRelationship: 'DAUGHTER',
    createdAt: new Date('2026-01-15T09:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    createdBy: 'fm-1',
    updatedBy: 'fm-1',
    version: 1,
  },
  {
    id: 'thread-2',
    familyMemberId: 'fm-2',
    clientId: 'client-2',
    subject: 'Upcoming Visit Timing',
    status: 'OPEN' as const,
    priority: 'HIGH' as const,
    participants: ['fm-2'],
    assignedToUserId: undefined,
    lastMessageAt: new Date('2026-01-15T11:00:00Z'),
    messageCount: 1,
    unreadCountFamily: 0,
    unreadCountStaff: 0,
    organizationId: 'org-1',
    branchId: 'branch-1',
    familyMemberName: 'John Smith',
    familyMemberRelationship: 'SON',
    createdAt: new Date('2026-01-15T11:00:00Z'),
    updatedAt: new Date('2026-01-15T11:00:00Z'),
    createdBy: 'fm-2',
    updatedBy: 'fm-2',
    version: 1,
  },
];

vi.mock('../../hooks', () => ({
  useStaffInbox: () => ({
    data: mockThreads,
    isLoading: false,
  }),
  useMessagesInThread: () => ({
    data: [],
    isLoading: false,
  }),
  useSendMessage: () => ({
    mutate: mockSendMessageMutate,
    isPending: false,
  }),
  useUpdateMessageThread: () => ({
    mutate: mockUpdateThreadMutate,
    isPending: false,
  }),
  useOrganizationStaff: () => ({
    data: mockStaffMembers,
    isLoading: false,
  }),
  useFamilyMembersForClient: () => ({
    data: [],
    isLoading: false,
  }),
  useStaffCreateThread: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: {
      id: 'staff-1',
      organizationId: 'org-1',
      email: 'alice@example.com',
      name: 'Alice Coordinator',
      roles: ['COORDINATOR'],
      permissions: ['messages:view', 'messages:create'],
    },
  }),
}));

vi.mock('@/verticals/client-demographics/hooks/useClients.js', () => ({
  useClients: () => ({
    data: { items: [] },
    isLoading: false,
  }),
}));

function renderWithRouter(initialEntry = '/messages/thread-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/messages" element={<StaffMessagesPage />} />
        <Route path="/messages/:threadId" element={<StaffMessagesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StaffMessagesPage thread assignment UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the assigned staff member name for an assigned thread', () => {
    renderWithRouter('/messages/thread-1');

    expect(screen.getByText('Assigned to Alice Coordinator')).toBeInTheDocument();
    const select = screen.getByLabelText('Assign conversation') as HTMLSelectElement;
    expect(select.value).toBe('staff-1');
  });

  it('displays Unassigned when a thread has no assignee', () => {
    renderWithRouter('/messages/thread-2');

    const select = screen.getByLabelText('Assign conversation') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);
  });

  it('calls useUpdateMessageThread with assignedToUserId when selecting a staff member', async () => {
    const user = userEvent.setup();
    renderWithRouter('/messages/thread-2');

    const select = screen.getByLabelText('Assign conversation');
    await user.selectOptions(select, 'staff-2');

    expect(mockUpdateThreadMutate).toHaveBeenCalledWith({
      threadId: 'thread-2',
      changes: { assignedToUserId: 'staff-2' },
    });
  });

  it('calls useUpdateMessageThread with null when unassigning a thread', async () => {
    const user = userEvent.setup();
    renderWithRouter('/messages/thread-1');

    const select = screen.getByLabelText('Assign conversation');
    await user.selectOptions(select, '');

    expect(mockUpdateThreadMutate).toHaveBeenCalledWith({
      threadId: 'thread-1',
      changes: { assignedToUserId: null },
    });
  });

  it('filters threads when clicking My Threads vs All', async () => {
    const user = userEvent.setup();
    renderWithRouter('/messages/thread-1');

    expect(screen.getByText('Upcoming Visit Timing')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'My Threads' }));

    expect(screen.getAllByText('Medication Schedule Question').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Upcoming Visit Timing')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Upcoming Visit Timing')).toBeInTheDocument();
  });
});
