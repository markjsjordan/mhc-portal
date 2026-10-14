import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileForm } from '@/components/forms/ProfileForm';
import type { UserProfile } from '@/hooks/useUserProfile';

describe('ProfileForm Component', () => {
  const mockProfile: UserProfile = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    organizationId: 'org-1',
    roles: ['user'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  };

  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnVersionConflict = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    render(
      <ProfileForm
        profile={undefined}
        isLoading={true}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should populate form fields with profile data', () => {
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('(555) 123-4567')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.tab();

    rerender(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    });
  });

  it('should reject invalid email format', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const emailInput = screen.getByDisplayValue('john@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    });
  });

  it('should reject phone exceeding max length', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const phoneInput = screen.getByDisplayValue('(555) 123-4567');
    await user.clear(phoneInput);
    await user.type(phoneInput, '12345678901234567890123'); // > 20 chars
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/phone number is too long/i)).toBeInTheDocument();
    });
  });

  it('should disable form during update', () => {
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={true}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });

    const submitButton = screen.getByRole('button', { name: /saving/i });
    expect(submitButton).toBeDisabled();
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567',
        })
      );
    });
  });

  it('should disable submit button when no changes made', () => {
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when changes made', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should show cancel button and call onCancel', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should confirm before canceling with unsaved changes
    // If no changes, should call directly
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show warning when changing email', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const emailInput = screen.getByDisplayValue('john@example.com');
    await user.clear(emailInput);
    await user.type(emailInput, 'newemail@example.com');

    await waitFor(() => {
      expect(screen.getByText(/verification link/i)).toBeInTheDocument();
    });
  });

  it('should show error message on update error', () => {
    const error = new Error('Update failed');
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={error}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Update failed')).toBeInTheDocument();
  });

  it('should handle version conflict', async () => {
    const conflictError = {
      response: {
        data: {
          code: 'VERSION_CONFLICT',
          current: {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com',
            phone: null,
            version: 2,
          },
        },
      },
    };

    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={conflictError as any}
        onSubmit={mockOnSubmit}
        onVersionConflict={mockOnVersionConflict}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/profile update conflict/i)).toBeInTheDocument();
    });

    expect(mockOnVersionConflict).toHaveBeenCalled();
  });

  it('should show sync status', () => {
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });

  it('should handle null phone gracefully', () => {
    const profileWithoutPhone = {
      ...mockProfile,
      phone: null,
    };

    render(
      <ProfileForm
        profile={profileWithoutPhone}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const phoneInput = screen.getByRole('textbox', { name: /phone/i });
    expect(phoneInput).toHaveValue('');
  });

  it('should allow optional phone field to be empty', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const phoneInput = screen.getByDisplayValue('(555) 123-4567');
    await user.clear(phoneInput);

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '',
        })
      );
    });
  });

  it('should show success message after update', () => {
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    // Should show sync indicator after successful update
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });

  it('should validate special characters in name fields', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Jane-Marie"); // Valid with hyphen
    await user.tab();

    // Should not show error for hyphenated names
    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should pass version to onSubmit', async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        profile={mockProfile}
        isLoading={false}
        isUpdating={false}
        updateError={null}
        onSubmit={mockOnSubmit}
      />
    );

    const firstNameInput = screen.getByDisplayValue('John');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
        })
      );
    });
  });
});
