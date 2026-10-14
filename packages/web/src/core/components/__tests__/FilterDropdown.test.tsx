import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterDropdown } from './FilterDropdown';
import { FilterCheckboxSection } from './FilterCheckboxSection';

describe('FilterDropdown', () => {
  it('renders trigger button with title and active count', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={3}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens dropdown on button click', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    expect(screen.getByText('Filter Test')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    const onClearAll = vi.fn();
    const { container } = render(
      <div>
        <FilterDropdown
          title="Filter Test"
          activeCount={0}
          onClearAll={onClearAll}
        >
          <div>Test Content</div>
        </FilterDropdown>
        <div data-testid="outside">Outside Element</div>
      </div>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('closes dropdown on ESC key', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('closes dropdown on Apply button click', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={1}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(applyButton);
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('closes dropdown on close button click', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    const closeButton = screen.getByRole('button', { name: /close filters/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('calls onClearAll when Clear All button is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={2}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    const clearButton = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearButton);

    expect(onClearAll).toHaveBeenCalled();
  });

  it('displays correct filter count text', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    expect(screen.getByText('No filters applied')).toBeInTheDocument();
  });

  it('displays plural filter count text', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={3}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    expect(screen.getByText('3 filters applied')).toBeInTheDocument();
  });

  it('does not show Clear All button when no filters are active', () => {
    const onClearAll = vi.fn();
    render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('applies responsive width classes', () => {
    const onClearAll = vi.fn();
    const { container } = render(
      <FilterDropdown
        title="Filter Test"
        activeCount={0}
        onClearAll={onClearAll}
        width="lg"
      >
        <div>Test Content</div>
      </FilterDropdown>
    );

    const button = screen.getByRole('button', { name: /filters/i });
    fireEvent.click(button);

    const panel = container.querySelector('[class*="w-96"]');
    expect(panel).toBeInTheDocument();
  });
});
