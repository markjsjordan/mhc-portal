import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient.js';
import { StateConfigPanel } from '../components/StateConfigPanel.js';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

const mockAuthUser = vi.hoisted(() => ({
  userId: 'admin-user-1',
  email: 'admin@folkcare.com',
  organizationId: 'org-test-123',
  roles: ['admin'],
}));

vi.mock('@/core/hooks/index.js', () => ({
  useApiClient: () => mockApiClient,
  useAuth: () => ({ user: mockAuthUser }),
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: mockToast,
}));

let mockPolicyState = { locationRequired: false };

vi.mock('@/verticals/time-tracking-evv/hooks/index.js', () => ({
  useLocationPolicy: () => ({
    data: mockPolicyState,
    locationRequired: mockPolicyState.locationRequired,
  }),
}));

describe('StateConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPolicyState = { locationRequired: false };
    mockApiClient.put.mockResolvedValue({ success: true });
  });

  it('should render state configuration title', () => {
    renderWithQueryClient(<StateConfigPanel />);
    expect(screen.getByText('State-Specific EVV Configuration')).toBeInTheDocument();
  });

  it('should render all 7 supported states', () => {
    renderWithQueryClient(<StateConfigPanel />);
    expect(screen.getByText('Texas')).toBeInTheDocument();
    expect(screen.getByText('Florida')).toBeInTheDocument();
    expect(screen.getByText('Ohio')).toBeInTheDocument();
    expect(screen.getByText('Pennsylvania')).toBeInTheDocument();
    expect(screen.getByText('Georgia')).toBeInTheDocument();
    expect(screen.getByText('North Carolina')).toBeInTheDocument();
    expect(screen.getByText('Arizona')).toBeInTheDocument();
  });

  it('should display Texas configuration by default', () => {
    renderWithQueryClient(<StateConfigPanel />);
    expect(screen.getByText('Texas Configuration')).toBeInTheDocument();
  });

  it('should render geofence tolerance input', () => {
    renderWithQueryClient(<StateConfigPanel />);
    const input = screen.getByLabelText(/geofence tolerance/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should render grace period input', () => {
    renderWithQueryClient(<StateConfigPanel />);
    const input = screen.getByLabelText(/check-in grace period/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should render GPS accuracy threshold input', () => {
    renderWithQueryClient(<StateConfigPanel />);
    const input = screen.getByLabelText(/gps accuracy threshold/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should render aggregator select', () => {
    renderWithQueryClient(<StateConfigPanel />);
    const select = screen.getByLabelText(/evv aggregator/i);
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('role', 'combobox');
  });

  it('should have Save and Reset buttons disabled initially', () => {
    renderWithQueryClient(<StateConfigPanel />);
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(saveButton).toBeDisabled();
    expect(resetButton).toBeDisabled();
  });

  it('should enable the Reset button after changes, but keep Save disabled (feature not yet implemented)', () => {
    renderWithQueryClient(<StateConfigPanel />);
    
    // Make a change to geofence tolerance
    const input = screen.getByLabelText(/geofence tolerance/i);
    fireEvent.change(input, { target: { value: '150' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    const resetButton = screen.getByRole('button', { name: /reset/i });
    // Save persistence is intentionally disabled with an honest "Coming Soon"
    // label (FC-009) until the backend API exists — only Reset should enable.
    expect(saveButton).toBeDisabled();
    expect(resetButton).not.toBeDisabled();
  });

  it('should show unsaved changes warning after modifications', () => {
    renderWithQueryClient(<StateConfigPanel />);
    
    // Make a change
    const input = screen.getByLabelText(/geofence tolerance/i);
    fireEvent.change(input, { target: { value: '150' } });

    expect(screen.getByText(/you have unsaved changes/i)).toBeInTheDocument();
  });

  it('should switch states when state button is clicked', () => {
    renderWithQueryClient(<StateConfigPanel />);
    
    // Click Florida
    const floridaButton = screen.getByText('Florida');
    fireEvent.click(floridaButton);

    expect(screen.getByText('Florida Configuration')).toBeInTheDocument();
  });

  it('should render enable/disable toggle', () => {
    renderWithQueryClient(<StateConfigPanel />);
    expect(screen.getByText(/enable tx operations/i)).toBeInTheDocument();
  });

  it('should render required documentation checkboxes', () => {
    renderWithQueryClient(<StateConfigPanel />);
    expect(screen.getByText(/evv 6 required elements/i)).toBeInTheDocument();
    expect(screen.getByText(/gps coordinates/i)).toBeInTheDocument();
  });

  it('should have proper input constraints', () => {
    renderWithQueryClient(<StateConfigPanel />);
    
    const geofenceInput = screen.getByLabelText(/geofence tolerance/i);
    expect(geofenceInput).toHaveAttribute('min', '50');
    expect(geofenceInput).toHaveAttribute('max', '300');
    expect(geofenceInput).toHaveAttribute('step', '10');

    const graceInput = screen.getByLabelText(/check-in grace period/i);
    expect(graceInput).toHaveAttribute('min', '5');
    expect(graceInput).toHaveAttribute('max', '30');
    expect(graceInput).toHaveAttribute('step', '5');
  });

  describe('Location Policy Switch', () => {
    it('should render location capture policy toggle with warning text', () => {
      renderWithQueryClient(<StateConfigPanel />);

      const toggle = screen.getByLabelText(/require location capture for visits/i);
      expect(toggle).toBeInTheDocument();
      expect(toggle).not.toBeChecked();

      expect(
        screen.getByText(/turning this off means visits are recorded without location/i)
      ).toBeInTheDocument();
    });

    it('should send PUT request when location capture toggle is clicked and show success toast', async () => {
      renderWithQueryClient(<StateConfigPanel />);

      const toggle = screen.getByLabelText(/require location capture for visits/i);
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockApiClient.put).toHaveBeenCalledWith(
          '/api/organizations/org-test-123',
          {
            settings: {
              evv: {
                locationRequired: true,
              },
            },
          }
        );
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        'Location capture required for visits'
      );
    });

    it('should revert switch and show error toast when PUT returns 403', async () => {
      mockApiClient.put.mockRejectedValueOnce({
        status: 403,
        response: { status: 403, data: { error: 'Forbidden' } },
      });

      renderWithQueryClient(<StateConfigPanel />);

      const toggle = screen.getByLabelText(/require location capture for visits/i);
      expect(toggle).not.toBeChecked();

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'You do not have permission to change this setting'
        );
      });

      expect(toggle).not.toBeChecked();
    });
  });
});
