import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VisitForm } from '../VisitForm.js';

const mockGet = vi.fn();

vi.mock('@/core/hooks/index.js', () => ({
  useApiClient: () => ({
    get: mockGet,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Simplify Radix Select for deterministic jsdom testing
vi.mock('@/components/ui/select.js', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (val: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: React.ReactNode }> = [];
    let triggerId: string | undefined;

    const collect = (node: React.ReactNode) => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        const props = child.props as Record<string, unknown>;
        if (typeof props.id === 'string') {
          triggerId = props.id;
        }
        if (typeof props.value === 'string' && props.children !== undefined && !props.onValueChange) {
          items.push({ value: props.value, label: props.children as React.ReactNode });
        } else if (props.children) {
          collect(props.children as React.ReactNode);
        }
      });
    };
    collect(children);

    return (
      <select
        id={triggerId}
        data-testid={triggerId}
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">--</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/verticals/scheduling-visits/components/VisitTypeSelector.js', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="visit-type-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="REGULAR">Regular Visit</option>
      <option value="INITIAL">Initial Visit</option>
    </select>
  ),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('VisitForm (wdvf3add18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/clients')) {
        return {
          data: {
            items: [{ id: 'client-1', firstName: 'Jane', lastName: 'Doe' }],
          },
        };
      }
      if (url.startsWith('/api/service-types')) {
        return {
          data: {
            items: [{ id: 'st-1', name: 'Personal Care' }],
          },
        };
      }
      if (url.startsWith('/api/caregivers')) {
        return {
          data: {
            items: [{ id: 'cg-1', firstName: 'Alice', lastName: 'Smith', status: 'ACTIVE' }],
          },
        };
      }
      return { data: { items: [] } };
    });
  });

  it('renders duration and manual caregiver controls without AI suggestions', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<VisitForm onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByTestId('visit-client')).toBeInTheDocument();
      expect(screen.getByTestId('visit-duration')).toBeInTheDocument();
      expect(screen.getByTestId('visit-caregiver')).toBeInTheDocument();
    });

    expect(screen.queryByText(/ai suggest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recommended caregiver/i)).not.toBeInTheDocument();
  });

  it('updates end time automatically when duration changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <VisitForm initialStartTime="09:00" initialEndTime="10:00" onSubmit={onSubmit} />
    );

    const durationSelect = screen.getByTestId('visit-duration');
    fireEvent.change(durationSelect, { target: { value: '120' } });

    const endTimeInput = screen.getByLabelText(/end time/i);
    expect(endTimeInput).toHaveValue('11:00');
  });

  it('submits caregiverId as undefined when left unassigned', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<VisitForm initialDate="2026-11-25" onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Personal Care')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('visit-client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByTestId('visit-service-type'), { target: { value: 'st-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create visit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          serviceTypeId: 'st-1',
          caregiverId: undefined,
        })
      );
    });
  });

  it('submits selected caregiverId when manually chosen', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(<VisitForm initialDate="2026-11-25" onSubmit={onSubmit} />);

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Personal Care')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith (ACTIVE)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('visit-client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByTestId('visit-service-type'), { target: { value: 'st-1' } });
    fireEvent.change(screen.getByTestId('visit-caregiver'), { target: { value: 'cg-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create visit/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          serviceTypeId: 'st-1',
          caregiverId: 'cg-1',
        })
      );
    });
  });
});
