import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CarePlanFilters } from './CarePlanFilters';
import type { CarePlanSearchFilters } from '../types';

describe('CarePlanFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const defaultFilters: CarePlanSearchFilters = {};

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it('renders search input and filter button', () => {
    render(
      <CarePlanFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(
      screen.getByPlaceholderText('Search by plan name or client name...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('opens filter dropdown with care plan specific sections', () => {
    render(
      <CarePlanFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    expect(screen.getByText('Filter Care Plans')).toBeInTheDocument();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
    expect(screen.getByText('PRIORITY')).toBeInTheDocument();
    expect(screen.getByText('Created Date')).toBeInTheDocument();
  });

  it('toggles status filter', () => {
    render(
      <CarePlanFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const activeButton = screen.getByRole('button', { name: /^Active$/ });
    fireEvent.click(activeButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['ACTIVE'] })
    );
  });

  it('toggles priority filter', () => {
    render(
      <CarePlanFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const urgentButton = screen.getByRole('button', { name: /Urgent/ });
    fireEvent.click(urgentButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ priority: ['URGENT'] })
    );
  });

  it('displays active filter count', () => {
    const existingFilters: CarePlanSearchFilters = {
      status: ['ACTIVE'],
      priority: ['HIGH'],
    };

    render(
      <CarePlanFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('clears all filters', async () => {
    const existingFilters: CarePlanSearchFilters = {
      query: 'Physical Therapy',
      status: ['ACTIVE'],
      priority: ['HIGH'],
    };

    render(
      <CarePlanFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const clearButton = await screen.findByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        status: undefined,
        priority: undefined,
      })
    );
  });
});
