import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CreateGoalModal } from '../CreateGoalModal.js';

const mockMutate = vi.fn();
let mockIsPending = false;
let capturedOptions: { onSuccess?: () => void; onError?: (err: Error) => void } | undefined;

vi.mock('../../hooks/use-create-goal.js', () => ({
  useCreateGoal: (_carePlanId: string, options?: { onSuccess?: () => void; onError?: (err: Error) => void }) => {
    capturedOptions = options;
    return {
      mutate: mockMutate,
      isPending: mockIsPending,
    };
  },
}));

describe('CreateGoalModal', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    capturedOptions = undefined;
  });

  it('validates that title is required before submitting', () => {
    render(<CreateGoalModal carePlanId="plan-1" open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));

    expect(screen.getByText(/goal title is required/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('submits trimmed title and closes on success', () => {
    render(<CreateGoalModal carePlanId="plan-1" open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: '  Improve mobility  ' },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Walk 50 feet daily' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));

    expect(mockMutate).toHaveBeenCalledWith({
      title: 'Improve mobility',
      description: 'Walk 50 feet daily',
      category: 'MOBILITY',
      priority: 'MEDIUM',
      targetDate: undefined,
    });

    capturedOptions?.onSuccess?.();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('preserves entered values and shows error on failure', () => {
    render(<CreateGoalModal carePlanId="plan-1" open={true} onOpenChange={onOpenChange} />);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Medication adherence' } });
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));

    act(() => {
      capturedOptions?.onError?.(new Error('Network error'));
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(titleInput.value).toBe('Medication adherence');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('does not submit when cancel is clicked', () => {
    render(<CreateGoalModal carePlanId="plan-1" open={true} onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Draft goal' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
