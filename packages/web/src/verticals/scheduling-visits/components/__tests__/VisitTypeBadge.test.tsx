import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisitTypeBadge } from '../VisitTypeBadge';
import type { VisitType } from '../../types';

describe('VisitTypeBadge', () => {
  test('renders with correct label', () => {
    render(<VisitTypeBadge type="INITIAL" />);
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
  });

  test('displays all visit types correctly', () => {
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
      const { unmount } = render(<VisitTypeBadge type={type} />);
      const badge = screen.getByTestId('visit-type-badge');
      expect(badge).toBeInTheDocument();
      unmount();
    });
  });

  test('hides label when showLabel false', () => {
    render(<VisitTypeBadge type="INITIAL" showLabel={false} />);
    expect(screen.queryByText('Initial Visit')).not.toBeInTheDocument();
  });

  test('shows label when showLabel true', () => {
    render(<VisitTypeBadge type="INITIAL" showLabel={true} />);
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
  });

  test('applies correct size classes', () => {
    const { container: smContainer } = render(<VisitTypeBadge type="INITIAL" size="sm" />);
    expect(smContainer.firstChild).toHaveClass('text-xs');

    const { container: mdContainer } = render(<VisitTypeBadge type="INITIAL" size="md" />);
    expect(mdContainer.firstChild).toHaveClass('text-sm');

    const { container: lgContainer } = render(<VisitTypeBadge type="INITIAL" size="lg" />);
    expect(lgContainer.firstChild).toHaveClass('text-base');
  });

  test('hides icon when showIcon false', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" showIcon={false} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  test('shows icon when showIcon true', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" showIcon={true} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  test('applies correct color classes', () => {
    const { container: regularContainer } = render(<VisitTypeBadge type="REGULAR" />);
    expect(regularContainer.firstChild).toHaveClass('bg-green-100', 'text-green-800');

    const { container: initialContainer } = render(<VisitTypeBadge type="INITIAL" />);
    expect(initialContainer.firstChild).toHaveClass('bg-emerald-100', 'text-emerald-800');

    const { container: emergencyContainer } = render(<VisitTypeBadge type="EMERGENCY" />);
    expect(emergencyContainer.firstChild).toHaveClass('bg-red-100', 'text-red-800');
  });

  test('accepts custom className', () => {
    const { container } = render(
      <VisitTypeBadge type="INITIAL" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('has description in title attribute', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.getAttribute('title')).toContain('First visit with new client');
  });

  test('renders as inline-flex', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" />);
    expect(container.firstChild).toHaveClass('inline-flex');
  });

  test('has proper accessibility with data-testid', () => {
    render(<VisitTypeBadge type="INITIAL" />);
    expect(screen.getByTestId('visit-type-badge')).toBeInTheDocument();
  });

  test('default shows both icon and label', () => {
    const { container } = render(<VisitTypeBadge type="INITIAL" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    expect(screen.getByText('Initial Visit')).toBeInTheDocument();
  });

  test('md size is default', () => {
    const { container: defaultContainer } = render(<VisitTypeBadge type="INITIAL" />);
    const { container: mdContainer } = render(
      <VisitTypeBadge type="INITIAL" size="md" />
    );
    expect(defaultContainer.firstChild).toHaveClass('text-sm');
    expect(mdContainer.firstChild).toHaveClass('text-sm');
  });

  test('supports all visit types with correct styling', () => {
    const typeColorMap: Record<VisitType, { bgClass: string; textClass: string }> = {
      REGULAR: { bgClass: 'bg-green-100', textClass: 'text-green-800' },
      INITIAL: { bgClass: 'bg-emerald-100', textClass: 'text-emerald-800' },
      ASSESSMENT: { bgClass: 'bg-teal-100', textClass: 'text-teal-800' },
      RESPITE: { bgClass: 'bg-rose-100', textClass: 'text-rose-800' },
      SUPERVISION: { bgClass: 'bg-indigo-100', textClass: 'text-indigo-800' },
      EMERGENCY: { bgClass: 'bg-red-100', textClass: 'text-red-800' },
      DISCHARGE: { bgClass: 'bg-purple-100', textClass: 'text-purple-800' },
      MAKEUP: { bgClass: 'bg-amber-100', textClass: 'text-amber-800' },
      CONCIERGE: { bgClass: 'bg-pink-100', textClass: 'text-pink-800' },
      ONGOING_SUPPORT: { bgClass: 'bg-cyan-100', textClass: 'text-cyan-800' },
    };

    Object.entries(typeColorMap).forEach(([type, colors]) => {
      const { container, unmount } = render(<VisitTypeBadge type={type as VisitType} />);
      expect(container.firstChild).toHaveClass(colors.bgClass, colors.textClass);
      unmount();
    });
  });
});
