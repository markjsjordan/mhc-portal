import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StateSelector } from '../StateSelector';
import { US_STATES } from '@/core/constants/us-states';

describe('StateSelector Component', () => {
  it('renders with all 56 states', () => {
    const { container } = render(<StateSelector id="test-state" label="State" />);
    const select = container.querySelector('select');
    const options = select?.querySelectorAll('option');
    expect(options?.length).toBe(57);
  });

  it('displays selected state name', async () => {
    const { container } = render(<StateSelector id="test-state" label="State" value="TX" testId="state-select" />);
    await waitFor(() => {
      expect(screen.getByText(/Selected: Texas/)).toBeInTheDocument();
    });
  });

  it('calls onChange callback', () => {
    const onChange = vi.fn();
    const { container } = render(<StateSelector id="test-state" label="State" onChange={onChange} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'CA' } });
    expect(onChange).toHaveBeenCalledWith('CA');
  });

  it('excludes territories when excludeTerritory=true', () => {
    const { container } = render(<StateSelector id="test-state" label="State" excludeTerritory={true} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    const values = Array.from(select.options).map(o => o.value);
    expect(values).not.toContain('PR');
  });

  it('displays validation error message', () => {
    render(<StateSelector id="test-state" label="State" error="Invalid state" />);
    expect(screen.getByText('Invalid state')).toBeInTheDocument();
  });

  it('contains exactly 56 states in constant', () => {
    expect(US_STATES.length).toBe(56);
  });
});