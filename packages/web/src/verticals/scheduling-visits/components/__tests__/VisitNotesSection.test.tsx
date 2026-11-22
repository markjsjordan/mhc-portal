import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VisitNotesSection } from '../VisitNotesSection';

const mockMutateAsync = vi.fn();
const mockRefetch = vi.fn();
const mockUseVisitNotes = vi.fn();
const mockUsePermissions = vi.fn();
const mockUseSectionAccess = vi.fn();

vi.mock('../../hooks/useVisits', () => ({
  useVisitNotes: (...args: unknown[]) => mockUseVisitNotes(...args),
  useCreateVisitNote: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/core/hooks', () => ({
  usePermissions: () => mockUsePermissions(),
}));

vi.mock('@/core/hooks/permissions', () => ({
  useSectionAccess: (...args: unknown[]) => mockUseSectionAccess(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VisitNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePermissions.mockReturnValue({
      can: () => true,
      hasAnyRole: () => true,
    });
    mockUseSectionAccess.mockReturnValue({
      canWrite: true,
      readOnly: false,
    });
    mockUseVisitNotes.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
  });

  it('renders empty state when there are no notes', () => {
    render(<VisitNotesSection visitId="visit-1" />);
    expect(screen.getByTestId('visit-notes-section')).toBeInTheDocument();
    expect(screen.getByTestId('visit-notes-empty')).toHaveTextContent(
      'No notes have been added to this visit yet.'
    );
    expect(screen.getByTestId('visit-notes-count')).toHaveTextContent('0');
  });

  it('renders existing notes with author and category', () => {
    mockUseVisitNotes.mockReturnValue({
      data: [
        {
          id: 'note-1',
          visitId: 'visit-1',
          noteType: 'CLINICAL',
          noteText: 'Client vitals were normal.',
          authorName: 'Jane Coordinator',
          createdAt: '2026-11-22T12:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<VisitNotesSection visitId="visit-1" />);
    expect(screen.getByTestId('visit-notes-count')).toHaveTextContent('1');
    const noteItem = screen.getByTestId('visit-note-item');
    expect(noteItem).toHaveTextContent('Client vitals were normal.');
    expect(noteItem).toHaveTextContent('Jane Coordinator');
    expect(noteItem).toHaveTextContent('Clinical');
  });

  it('submits a new note and clears the input', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: 'note-2',
      visitId: 'visit-1',
      noteType: 'GENERAL',
      noteText: 'Left spare keys with family.',
      createdAt: '2026-11-22T12:05:00Z',
    });

    render(<VisitNotesSection visitId="visit-1" />);

    const input = screen.getByTestId('visit-note-input');
    const submit = screen.getByTestId('visit-note-submit');
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Left spare keys with family.' } });
    expect(submit).not.toBeDisabled();

    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        visitId: 'visit-1',
        payload: {
          noteText: 'Left spare keys with family.',
          noteType: 'GENERAL',
          isIncident: false,
        },
      });
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('hides the add-note form when user lacks write access', () => {
    mockUseSectionAccess.mockReturnValue({
      canWrite: false,
      readOnly: true,
    });

    render(<VisitNotesSection visitId="visit-1" />);
    expect(screen.queryByTestId('visit-note-form')).not.toBeInTheDocument();
  });
});
