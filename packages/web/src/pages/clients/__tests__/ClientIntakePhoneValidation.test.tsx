import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: { id: 'test-user', organizationId: 'test-org', branchIds: ['branch-1'] },
  }),
}));

vi.mock('@/verticals/caregivers/hooks', () => ({
  useCaregivers: () => ({ data: { items: [] } }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn() }),
  useUpdateClient: () => ({ mutateAsync: vi.fn() }),
  useClients: () => ({ data: { items: [] } }),
  useBranches: () => ({ data: [] }),
}));

describe('ClientIntakeWorkflow phone validation', () => {
  it('formats phone number as user types (10 digits)', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type raw digits
    fireEvent.change(phoneInput, { target: { value: '5125551234' } });
    
    // Should be formatted
    expect(phoneInput).toHaveValue('(512) 555-1234');
  });

  it('formats phone number with country code +1', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type with country code
    fireEvent.change(phoneInput, { target: { value: '+1 512 555 1234' } });
    
    // Should strip +1 and format
    expect(phoneInput).toHaveValue('(512) 555-1234');
  });

  it('formats phone number with existing formatting', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type with dashes
    fireEvent.change(phoneInput, { target: { value: '512-555-1234' } });
    
    // Should reformat
    expect(phoneInput).toHaveValue('(512) 555-1234');
  });

  it('shows validation error for incomplete phone number', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type incomplete number
    fireEvent.change(phoneInput, { target: { value: '512555' } });
    
    // Should show error
    expect(screen.getByText('Phone must be 10 digits')).toBeInTheDocument();
  });

  it('does not show validation error for complete phone number', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type complete number
    fireEvent.change(phoneInput, { target: { value: '5125551234' } });
    
    // Should NOT show error
    expect(screen.queryByText('Phone must be 10 digits')).not.toBeInTheDocument();
  });

  it('truncates phone number if more than 10 digits', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Type too many digits
    fireEvent.change(phoneInput, { target: { value: '51255512349999' } });
    
    // Should truncate to 10 digits
    expect(phoneInput).toHaveValue('(512) 555-1234');
  });

  it('formats emergency contact phone numbers', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    // Get the emergency contact phone by its specific ID
    const emergencyPhone = document.getElementById('emergency-contact-phone-0') as HTMLInputElement;
    
    // Type raw digits
    fireEvent.change(emergencyPhone, { target: { value: '2145551234' } });
    
    // Should be formatted
    expect(emergencyPhone).toHaveValue('(214) 555-1234');
  });

  it('shows validation error for incomplete emergency contact phone', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const emergencyPhone = document.getElementById('emergency-contact-phone-0') as HTMLInputElement;
    
    // Type incomplete number
    fireEvent.change(emergencyPhone, { target: { value: '214' } });
    
    // Should show error
    const errors = screen.getAllByText('Phone must be 10 digits');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows empty phone number (optional field)', () => {
    renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow />
      </BrowserRouter>
    );

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    // Clear the input
    fireEvent.change(phoneInput, { target: { value: '' } });
    
    // Should NOT show error for empty
    expect(screen.queryByText('Phone must be 10 digits')).not.toBeInTheDocument();
  });
});
