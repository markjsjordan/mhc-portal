import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';
import { BrowserRouter } from 'react-router-dom';

// Mock auth hook
vi.mock('@/core/hooks', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      organizationId: 'test-org',
      branchIds: ['branch-1'],
    },
  }),
}));

// Mock hooks from client-demographics
vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'new-client-id' }),
  }),
  useUpdateClient: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'updated-client-id' }),
  }),
  useClients: () => ({
    data: { items: [{ id: 'client-1', branchId: 'branch-1' }] },
  }),
  useBranches: () => ({
    data: [
      { id: 'branch-1', name: 'Main Branch', code: 'MB' },
      { id: 'branch-2', name: 'North Branch', code: 'NB' },
    ],
  }),
}));

describe('ClientIntakeWorkflow - Mobile and Responsive Layout', () => {
  const renderWorkflow = (props = {}) => {
    return renderWithQueryClient(
      <BrowserRouter>
        <ClientIntakeWorkflow {...props} />
      </BrowserRouter>
    );
  };

  it('renders both desktop and mobile progress stepper components', () => {
    const { container } = renderWorkflow();

    // Verify desktop stepper exists with hidden md:flex
    const desktopStepper = container.querySelector('.hidden.md\\:flex');
    expect(desktopStepper).toBeInTheDocument();

    // Verify mobile stepper exists with flex md:hidden
    const mobileStepper = container.querySelector('.flex.md\\:hidden');
    expect(mobileStepper).toBeInTheDocument();

    // Mobile stepper displays current step and percentage
    expect(mobileStepper?.textContent).toContain('Step 1 of 7');
    expect(mobileStepper?.textContent).toContain('Demographics');
    expect(mobileStepper?.textContent).toContain('14% Complete');
  });

  it('uses responsive layout for form rows to stack on mobile and row on desktop', () => {
    const { container } = renderWorkflow();

    // Basic information inputs use responsive flex classes
    const formRows = container.querySelectorAll('.flex.flex-col.sm\\:flex-row');
    expect(formRows.length).toBeGreaterThan(0);

    // Inputs have touch-friendly height (min-h-[44px])
    const inputs = container.querySelectorAll('input[type="text"], input[type="tel"]');
    inputs.forEach((input) => {
      expect(input.className).toContain('min-h-[44px]');
      expect(input.className).toContain('w-full');
    });
  });

  it('validates required fields before proceeding to the next step', () => {
    renderWorkflow();

    // Clicking Next without filling fields stays on step 1
    const nextButton = screen.getByRole('button', { name: /Next →/i });
    fireEvent.click(nextButton);

    expect(screen.getByText('Demographics & Contact Information')).toBeInTheDocument();
  });

  it('allows navigation through wizard to Step 7 (Review & Submit)', () => {
    const initialData = {
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1980-05-15',
      phone: '(555) 000-1111',
      address: {
        line1: '123 Main Street Suite 400',
        line2: 'Apt 4B',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
      serviceTypes: ['Personal Care', 'Homemaking'],
      visitFrequency: '3xweek' as const,
      visitDuration: 60,
      tasks: ['Bathing assistance', 'Meal preparation'],
      primaryCaregiver: 'cg-1',
      consents: {
        careAgreement: true,
        hipaa: true,
        financialResponsibility: true,
        evv: true,
      },
      signature: 'Jane Doe',
    };

    const { container } = renderWorkflow({ initialData });

    // Step 1: Click Next
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 2: Assessment -> Next
    expect(screen.getByText('Care Assessment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 3: Care Plan -> Next
    expect(screen.getByText('Care Plan Creation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 4: Caregivers -> Next
    expect(screen.getByText('Caregiver Assignment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 5: Schedule -> Next
    expect(screen.getByText('Initial Schedule')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 6: Consent -> Next
    expect(screen.getByText('Consent & Signatures')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next →/i }));

    // Step 7: Review & Submit
    expect(screen.getByText('Review & Submit')).toBeInTheDocument();

    // Verify Review summary cards have responsive stacking layout
    const reviewItems = container.querySelectorAll('.flex.flex-col.sm\\:flex-row');
    expect(reviewItems.length).toBeGreaterThan(0);

    // Verify address is displayed without horizontal overflow
    expect(screen.getByText(/123 Main Street Suite 400/i)).toBeInTheDocument();
    expect(screen.getByText(/Austin, TX 78701/i)).toBeInTheDocument();

    // Verify service types and tasks are rendered as badges
    expect(screen.getByText('Personal Care')).toBeInTheDocument();
    expect(screen.getByText('Homemaking')).toBeInTheDocument();
    expect(screen.getByText('Bathing assistance')).toBeInTheDocument();
    expect(screen.getByText('Meal preparation')).toBeInTheDocument();

    // Verify consent status displays signed badge
    expect(screen.getByText('✓ All Signed')).toBeInTheDocument();

    // Verify primary caregiver displays name
    expect(screen.getByText('Maria Garcia')).toBeInTheDocument();

    // Verify Submit & Create Client button is present and full-width on mobile
    const submitBtn = screen.getByRole('button', { name: /Submit & Create Client/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.className).toContain('w-full');
    expect(submitBtn.className).toContain('min-h-[50px]');
  });

  it('renders touch-friendly navigation controls with proper button spacing', () => {
    const { container } = renderWorkflow();

    // Bottom navigation container has full-width and responsive flex direction
    const navContainer = container.querySelector('.border-t.border-gray-200');
    expect(navContainer).toBeInTheDocument();

    // Back button is disabled on step 1
    const backBtn = screen.getByRole('button', { name: /← Back/i });
    expect(backBtn).toBeDisabled();
    expect(backBtn.className).toContain('min-h-[48px]');

    // Next button has min height 48px
    const nextBtn = screen.getByRole('button', { name: /Next →/i });
    expect(nextBtn.className).toContain('min-h-[48px]');
  });
});
