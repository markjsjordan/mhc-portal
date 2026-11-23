import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitTypeSelector } from '../VisitTypeSelector';
import type { VisitType } from '../../types';

describe('VisitTypeSelector', () => {
  test('renders all 5 target visit types', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    expect(screen.getByText('Home Care Visit')).toBeInTheDocument();
    expect(screen.getByText('Med Check')).toBeInTheDocument();
    expect(screen.getByText('Nurse Visit')).toBeInTheDocument();
    expect(screen.getByText('Care Management')).toBeInTheDocument();
    expect(screen.getByText('Concierge Visit')).toBeInTheDocument();

    expect(screen.queryByText('Respite Care')).not.toBeInTheDocument();
    expect(screen.queryByText('Emergency Response')).not.toBeInTheDocument();
    expect(screen.queryByText('Discharge Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Make-up Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Ongoing Support')).not.toBeInTheDocument();
  });

  test('calls onChange when type selected', () => {
    const onChange = vi.fn();
    const { container } = render(<VisitTypeSelector value={null} onChange={onChange} />);

    const regularOption = container.querySelector('[value="REGULAR"]') as HTMLElement;
    fireEvent.click(regularOption);

    expect(onChange).toHaveBeenCalledWith('REGULAR');
  });

  test('shows selected state visually', () => {
    const onChange = vi.fn();
    const { rerender } = render(<VisitTypeSelector value={null} onChange={onChange} />);

    rerender(<VisitTypeSelector value="INITIAL" onChange={onChange} />);

    const initialLabel = screen.getByText('Med Check').closest('label');
    expect(initialLabel).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  test('shows required certifications for nurse types', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    // INITIAL and ASSESSMENT both require RN, LPN
    expect(screen.getAllByText(/Requires: RN, LPN/)).toHaveLength(2);
  });

  test('hides required certifications text for non-nurse types', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    const allRequireTexts = screen.getAllByText(/Requires:/);
    // Should be 3: INITIAL (RN, LPN), ASSESSMENT (RN, LPN), SUPERVISION (RN)
    expect(allRequireTexts).toHaveLength(3);
  });

  test('disables when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} disabled={true} />);

    const fieldset = screen.getByRole('group');
    expect(fieldset).toBeDisabled();
  });

  test('respects controlled value prop', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value="CONCIERGE" onChange={onChange} />);

    const conciergeLabel = screen.getByText('Concierge Visit').closest('label');
    expect(conciergeLabel).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  test('handles all 5 visit types selection', () => {
    const onChange = vi.fn();
    const visitTypes: VisitType[] = [
      'REGULAR',
      'INITIAL',
      'SUPERVISION',
      'ASSESSMENT',
      'CONCIERGE',
    ];

    visitTypes.forEach(type => {
      const { container, unmount } = render(<VisitTypeSelector value={null} onChange={onChange} />);
      const typeRadio = container.querySelector(`[value="${type}"]`) as HTMLElement;
      expect(typeRadio).not.toBeNull();
      fireEvent.click(typeRadio);
      unmount();
    });

    expect(onChange.mock.calls.map(c => c[0])).toEqual(visitTypes);
  });

  test('shows descriptions when showDescription is true', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} showDescription={true} />);

    expect(
      screen.getByText('Standard recurring ADL assistance, medication reminders')
    ).toBeInTheDocument();
  });

  test('hides descriptions when showDescription is false', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} showDescription={false} />);

    expect(
      screen.queryByText('Standard recurring ADL assistance, medication reminders')
    ).not.toBeInTheDocument();
  });

  test('radio buttons are properly named', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    radios.forEach(radio => {
      expect(radio).toHaveAttribute('name', 'visit_type');
    });
  });

  test('radio buttons have correct values', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    const expectedValues = [
      'REGULAR',
      'INITIAL',
      'SUPERVISION',
      'ASSESSMENT',
      'CONCIERGE',
    ];

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map(r => r.value)).toEqual(expectedValues);
  });
});
