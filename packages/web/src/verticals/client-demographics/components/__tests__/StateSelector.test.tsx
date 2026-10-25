import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StateSelector } from '../StateSelector';
import { US_STATES } from '@/core/constants/us-states';

// Setup pointer events mock for Radix UI Select in jsdom
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('StateSelector Component', () => {
  it('renders state selector with combobox trigger', () => {
    render(<StateSelector id="test-state" label="State" />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('displays selected state name', async () => {
    render(<StateSelector id="test-state" label="State" value="TX" testId="state-select" />);
    await waitFor(() => {
      expect(screen.getByText(/Selected: Texas/)).toBeInTheDocument();
    });
  });

  it('displays validation error message', () => {
    render(<StateSelector id="test-state" label="State" error="Invalid state" />);
    expect(screen.getByText('Invalid state')).toBeInTheDocument();
  });

  it('contains exactly 56 states in constant', () => {
    expect(US_STATES.length).toBe(56);
  });

  it('renders trigger with placeholder', () => {
    render(<StateSelector id="test-state" placeholder="Choose a state" />);
    expect(screen.getByText('Choose a state')).toBeInTheDocument();
  });
});
