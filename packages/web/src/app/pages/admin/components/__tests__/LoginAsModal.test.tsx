import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginAsModal } from '../LoginAsModal.js';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const mockAuthUser = vi.hoisted(() => ({
  userId: 'admin-user-1',
  email: 'admin@folkcare.com',
  organizationId: 'org-1',
  roles: ['admin'],
}));

vi.mock('@/core/hooks/api.js', () => ({
  useApiClient: () => mockApiClient,
}));

vi.mock('@/core/hooks/auth.js', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const mockCaregivers = [
  {
    id: 'cg-1',
    firstName: 'Alice',
    lastName: 'Brown',
    email: 'alice.brown@example.com',
    employeeNumber: 'EMP-001',
    role: 'CAREGIVER',
    status: 'ACTIVE',
    complianceStatus: 'COMPLIANT',
    employmentType: 'FULL_TIME',
    hireDate: new Date('2024-01-01'),
    primaryPhone: { number: '555-0101', type: 'MOBILE' as const, canReceiveSMS: true },
  },
  {
    id: 'cg-2',
    firstName: 'Charlie',
    lastName: 'Adams',
    email: 'charlie.adams@example.com',
    employeeNumber: 'EMP-002',
    role: 'CAREGIVER',
    status: 'ACTIVE',
    complianceStatus: 'COMPLIANT',
    employmentType: 'PART_TIME',
    hireDate: new Date('2024-02-01'),
    primaryPhone: { number: '555-0102', type: 'MOBILE' as const, canReceiveSMS: true },
  },
];

describe('LoginAsModal (wdvf3abxat)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onImpersonateStart: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.get.mockResolvedValue({
      items: mockCaregivers,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('does not render when isOpen is false', () => {
    render(<LoginAsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Login As Caregiver')).not.toBeInTheDocument();
  });

  it('loads caregivers automatically on open without search query', async () => {
    render(<LoginAsModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/caregivers\?page=1&limit=20&sortBy=last_name&sortOrder=asc/)
      );
    });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Brown')).toBeInTheDocument();
    expect(screen.getByText('alice.brown@example.com')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Adams')).toBeInTheDocument();
    expect(screen.getByText('charlie.adams@example.com')).toBeInTheDocument();

    // Verify search input is NOT present
    expect(screen.queryByPlaceholderText(/search by name/i)).not.toBeInTheDocument();
  });

  it('renders columns First Name, Last Name, Email with table headers', async () => {
    render(<LoginAsModal {...defaultProps} />);

    expect(await screen.findByRole('columnheader', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /last name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
  });

  it('handles server-side sorting: toggles asc/desc and switches columns', async () => {
    render(<LoginAsModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    // Initial sort is last_name asc
    expect(mockApiClient.get).toHaveBeenLastCalledWith(
      expect.stringContaining('sortBy=last_name&sortOrder=asc')
    );

    // Click "Last Name" to toggle to desc
    const lastNameHeader = screen.getByRole('columnheader', { name: /last name/i });
    fireEvent.click(lastNameHeader);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenLastCalledWith(
        expect.stringContaining('sortBy=last_name&sortOrder=desc')
      );
    });

    // Click "First Name" to sort by first_name asc
    const firstNameHeader = screen.getByRole('columnheader', { name: /first name/i });
    fireEvent.click(firstNameHeader);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenLastCalledWith(
        expect.stringContaining('sortBy=first_name&sortOrder=asc')
      );
    });

    // Click "Email" to sort by email asc
    const emailHeader = screen.getByRole('columnheader', { name: /email/i });
    fireEvent.click(emailHeader);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenLastCalledWith(
        expect.stringContaining('sortBy=email&sortOrder=asc')
      );
    });
  });

  it('supports pagination controls (Prev/Next and page indicator)', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: mockCaregivers,
      total: 45,
      page: 1,
      limit: 20,
      totalPages: 3,
    });

    render(<LoginAsModal {...defaultProps} />);

    expect(await screen.findByText(/page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/\(45 total\)/i)).toBeInTheDocument();

    const prevButton = screen.getByRole('button', { name: /previous page/i });
    const nextButton = screen.getByRole('button', { name: /next page/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Click Next
    mockApiClient.get.mockResolvedValueOnce({
      items: mockCaregivers,
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenLastCalledWith(
        expect.stringContaining('page=2')
      );
    });
  });

  it('starts impersonation on row click and calls onImpersonateStart', async () => {
    mockApiClient.post.mockResolvedValueOnce({
      success: true,
      data: {
        accessToken: 'mock-token-123',
        expiresIn: 3600,
        caregiver: { id: 'cg-1', email: 'alice.brown@example.com', name: 'Alice Brown' },
      },
    });

    render(<LoginAsModal {...defaultProps} />);

    const aliceRow = await screen.findByText('Alice');
    fireEvent.click(aliceRow);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/impersonate/start', {
        caregiverId: 'cg-1',
      });
    });

    expect(defaultProps.onImpersonateStart).toHaveBeenCalledWith('mock-token-123', {
      id: 'cg-1',
      email: 'alice.brown@example.com',
      name: 'Alice Brown',
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('displays impersonation error if impersonation API fails', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Impersonation denied by policy'));

    render(<LoginAsModal {...defaultProps} />);

    const aliceRow = await screen.findByText('Alice');
    fireEvent.click(aliceRow);

    expect(await screen.findByText('Impersonation denied by policy')).toBeInTheDocument();
    expect(defaultProps.onImpersonateStart).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('displays fetch error message when caregiver fetch fails', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Network error loading caregivers'));

    render(<LoginAsModal {...defaultProps} />);

    expect(await screen.findByText('Network error loading caregivers')).toBeInTheDocument();
  });

  it('displays empty state when no caregivers are returned', async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    render(<LoginAsModal {...defaultProps} />);

    expect(await screen.findByText('No caregivers found')).toBeInTheDocument();
  });

  it('closes modal when Cancel button or Close button is clicked', async () => {
    render(<LoginAsModal {...defaultProps} />);

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });
});
