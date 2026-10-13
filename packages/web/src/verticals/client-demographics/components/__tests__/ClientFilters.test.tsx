import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClientFilters } from './ClientFilters';
import type { ClientSearchFilters } from '../types';

describe('ClientFilters', () => {
  const mockOnFiltersChange = vi.fn();

  const defaultFilters: ClientSearchFilters = {};

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
  });

  it('renders search input and filter button', () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(
      screen.getByPlaceholderText('Search by name or client number...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('updates search query with debounce', async () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by name or client number...'
    );
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'John' })
    );
  });

  it('opens filter dropdown on button click', () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    expect(screen.getByText('Filter Clients')).toBeInTheDocument();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
    expect(screen.getByText('Service Level')).toBeInTheDocument();
    expect(screen.getByText('Insurance Type')).toBeInTheDocument();
  });

  it('toggles status filter', () => {
    render(
      <ClientFilters
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

  it('toggles service level filter', () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const highButton = screen.getByRole('button', { name: /^High$/ });
    fireEvent.click(highButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ serviceLevel: ['HIGH'] })
    );
  });

  it('clears filters on Clear All button click', async () => {
    const existingFilters: ClientSearchFilters = {
      query: 'John',
      status: ['ACTIVE'],
    };

    render(
      <ClientFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    // Wait for Clear All button to appear
    const clearButton = await screen.findByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        status: undefined,
        serviceLevel: undefined,
        insuranceType: undefined,
      })
    );
  });

  it('displays active filter count badge', () => {
    const existingFilters: ClientSearchFilters = {
      status: ['ACTIVE'],
      serviceLevel: ['HIGH'],
    };

    render(
      <ClientFilters
        filters={existingFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('clears search input when X is clicked', () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by name or client number...'
    );
    fireEvent.change(searchInput, { target: { value: 'John' } });

    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('handles date range filters', async () => {
    render(
      <ClientFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(filterButton);

    const dateInputs = screen.getAllByDisplayValue('');
    const fromInput = dateInputs[dateInputs.length - 2]; // Get the "From" date input
    
    fireEvent.change(fromInput, { target: { value: '2024-01-01' } });

    expect(mockOnFiltersChange).toHaveBeenCalled();
  });
});
