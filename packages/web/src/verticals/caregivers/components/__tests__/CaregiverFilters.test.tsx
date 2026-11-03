import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaregiverFilters } from '../CaregiverFilters.js';
import type { CaregiverSearchFilters } from '../../types/index.js';

describe('CaregiverFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const defaultFilters: CaregiverSearchFilters = {};

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it('renders filter button', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

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

  it('clears all filters via dropdown clear button', async () => {
    const existingFilters: CaregiverSearchFilters = {
      status: ['ACTIVE'],
      employmentType: ['FULL_TIME'],
    };

    render(
      <CaregiverFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Open the dropdown
    const filterButton = screen.getByRole('button', { name: (name) => 
      /filters/i.test(name) && !/reset/i.test(name)
    });
    fireEvent.click(filterButton);

    // Click the "Clear" button inside the dropdown
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: undefined,
        employmentType: undefined,
        complianceStatus: undefined,
      })
    );
  });

  it('does not include search query in filter state', () => {
    const filtersWithQuery: CaregiverSearchFilters = {
      query: 'John',
      status: ['ACTIVE'],
    };

    render(
      <CaregiverFilters
        filters={filtersWithQuery}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Open dropdown
    const filterButton = screen.getByRole('button', { name: (name) => 
      /filters/i.test(name) && !/reset/i.test(name)
    });
    fireEvent.click(filterButton);

    // Active count should be 1 (status only, not query)
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
