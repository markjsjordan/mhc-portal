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
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('opens filter dropdown with caregiver-specific sections', () => {
    render(
      <CaregiverFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
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

    const filterButton = screen.getByRole('button', { name: /filters/i });
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

    const filterButton = screen.getByRole('button', { name: /filters/i });
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

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const clearButton = await screen.findByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

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
