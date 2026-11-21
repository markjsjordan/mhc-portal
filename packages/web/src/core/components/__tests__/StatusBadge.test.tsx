import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/core/components/index.js';

describe('StatusBadge', () => {
  test('renders PENDING_ONBOARDING as formatted pill badge with warning classes', () => {
    render(<StatusBadge status="PENDING_ONBOARDING" />);
    const badge = screen.getByText('Pending Onboarding');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('bg-yellow-100');
    expect(badge.className).toContain('text-yellow-800');
    expect(badge.className).toContain('whitespace-nowrap');
  });

  test('renders ACTIVE as formatted pill badge with success classes', () => {
    render(<StatusBadge status="ACTIVE" />);
    const badge = screen.getByText('Active');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });

  test('formats unknown UPPER_SNAKE_CASE statuses in Title Case', () => {
    render(<StatusBadge status="CUSTOM_REVIEW_NEEDED" />);
    const badge = screen.getByText('Custom Review Needed');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('border-gray-200');
  });
});
