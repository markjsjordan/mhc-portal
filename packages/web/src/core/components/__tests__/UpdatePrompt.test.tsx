import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpdatePrompt } from '../UpdatePrompt';

let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn((val: boolean) => {
  mockNeedRefresh = val;
});
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: any) => {
    // If registered callback is provided, invoke it
    if (options?.onRegistered) {
      options.onRegistered({
        update: vi.fn().mockResolvedValue(undefined),
      });
    }
    return {
      needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('UpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedRefresh = false;
  });

  it('renders nothing when needRefresh is false', () => {
    mockNeedRefresh = false;
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a friendly update toast when needRefresh is true', () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Update available')).toBeInTheDocument();
    expect(screen.getByText(/A new version of MHC Portal is ready/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close update notification/i })).toBeInTheDocument();
  });

  it('invokes updateServiceWorker(true) and onUpdate when clicking "Update now"', async () => {
    mockNeedRefresh = true;
    const onUpdate = vi.fn();
    render(<UpdatePrompt onUpdate={onUpdate} />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    fireEvent.click(updateBtn);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses the prompt when clicking "Later"', () => {
    mockNeedRefresh = true;
    const onDismiss = vi.fn();
    render(<UpdatePrompt onDismiss={onDismiss} />);

    const laterBtn = screen.getByRole('button', { name: /later/i });
    fireEvent.click(laterBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('dismisses the prompt when clicking the close button', () => {
    mockNeedRefresh = true;
    const onDismiss = vi.fn();
    render(<UpdatePrompt onDismiss={onDismiss} />);

    const closeBtn = screen.getByRole('button', { name: /close update notification/i });
    fireEvent.click(closeBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });
});
