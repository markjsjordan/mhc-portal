import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Onboarding } from '../Onboarding.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/core/hooks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'u-1', organizationId: 'org-1' },
      token: 'test-token',
    }),
    useOnboarding: () => ({
      isLoading: false,
      error: null,
      steps: [
        {
          id: 'test_visit',
          title: 'Schedule a Test Visit',
          description: 'Test visit',
          isComplete: false,
          category: 'operations',
        },
      ],
      progress: {
        completed: 0,
        total: 1,
        percentage: 0,
        steps: [
          {
            id: 'test_visit',
            status: 'pending',
          },
        ],
      },
      isLoaded: true,
      initialize: vi.fn(),
      updateStep: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

describe('Onboarding Navigation Routes (wdvf3acfj2)', () => {
  it('navigates to /scheduling/builder when clicking Schedule Visit', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    // Expand the test_visit step by clicking on its header
    const stepHeader = await screen.findByText('Schedule a Test Visit');
    fireEvent.click(stepHeader);

    const scheduleBtn = await screen.findByText('Schedule Visit');
    expect(scheduleBtn).toBeInTheDocument();

    fireEvent.click(scheduleBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/scheduling/builder');
    });
  });
});
