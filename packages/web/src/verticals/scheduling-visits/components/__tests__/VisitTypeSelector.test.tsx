import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitTypeSelector } from '../VisitTypeSelector';
import type { VisitType } from '../../types';

describe('VisitTypeSelector', () => {
  test('renders all visit types', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    expect(screen.getByText('Regular Visit')).toBeInTheDocument();
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
    expect(screen.getByText('Assessment Visit')).toBeInTheDocument();
    expect(screen.getByText('Respite Care')).toBeInTheDocument();
    expect(screen.getByText('Supervisory Nurse Visit')).toBeInTheDocument();
    expect(screen.getByText('Emergency Response')).toBeInTheDocument();
    expect(screen.getByText('Discharge Visit')).toBeInTheDocument();
    expect(screen.getByText('Make-up Visit')).toBeInTheDocument();
    expect(screen.getByText('Concierge Visit')).toBeInTheDocument();
    expect(screen.getByText('Ongoing Support')).toBeInTheDocument();
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

    const initialLabel = screen.getByText('Initial Visit').closest('label');
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
    // Should only be 3: INITIAL (RN, LPN), ASSESSMENT (RN, LPN), SUPERVISION (RN)
    expect(allRequireTexts.length).toBeGreaterThanOrEqual(3);
  });

  test('disables when disabled prop is true', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} disabled={true} />);

    const fieldset = screen.getByRole('group');
    expect(fieldset).toBeDisabled();
  });

  test('respects controlled value prop', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value="RESPITE" onChange={onChange} />);

    const respiteLabel = screen.getByText('Respite Care').closest('label');
    expect(respiteLabel).toHaveClass('border-blue-500', 'bg-blue-50');
  });

  test('handles all visit types selection', () => {
    const onChange = vi.fn();
    const visitTypes: VisitType[] = [
      'REGULAR',
      'INITIAL',
      'ASSESSMENT',
      'RESPITE',
      'SUPERVISION',
      'EMERGENCY',
      'DISCHARGE',
      'MAKEUP',
      'CONCIERGE',
      'ONGOING_SUPPORT',
    ];

    visitTypes.forEach(type => {
      const { container, unmount } = render(<VisitTypeSelector value={null} onChange={onChange} />);
      const typeRadio = container.querySelector(`[value="${type}"]`) as HTMLElement;
      expect(typeRadio).not.toBeNull();
      fireEvent.click(typeRadio);
      unmount();
    });

    // Every visit type must emit its own value exactly once
    expect(onChange.mock.calls.map(c => c[0])).toEqual(visitTypes);
  });

  test('shows descriptions when showDescription is true', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} showDescription={true} />);

    expect(
      screen.getByText(
        'Standard recurring home care visit (ADL assistance, medication reminders)'
      )
    ).toBeInTheDocument();
  });

  test('hides descriptions when showDescription is false', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} showDescription={false} />);

    expect(
      screen.queryByText(
        'Standard recurring home care visit (ADL assistance, medication reminders)'
      )
    ).not.toBeInTheDocument();
  });

  test('radio buttons are properly named', () => {
    const onChange = vi.fn();
    render(<VisitTypeSelector value={null} onChange={onChange} />);

    const radios = screen.getAllByRole('radio');
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
      'ASSESSMENT',
      'RESPITE',
      'SUPERVISION',
      'EMERGENCY',
      'DISCHARGE',
      'MAKEUP',
      'CONCIERGE',
      'ONGOING_SUPPORT',
    ];

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio, index) => {
      expect(radio).toHaveAttribute('value', expectedValues[index]);
    });
  });
});
