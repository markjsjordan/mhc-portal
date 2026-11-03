import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaregiverFilters } from '../CaregiverFilters.js';
import type { CaregiverSearchFilters } from '../types';

describe('CaregiverFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const defaultFilters: CaregiverSearchFilters = {};

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it('renders search input and filter button', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(
      screen.getByPlaceholderText('Search by name or employee #...')
    ).toBeInTheDocument();
    // Filter button accessible name is just "Filters" when count is 0
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('opens filter dropdown with caregiver-specific sections', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Find the Filters button (not Reset Filters)
    const filterButton = screen.getByRole('button', { name: (name) => 
      /filters/i.test(name) && !/reset/i.test(name)
    });
    fireEvent.click(filterButton);

    expect(screen.getByText('Filter Caregivers')).toBeInTheDocument();
    expect(screen.getByText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByText('Employment Type')).toBeInTheDocument();
    expect(screen.getByText('Compliance Status')).toBeInTheDocument();
  });

  it('toggles status filter', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: (name) => 
      /filters/i.test(name) && !/reset/i.test(name)
    });
    fireEvent.click(filterButton);

    const activeButton = screen.getByRole('button', { name: /^Active$/ });
    fireEvent.click(activeButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['ACTIVE'] })
    );
  });

  it('toggles employment type filter', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: (name) => 
      /filters/i.test(name) && !/reset/i.test(name)
    });
    fireEvent.click(filterButton);

    const fullTimeButton = screen.getByRole('button', { name: /Full-Time/ });
    fireEvent.click(fullTimeButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ employmentType: ['FULL_TIME'] })
    );
  });

  it('displays active filter count', () => {
    const existingFilters: CaregiverSearchFilters = {
      status: ['ACTIVE'],
      employmentType: ['FULL_TIME'],
      complianceStatus: ['COMPLIANT'],
    };

    render(
      <CaregiverFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clears all filters', async () => {
    const existingFilters: CaregiverSearchFilters = {
      query: 'John',
      status: ['ACTIVE'],
      employmentType: ['FULL_TIME'],
    };

    render(
      <CaregiverFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Click the standalone Reset Filters button (visible when activeCount > 0)
    const resetButton = screen.getByRole('button', { name: /reset filters/i });
    fireEvent.click(resetButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        status: undefined,
        employmentType: undefined,
        complianceStatus: undefined,
      })
    );
  });
});
